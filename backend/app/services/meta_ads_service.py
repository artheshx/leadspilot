"""
Meta Marketing API (Graph API) integration.

IMPORTANT — DRY RUN MODE:
config.META_DRY_RUN defaults to True. In that mode, no real HTTP calls are made
to Meta at all — every function returns a realistic simulated response instead.
This lets you test the ENTIRE launch flow (approval → launch → campaign record)
before you have META_APP_ID/SECRET or App Review approval for `ads_management`.

Flip META_DRY_RUN=false in .env only once you have both.
"""
import time
import uuid
import urllib.parse

import requests

from app import config


class MetaAdsError(Exception):
    pass


def build_oauth_url(state: str) -> str:
    """URL to redirect the business owner to, to connect their Meta Ad Account."""
    params = {
        "client_id": config.META_APP_ID,
        "redirect_uri": config.META_REDIRECT_URI,
        "state": state,
        "scope": "ads_management,ads_read,business_management",
    }
    return f"https://www.facebook.com/{config.META_API_VERSION}/dialog/oauth?{urllib.parse.urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    """Exchange an OAuth code for a long-lived access token."""
    if config.META_DRY_RUN:
        return {"access_token": f"dryrun_token_{uuid.uuid4().hex[:12]}", "token_type": "bearer", "expires_in": 5184000}

    if not config.META_APP_ID or not config.META_APP_SECRET:
        raise MetaAdsError("META_APP_ID / META_APP_SECRET not set in .env — cannot exchange code for a real token.")

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/oauth/access_token"
    params = {
        "client_id": config.META_APP_ID,
        "client_secret": config.META_APP_SECRET,
        "redirect_uri": config.META_REDIRECT_URI,
        "code": code,
    }
    resp = _get(url, params)
    return resp


def get_ad_accounts(access_token: str) -> list:
    """List ad accounts this token has access to (so the user can pick one)."""
    if config.META_DRY_RUN:
        return [{"id": "act_1234567890", "name": "Sweet Treats Bakery (Simulated Ad Account)", "account_status": 1}]

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/me/adaccounts"
    resp = _get(url, {"access_token": access_token, "fields": "id,name,account_status"})
    return resp.get("data", [])


def create_campaign(access_token: str, ad_account_id: str, name: str, objective: str) -> str:
    if config.META_DRY_RUN:
        return f"dryrun_campaign_{uuid.uuid4().hex[:10]}"

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{ad_account_id}/campaigns"
    payload = {
        "access_token": access_token,
        "name": name,
        "objective": objective,
        "status": "PAUSED",  # created paused; a separate explicit step flips it live
        "special_ad_categories": "[]",
    }
    resp = _post(url, payload)
    return resp["id"]


def create_adset(access_token: str, ad_account_id: str, campaign_id: str, name: str,
                  daily_budget_paise: int, targeting: dict) -> str:
    if config.META_DRY_RUN:
        return f"dryrun_adset_{uuid.uuid4().hex[:10]}"

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{ad_account_id}/adsets"
    payload = {
        "access_token": access_token,
        "name": name,
        "campaign_id": campaign_id,
        "daily_budget": daily_budget_paise,
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "LEAD_GENERATION",
        "targeting": targeting,
        "status": "PAUSED",
    }
    resp = _post(url, payload)
    return resp["id"]


def create_ad(access_token: str, ad_account_id: str, adset_id: str, name: str, creative_id: str) -> str:
    if config.META_DRY_RUN:
        return f"dryrun_ad_{uuid.uuid4().hex[:10]}"

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{ad_account_id}/ads"
    payload = {
        "access_token": access_token,
        "name": name,
        "adset_id": adset_id,
        "creative": {"creative_id": creative_id},
        "status": "PAUSED",
    }
    resp = _post(url, payload)
    return resp["id"]


def launch_campaign(access_token: str, ad_account_id: str, strategy: dict, creative: dict) -> dict:
    """
    Orchestrates Campaign -> AdSet -> Ad creation.
    Safety: re-checks the budget cap here too (defense in depth — even if a bad
    value somehow slipped past the StrategyOutput validator, it cannot launch).
    Campaigns are created PAUSED — going properly live is a deliberate extra
    action, never an automatic side-effect of approval.
    """
    monthly_budget = strategy["budget_suggestion_inr"]
    if monthly_budget > config.META_MAX_MONTHLY_BUDGET_INR:
        raise MetaAdsError(
            f"Refusing to launch: budget {monthly_budget} exceeds safety cap "
            f"{config.META_MAX_MONTHLY_BUDGET_INR}."
        )

    name_base = f"LeadsPilot - {strategy['business_type']}"[:180]
    daily_budget_inr = round(monthly_budget / 30, 2)
    daily_budget_paise = int(daily_budget_inr * 100)  # Meta budgets are in the smallest currency unit

    objective_map = {
        "lead generation": "OUTCOME_LEADS",
        "sales": "OUTCOME_SALES",
        "awareness": "OUTCOME_AWARENESS",
        "store visits": "OUTCOME_TRAFFIC",
    }
    objective = objective_map.get(strategy["goal"], "OUTCOME_LEADS")

    campaign_id = create_campaign(access_token, ad_account_id, f"{name_base} - Campaign", objective)
    adset_id = create_adset(
        access_token, ad_account_id, campaign_id, f"{name_base} - AdSet",
        daily_budget_paise, targeting={"description": strategy["target_audience"]},
    )
    ad_id = create_ad(access_token, ad_account_id, adset_id, f"{name_base} - Ad", creative_id="simulated_creative_id")

    return {
        "campaign_id": campaign_id,
        "adset_id": adset_id,
        "ad_id": ad_id,
        "name": name_base,
        "objective": objective,
        "daily_budget_inr": daily_budget_inr,
    }


def get_pixels(access_token: str, ad_account_id: str) -> list:
    """List Meta Pixels on this ad account (so the Landing Page Tool knows which to inject)."""
    if config.META_DRY_RUN:
        return [{"id": "dryrun_pixel_1234567890", "name": "LeadsPilot Pixel (Simulated)"}]

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{ad_account_id}/adspixels"
    resp = _get(url, {"access_token": access_token, "fields": "id,name"})
    return resp.get("data", [])


def create_pixel(access_token: str, ad_account_id: str, name: str) -> dict:
    """Creates a new Meta Pixel on this ad account. This is a write action —
    callers (meta_ads_tool) must gate it behind explicit user approval."""
    if config.META_DRY_RUN:
        return {"id": f"dryrun_pixel_{uuid.uuid4().hex[:10]}", "name": name}

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{ad_account_id}/adspixels"
    resp = _post(url, {"access_token": access_token, "name": name})
    return {"id": resp["id"], "name": name}


def delete_campaign(access_token: str, meta_campaign_id: str) -> dict:
    """Deletes (archives) a campaign. Write action — callers must gate behind approval."""
    if config.META_DRY_RUN:
        return {"id": meta_campaign_id, "status": "deleted", "dry_run": True}

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{meta_campaign_id}"
    resp = _post(url, {"access_token": access_token, "status": "DELETED"})
    return {"id": meta_campaign_id, "status": "deleted", "dry_run": False, "raw": resp}


def get_insights(access_token: str, meta_campaign_id: str) -> dict:
    """
    Pulls a single day's performance snapshot for a campaign (Monitoring Module,
    Phase 6). In DRY_RUN mode, returns randomized-but-realistic numbers so the
    Recommendation Engine has something to reason over end-to-end without a
    live Meta account.
    """
    if config.META_DRY_RUN:
        import random
        impressions = random.randint(600, 6000)
        ctr = round(random.uniform(0.3, 2.6), 2)
        clicks = max(1, round(impressions * ctr / 100))
        cpc = round(random.uniform(4, 28), 2)
        spend = round(clicks * cpc, 2)
        conversions = random.randint(0, max(1, clicks // 7))
        return {
            "impressions": impressions,
            "clicks": clicks,
            "ctr": ctr,
            "cpc": cpc,
            "spend": spend,
            "conversions": conversions,
        }

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{meta_campaign_id}/insights"
    resp = _get(url, {
        "access_token": access_token,
        "fields": "impressions,clicks,ctr,cpc,spend,actions",
        "date_preset": "yesterday",
    })
    rows = resp.get("data", [])
    if not rows:
        return {"impressions": 0, "clicks": 0, "ctr": 0.0, "cpc": 0.0, "spend": 0.0, "conversions": 0}
    row = rows[0]
    conversions = 0
    for action in row.get("actions", []):
        if action.get("action_type") == "lead":
            conversions = int(action.get("value", 0))
    return {
        "impressions": int(row.get("impressions", 0)),
        "clicks": int(row.get("clicks", 0)),
        "ctr": float(row.get("ctr", 0.0)),
        "cpc": float(row.get("cpc", 0.0)),
        "spend": float(row.get("spend", 0.0)),
        "conversions": conversions,
    }


def pause_campaign(access_token: str, meta_campaign_id: str) -> dict:
    """Applies an approved 'pause_creative'-type recommendation."""
    if config.META_DRY_RUN:
        return {"id": meta_campaign_id, "status": "PAUSED", "dry_run": True}

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{meta_campaign_id}"
    resp = _post(url, {"access_token": access_token, "status": "PAUSED"})
    return {"id": meta_campaign_id, "status": "PAUSED", "dry_run": False, "raw": resp}


def update_adset_daily_budget(access_token: str, meta_adset_id: str, daily_budget_inr: float) -> dict:
    """Applies an approved 'increase_budget'/'decrease_budget' recommendation."""
    daily_budget_paise = int(round(daily_budget_inr * 100))
    if config.META_DRY_RUN:
        return {"id": meta_adset_id, "daily_budget_inr": daily_budget_inr, "dry_run": True}

    url = f"{config.META_GRAPH_BASE_URL}/{config.META_API_VERSION}/{meta_adset_id}"
    resp = _post(url, {"access_token": access_token, "daily_budget": daily_budget_paise})
    return {"id": meta_adset_id, "daily_budget_inr": daily_budget_inr, "dry_run": False, "raw": resp}


def _get(url: str, params: dict) -> dict:
    try:
        resp = requests.get(url, params=params, timeout=30)
        data = resp.json()
    except requests.exceptions.RequestException as e:
        raise MetaAdsError(f"Meta API request failed: {e}") from e
    if "error" in data:
        raise MetaAdsError(f"Meta API error: {data['error']}")
    return data


def _post(url: str, payload: dict) -> dict:
    try:
        resp = requests.post(url, data=payload, timeout=30)
        data = resp.json()
    except requests.exceptions.RequestException as e:
        raise MetaAdsError(f"Meta API request failed: {e}") from e
    if "error" in data:
        raise MetaAdsError(f"Meta API error: {data['error']}")
    return data
