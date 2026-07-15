"""
Meta Ads Tool — the single point of contact between the AI Manager and the
Meta Marketing API.

GOLDEN RULE (unchanged from the original architecture, just centralized
here): no action that changes a business's Meta Ads account executes without
an explicit, logged human approval.

Three approval paths, reusing the app's existing gates wherever they already
exist rather than inventing a fourth:
  1. Initial campaign launch -> campaign_drafts / approval_store
     (action='stage_campaign' then action='approve_and_launch')
  2. Performance-driven changes -> recommendations / recommendation_store
     (produced by analytics_tool; action='apply_recommendation' here applies one)
  3. Everything else that mutates the account (pixel creation, a pause or
     budget change requested directly in chat, deletion) -> the generic
     pending_action_store (action='<mutating action>' stages it,
     action='confirm_pending_action' executes it)

The AI Manager must only call the "approve_and_launch" / "apply_recommendation" /
"confirm_pending_action" actions after the user's latest message is an
unambiguous approval. Staging is always safe and reversible; execution is not.
"""
from app.db import approval_store, meta_store, pending_action_store, recommendation_store
from app.services import meta_ads_service
from app.tools.base import Tool

READ_ONLY_ACTIONS = {"get_oauth_url", "get_ad_accounts", "get_pixels", "list_campaigns", "get_insights"}
DIRECT_STAGE_ACTIONS = {"create_pixel", "pause_campaign", "update_budget", "delete_campaign"}


def _account(business_id: str) -> dict:
    account = meta_store.get_meta_account(business_id)
    if account is None:
        raise LookupError(
            f"No Meta Ad Account connected for business_id={business_id}. "
            f"Use action='get_oauth_url' to get a connection link for the user first."
        )
    return account


def _run(business_id: str, action: str = "list_campaigns", **kwargs) -> dict:
    if action == "get_oauth_url":
        return {"oauth_url": meta_ads_service.build_oauth_url(state=business_id)}

    if action == "get_ad_accounts":
        account = _account(business_id)
        return {"ad_accounts": meta_ads_service.get_ad_accounts(account["access_token"])}

    if action == "get_pixels":
        account = _account(business_id)
        return {"pixels": meta_ads_service.get_pixels(account["access_token"], account["ad_account_id"])}

    if action == "list_campaigns":
        return {"campaigns": meta_store.list_campaigns(business_id)}

    if action == "get_insights":
        campaign_id = kwargs.get("campaign_id")
        if not campaign_id:
            raise ValueError("campaign_id is required for action='get_insights'.")
        campaign = meta_store.get_campaign(campaign_id)
        if campaign is None:
            raise LookupError(f"No such campaign: {campaign_id}")
        account = _account(business_id)
        return {"insights": meta_ads_service.get_insights(account["access_token"], campaign["meta_campaign_id"])}

    if action == "stage_campaign":
        return _stage_campaign(business_id, kwargs)

    if action == "approve_and_launch":
        return _approve_and_launch(business_id, kwargs)

    if action == "apply_recommendation":
        return _apply_recommendation(business_id, kwargs)

    if action in DIRECT_STAGE_ACTIONS:
        return _stage_pending_action(business_id, action, kwargs)

    if action == "confirm_pending_action":
        return _confirm_pending_action(business_id, kwargs)

    raise ValueError(
        f"Unknown meta_ads_tool action '{action}'. Supported: "
        f"{sorted(READ_ONLY_ACTIONS | DIRECT_STAGE_ACTIONS | {'stage_campaign', 'approve_and_launch', 'apply_recommendation', 'confirm_pending_action'})}"
    )


# ---------------------------------------------------------------------------
# Path 1: initial campaign launch (campaign_drafts)
# ---------------------------------------------------------------------------

def _stage_campaign(business_id: str, kwargs: dict) -> dict:
    strategy = kwargs.get("strategy")
    creative = kwargs.get("creative")
    landing_page = kwargs.get("landing_page")
    if not strategy or not creative:
        raise ValueError("strategy and creative are required to stage a campaign for approval.")
    draft_id = approval_store.create_draft(business_id, strategy, creative, landing_page)
    return {
        "draft_id": draft_id,
        "status": "awaiting_approval",
        "summary": f"Campaign draft staged (budget ₹{strategy.get('budget_suggestion_inr')}/mo, "
                   f"goal: {strategy.get('goal')}). Ask the user to confirm before launching.",
    }


def _approve_and_launch(business_id: str, kwargs: dict) -> dict:
    """Only call this once the user's latest message is an explicit approval."""
    draft_id = kwargs.get("draft_id")
    decided_by = kwargs.get("decided_by") or "user (chat)"
    if not draft_id:
        raise ValueError("draft_id is required for action='approve_and_launch'.")

    approval_store.record_decision(draft_id, "approved", decided_by)

    draft = approval_store.get_draft(draft_id)
    if meta_store.campaign_already_launched_for_draft(draft_id):
        raise PermissionError("This draft has already been launched.")

    account = _account(business_id)
    result = meta_ads_service.launch_campaign(
        account["access_token"], account["ad_account_id"], draft["strategy"], draft["creative"]
    )
    campaign_id = meta_store.save_campaign(
        business_id, draft_id, result, result["name"], result["objective"],
        result["daily_budget_inr"], dry_run=True,
    )
    approval_store.mark_launched(draft_id)
    return {"campaign_id": campaign_id, "meta_campaign_id": result["campaign_id"], "status": "live"}


