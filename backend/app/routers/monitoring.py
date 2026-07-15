from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db import meta_store, performance_store, recommendation_store, approval_store
from app.services import monitoring_service, recommendation_service, meta_ads_service, support_service
from app.services.monitoring_service import MonitoringError
from app.services.meta_ads_service import MetaAdsError
from app.services.llm_service import LLMError
from app.auth import get_current_user, require_business_access, assert_business_access, CurrentUser

router = APIRouter(prefix="/monitoring", tags=["monitoring"], dependencies=[Depends(get_current_user)])


def _owned_campaign(campaign_id: str, user: CurrentUser) -> dict:
    campaign = meta_store.get_campaign(campaign_id)
    if campaign is None:
        raise HTTPException(404, f"No such campaign: {campaign_id}")
    assert_business_access(campaign["business_id"], user)
    return campaign


@router.post("/pull/{campaign_id}")
def pull_performance(campaign_id: str, user: CurrentUser = Depends(get_current_user)):
    """Scheduled (or manually triggered) pull of yesterday's Meta Insights for
    one campaign. Stored append-only in performance_logs."""
    _owned_campaign(campaign_id, user)
    try:
        return monitoring_service.pull_and_store(campaign_id)
    except MonitoringError as e:
        raise HTTPException(404, str(e))


@router.get("/performance/{campaign_id}")
def get_performance(campaign_id: str, limit: int = 30, user: CurrentUser = Depends(get_current_user)):
    _owned_campaign(campaign_id, user)
    return performance_store.list_logs(campaign_id, limit)


@router.post("/recommend/{campaign_id}")
def request_recommendation(campaign_id: str, user: CurrentUser = Depends(get_current_user)):
    """Runs the Recommendation Engine against a campaign's stored performance
    logs + its original strategy. Result is stored as 'pending' — it can only
    ever be acted on after Approval Gate #2 (see /approve, /reject, /apply below)."""
    campaign = _owned_campaign(campaign_id, user)

    draft = approval_store.get_draft(campaign["draft_id"])
    if draft is None:
        raise HTTPException(404, "Could not find the originating strategy for this campaign.")

    logs = performance_store.list_logs(campaign_id, limit=14)
    if not logs:
        raise HTTPException(
            400, "No performance data yet for this campaign — call /monitoring/pull/{campaign_id} first."
        )

    try:
        rec = recommendation_service.generate_recommendation(draft["strategy"], logs)
    except LLMError as e:
        support_service.escalate(campaign["business_id"], "api_error", str(e), campaign_id)
        raise HTTPException(503, str(e))
    except ValueError as e:
        support_service.escalate(campaign["business_id"], "low_confidence_ai", str(e), campaign_id)
        raise HTTPException(422, str(e))

    rec_id = recommendation_store.create_recommendation(campaign_id, campaign["business_id"], rec.model_dump())
    return {"id": rec_id, "status": "pending", **rec.model_dump()}


@router.get("/recommendations/pending")
def list_pending_recommendations(business_id: str, user: CurrentUser = Depends(require_business_access)):
    return recommendation_store.list_pending(business_id)


class RecommendationDecision(BaseModel):
    decided_by: str
    reason: Optional[str] = None


def _owned_recommendation(rec_id: str, user: CurrentUser) -> dict:
    rec = recommendation_store.get_recommendation(rec_id)
    if rec is None:
        raise HTTPException(404, f"No such recommendation: {rec_id}")
    assert_business_access(rec["business_id"], user)
    return rec


@router.post("/recommendations/{rec_id}/approve")
def approve_recommendation(rec_id: str, payload: RecommendationDecision, user: CurrentUser = Depends(get_current_user)):
    """Approval Gate #2. Approving does NOT apply the change yet — that's a
    separate explicit call to /apply, so a mis-click can't silently touch spend."""
    _owned_recommendation(rec_id, user)
    try:
        return recommendation_store.record_decision(rec_id, "approved", payload.decided_by, payload.reason)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except PermissionError as e:
        raise HTTPException(409, str(e))


@router.post("/recommendations/{rec_id}/reject")
def reject_recommendation(rec_id: str, payload: RecommendationDecision, user: CurrentUser = Depends(get_current_user)):
    _owned_recommendation(rec_id, user)
    try:
        return recommendation_store.record_decision(rec_id, "rejected", payload.decided_by, payload.reason)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except PermissionError as e:
        raise HTTPException(409, str(e))


class ApplyRequest(BaseModel):
    applied_by: str


@router.post("/recommendations/{rec_id}/apply")
def apply_recommendation(rec_id: str, payload: ApplyRequest, user: CurrentUser = Depends(get_current_user)):
    """
    THE gated write-action for Approval Gate #2. Fires only if:
    1) The recommendation exists, belongs to the caller's business, and its status is exactly 'approved'
    2) It hasn't already been applied (mark_applied refuses otherwise)
    A Meta API failure here auto-escalates a support ticket rather than
    leaving the business owner stuck with a mystery error.
    """
    rec = _owned_recommendation(rec_id, user)
    if rec["status"] != "approved":
        raise HTTPException(
            409,
            f"Recommendation status is '{rec['status']}', not 'approved'. "
            f"A recommendation can only be applied after it has been approved.",
        )

    campaign = meta_store.get_campaign(rec["campaign_id"])
    if campaign is None:
        raise HTTPException(404, f"No such campaign: {rec['campaign_id']}")
    meta_account = meta_store.get_meta_account(rec["business_id"])
    if meta_account is None:
        raise HTTPException(400, f"No Meta account connected for business_id={rec['business_id']}")

    try:
        result = _apply_change(rec, campaign, meta_account["access_token"])
    except MetaAdsError as e:
        support_service.escalate(rec["business_id"], "api_error", str(e), rec["campaign_id"])
        raise HTTPException(502, str(e))

    recommendation_store.mark_applied(rec_id)
    return {"recommendation_id": rec_id, "status": "applied", "result": result}


def _apply_change(rec: dict, campaign: dict, access_token: str) -> dict:
    rec_type = rec["type"]
    if rec_type == "pause_creative":
        return meta_ads_service.pause_campaign(access_token, campaign["meta_campaign_id"])
    if rec_type in ("increase_budget", "decrease_budget"):
        new_budget = rec["suggested_change"].get("new_daily_budget_inr") or campaign["budget_daily_inr"]
        return meta_ads_service.update_adset_daily_budget(access_token, campaign["meta_adset_id"], new_budget)
    if rec_type == "no_action":
        return {"note": "no_action recommendations require no Meta API call"}
    # change_targeting: MVP has no dedicated Graph API call wired up yet — log it as applied-in-principle
    # rather than silently failing, since targeting edits need a fuller targeting-spec UI first.
    return {"note": f"'{rec_type}' is logged as approved but has no automated apply step in this build yet"}
