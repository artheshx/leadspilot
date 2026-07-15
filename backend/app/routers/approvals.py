from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db import approval_store
from app.models import StrategyOutput, CreativeOutput, LandingPageOutput
from app.auth import get_current_user, require_business_access, assert_business_access, CurrentUser

# NOTE: these fine-grained endpoints are for internal/admin tooling only.
# The frontend never calls them directly — it only ever calls
# POST /manager/chat, and the AI Manager calls into these tools internally
# via the Tool Registry. Every route also enforces that the caller owns the
# business_id involved (or is an admin), same as /manager/chat does.
router = APIRouter(prefix="/approvals", tags=["approvals"], dependencies=[Depends(get_current_user)])


class DraftCreateRequest(BaseModel):
    business_id: str
    strategy: StrategyOutput
    creative: CreativeOutput
    landing_page: Optional[LandingPageOutput] = None


class DecisionRequest(BaseModel):
    decided_by: str                 # business owner's name/email — who is approving
    reason: Optional[str] = None    # optional note, required in practice for rejections


@router.post("/drafts")
def create_draft(payload: DraftCreateRequest, user: CurrentUser = Depends(get_current_user)):
    """Called after Strategy + Creative (+ optionally Landing Page) generation.
    Puts the campaign in front of the human before anything can ever be
    launched — Layer 4 of the architecture."""
    assert_business_access(payload.business_id, user)
    draft_id = approval_store.create_draft(
        payload.business_id,
        payload.strategy.model_dump(),
        payload.creative.model_dump(),
        payload.landing_page.model_dump() if payload.landing_page else None,
    )
    return {"draft_id": draft_id, "status": "pending"}


@router.get("/drafts/pending")
def list_pending(business_id: str, user: CurrentUser = Depends(require_business_access)):
    return approval_store.list_pending_drafts(business_id)


@router.post("/drafts/{draft_id}/approve")
def approve_draft(draft_id: str, payload: DecisionRequest, user: CurrentUser = Depends(get_current_user)):
    draft = approval_store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(404, f"No such draft: {draft_id}")
    assert_business_access(draft["business_id"], user)
    try:
        return approval_store.record_decision(draft_id, "approved", payload.decided_by, payload.reason)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except PermissionError as e:
        raise HTTPException(409, str(e))


@router.post("/drafts/{draft_id}/reject")
def reject_draft(draft_id: str, payload: DecisionRequest, user: CurrentUser = Depends(get_current_user)):
    draft = approval_store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(404, f"No such draft: {draft_id}")
    assert_business_access(draft["business_id"], user)
    try:
        return approval_store.record_decision(draft_id, "rejected", payload.decided_by, payload.reason)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except PermissionError as e:
        raise HTTPException(409, str(e))


@router.get("/history")
def audit_history(business_id: str, user: CurrentUser = Depends(require_business_access)):
    return approval_store.get_audit_history(business_id)