# ---------------------------------------------------------------------------
# Path 2: performance-driven changes (recommendations)
# ---------------------------------------------------------------------------

def _apply_recommendation(business_id: str, kwargs: dict) -> dict:
    """Only call this once the user's latest message is an explicit approval
    of a recommendation surfaced via analytics_tool action='get_recommendation'."""
    rec_id = kwargs.get("recommendation_id") or kwargs.get("rec_id")
    decided_by = kwargs.get("decided_by") or "user (chat)"
    if not rec_id:
        raise ValueError("recommendation_id is required for action='apply_recommendation'.")

    recommendation_store.record_decision(rec_id, "approved", decided_by)
    rec = recommendation_store.get_recommendation(rec_id)
    campaign = meta_store.get_campaign(rec["campaign_id"])
    if campaign is None:
        raise LookupError(f"No such campaign: {rec['campaign_id']}")
    account = _account(business_id)

    result = _apply_change(rec, campaign, account["access_token"])
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
    return {"note": f"'{rec_type}' is logged as approved but has no automated apply step in this build yet"}


# ---------------------------------------------------------------------------
# Path 3: everything else that mutates the account (pending_action_store)
# ---------------------------------------------------------------------------

def _stage_pending_action(business_id: str, action: str, kwargs: dict) -> dict:
    descriptions = {
        "create_pixel": lambda a: f"Create a new Meta Pixel named '{a.get('name', 'LeadsPilot Pixel')}'.",
        "pause_campaign": lambda a: f"Pause campaign {a.get('campaign_id')}.",
        "update_budget": lambda a: f"Change daily budget of campaign {a.get('campaign_id')} to ₹{a.get('new_daily_budget_inr')}.",
        "delete_campaign": lambda a: f"Permanently delete campaign {a.get('campaign_id')}.",
    }
    description = descriptions[action](kwargs)
    pending_id = pending_action_store.create(business_id, "meta_ads_tool", action, kwargs, description)
    return {
        "pending_action_id": pending_id,
        "status": "awaiting_approval",
        "description": description,
        "note": "Present this to the user and only call action='confirm_pending_action' after they explicitly approve.",
    }


def _confirm_pending_action(business_id: str, kwargs: dict) -> dict:
    pending_id = kwargs.get("pending_action_id")
    if not pending_id:
        raise ValueError("pending_action_id is required for action='confirm_pending_action'.")

    pending_action_store.record_decision(pending_id, "approved")
    pending = pending_action_store.get(pending_id)
    if pending["business_id"] != business_id:
        raise PermissionError("This pending action does not belong to this business.")

    account = _account(business_id)
    args = pending["args"]
    inner_action = pending["action"]

    if inner_action == "create_pixel":
        result = meta_ads_service.create_pixel(account["access_token"], account["ad_account_id"],
                                                args.get("name", "LeadsPilot Pixel"))
    elif inner_action == "pause_campaign":
        campaign = meta_store.get_campaign(args["campaign_id"])
        if campaign is None:
            raise LookupError(f"No such campaign: {args['campaign_id']}")
        result = meta_ads_service.pause_campaign(account["access_token"], campaign["meta_campaign_id"])
    elif inner_action == "update_budget":
        campaign = meta_store.get_campaign(args["campaign_id"])
        if campaign is None:
            raise LookupError(f"No such campaign: {args['campaign_id']}")
        result = meta_ads_service.update_adset_daily_budget(
            account["access_token"], campaign["meta_adset_id"], args["new_daily_budget_inr"]
        )
    elif inner_action == "delete_campaign":
        campaign = meta_store.get_campaign(args["campaign_id"])
        if campaign is None:
            raise LookupError(f"No such campaign: {args['campaign_id']}")
        result = meta_ads_service.delete_campaign(account["access_token"], campaign["meta_campaign_id"])
    else:
        raise ValueError(f"Don't know how to execute pending action of type '{inner_action}'.")

    pending_action_store.mark_executed(pending_id, result)
    return {"pending_action_id": pending_id, "status": "executed", "result": result}


TOOL = Tool(
    name="meta_ads_tool",
    description=(
        "The only tool that talks to the Meta Marketing API. Read actions run immediately: "
        "'get_oauth_url', 'get_ad_accounts', 'get_pixels', 'list_campaigns', "
        "'get_insights' (campaign_id). Write actions never execute immediately — they stage "
        "first and only run after an explicit user approval in a later turn: "
        "'stage_campaign' (strategy, creative, landing_page) -> then 'approve_and_launch' "
        "(draft_id, decided_by); 'apply_recommendation' (recommendation_id, decided_by) applies an "
        "already-generated recommendation from analytics_tool; 'create_pixel' (name), "
        "'pause_campaign' (campaign_id), 'update_budget' (campaign_id, new_daily_budget_inr), "
        "'delete_campaign' (campaign_id) each stage a pending action -> then "
        "'confirm_pending_action' (pending_action_id) executes it. NEVER call an "
        "approve/apply/confirm action unless the user's most recent message clearly says yes."
    ),
    args_schema={
        "action": (
            "get_oauth_url|get_ad_accounts|get_pixels|list_campaigns|get_insights|stage_campaign|"
            "approve_and_launch|apply_recommendation|create_pixel|pause_campaign|update_budget|"
            "delete_campaign|confirm_pending_action (string)"
        ),
    },
    requires_approval=True,
    handler=_run,
)
