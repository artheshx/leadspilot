import uuid
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app import config
from app.db import approval_store, meta_store
from app.services import meta_ads_service, support_service
from app.services.meta_ads_service import MetaAdsError
from app.auth import get_current_user, CurrentUser, assert_business_access

# NOTE: auth is applied per-route here, not at the router level, because
# GET /meta/oauth/callback is hit by Meta's own server redirecting the
# user's browser — it carries no LeadPilot session/Bearer token at all.
# Router-wide auth would break the entire "connect your ad account" flow.
router = APIRouter(prefix="/meta", tags=["meta-ads"])


@router.get("/oauth/url")
def get_oauth_url(business_id: str, user: CurrentUser = Depends(get_current_user)):
    """Frontend redirects the user to this URL to connect their Meta Ad Account."""
    assert_business_access(business_id, user)
    # state carries business_id through the OAuth round-trip
    return {"oauth_url": meta_ads_service.build_oauth_url(state=business_id)}


@router.get("/oauth/callback")
def oauth_callback(code: str, state: str):
    """Meta redirects here after the user approves. `state` = business_id we sent
    earlier. Deliberately PUBLIC — no auth dependency — Meta's redirect carries no
    LeadPilot session. `state` isn't a secret, but this endpoint only ever writes
    a Meta access token against the business_id embedded in it (not arbitrary data
    supplied by the caller), which is the same trust model the original OAuth
    design already relied on."""
    business_id = state
    try:
        token_data = meta_ads_service.exchange_code_for_token(code)
        access_token = token_data["access_token"]
        ad_accounts = meta_ads_service.get_ad_accounts(access_token)
    except MetaAdsError as e:
        support_service.escalate(business_id, "api_error", str(e))
        raise HTTPException(502, str(e))

    if not ad_accounts:
        raise HTTPException(400, "No ad accounts found on this Meta account.")

    # MVP: auto-pick the first ad account. A real UI would let the user choose
    # if they manage multiple ad accounts.
    ad_account_id = ad_accounts[0]["id"]
    ad_account_name = ad_accounts[0].get("name")
    meta_store.save_meta_account(business_id, ad_account_id, access_token,
                                  ["ads_management", "ads_read"], account_name=ad_account_name)

    return {"business_id": business_id, "connected_ad_account": ad_account_id, "dry_run": config.META_DRY_RUN}


class LaunchRequest(BaseModel):
    launched_by: str  # who's triggering the actual go-live, for the audit trail


@router.post("/campaigns/launch/{draft_id}")
def launch_campaign(draft_id: str, payload: LaunchRequest, user: CurrentUser = Depends(get_current_user)):
    """
    THE gated action. Fires only if:
    1) The draft exists and its approval status is exactly 'approved'
    2) This draft hasn't already been launched (checked in meta_store)
    3) A Meta account is connected for this business
    4) The budget is within the safety cap (re-checked inside meta_ads_service)
    5) The caller owns this draft's business_id (or is an admin)
    Any failure here raises a clear error and changes nothing.
    """
    draft = approval_store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(404, f"No such draft: {draft_id}")
    assert_business_access(draft["business_id"], user)
    if draft["status"] != "approved":
        raise HTTPException(
            409,
            f"Draft status is '{draft['status']}', not 'approved'. "
            f"A campaign can only be launched after it has been approved in the Approval Gate.",
        )
    if meta_store.campaign_already_launched_for_draft(draft_id):
        raise HTTPException(409, "This draft has already been launched. Refusing to launch it a second time.")

    business_id = draft["business_id"]
    meta_account = meta_store.get_meta_account(business_id)
    if meta_account is None:
        raise HTTPException(
            400,
            f"No Meta Ad Account connected for business_id={business_id}. "
            f"Call GET /meta/oauth/url first to connect one.",
        )

    try:
        result = meta_ads_service.launch_campaign(
            meta_account["access_token"], meta_account["ad_account_id"],
            draft["strategy"], draft["creative"],
        )
    except MetaAdsError as e:
        support_service.escalate(business_id, "api_error", str(e))
        raise HTTPException(502, str(e))

    campaign_id = meta_store.save_campaign(
        business_id, draft_id, result, result["name"], result["objective"],
        result["daily_budget_inr"], dry_run=config.META_DRY_RUN,
    )
    approval_store.mark_launched(draft_id)

    return {
        "campaign_id": campaign_id,
        "meta_campaign_id": result["campaign_id"],
        "status": "live" if not config.META_DRY_RUN else "live (simulated — DRY_RUN mode)",
        "dry_run": config.META_DRY_RUN,
    }


@router.get("/campaigns")
def list_campaigns(business_id: str, user: CurrentUser = Depends(get_current_user)):
    assert_business_access(business_id, user)
    return meta_store.list_campaigns(business_id)
