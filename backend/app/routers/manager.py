from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.manager import ai_manager
from app.auth import get_current_user, CurrentUser
from app.rate_limit import check_rate_limit

router = APIRouter(prefix="/manager", tags=["ai-manager"])


class ChatRequest(BaseModel):
    business_id: str
    message: str = Field(..., min_length=1)
    debug: bool = False  # include the tool-call trace in the response


@router.post("/chat")
def chat(payload: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    """
    Single entrypoint for the LeadPilot AI Manager (the Brain) — and the
    ONLY AI Manager endpoint the dashboard frontend calls. The Manager
    decides internally which tool(s) - Business Analysis, Strategy, Creative,
    Landing Page, Meta Ads, Analytics, Knowledge, Memory, Compliance,
    Support - to use for this message, runs them, and returns one final
    response. All existing phase-specific endpoints (/strategy, /creative,
    /meta, /monitoring, ...) still work for internal/admin use, but the
    frontend never calls them directly - every dashboard AI action goes
    through this one endpoint, and only the Manager decides which tool runs.

    business_id must equal the caller's own Supabase user id, unless the
    caller is an admin - this is what stops one client from ever running
    the Manager against another client's business data.
    """
    if user.role != "admin" and payload.business_id != user.id:
        raise HTTPException(403, "You may only chat with the AI Manager about your own business account.")
    check_rate_limit(f"manager_chat:{user.id}")
    try:
        result = ai_manager.run_turn(payload.business_id, payload.message, include_trace=payload.debug)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return result.to_dict()
