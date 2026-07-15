from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.models import SupportTicketCreate
from app.db import support_store
from app.auth import get_current_user, assert_business_access, CurrentUser

router = APIRouter(prefix="/support", tags=["support"], dependencies=[Depends(get_current_user)])


@router.post("/tickets")
def create_ticket(payload: SupportTicketCreate, user: CurrentUser = Depends(get_current_user)):
    """User-flagged ticket: 'I'm stuck, something's wrong, help.'
    (Auto-escalated tickets from other modules go through support_service.escalate
    directly rather than this HTTP endpoint.)"""
    assert_business_access(payload.business_id, user)
    ticket_id = support_store.create_ticket(
        payload.business_id, payload.issue_type, payload.description, payload.campaign_id
    )
    return {"id": ticket_id, "status": "open"}


@router.get("/tickets")
def list_tickets(business_id: Optional[str] = None, status: Optional[str] = None,
                  user: CurrentUser = Depends(get_current_user)):
    # Omitting business_id lists every ticket across every business — that's
    # a support-team inbox view, so it requires admin. A regular client must
    # always scope to their own business_id.
    if business_id:
        assert_business_access(business_id, user)
    elif user.role != "admin":
        raise HTTPException(403, "business_id is required unless you're an admin.")
    return support_store.list_tickets(business_id, status)


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str, user: CurrentUser = Depends(get_current_user)):
    ticket = support_store.get_ticket(ticket_id)
    if ticket is None:
        raise HTTPException(404, f"No such ticket: {ticket_id}")
    assert_business_access(ticket["business_id"], user)
    return ticket


class TicketStatusUpdate(BaseModel):
    status: str = "resolved"


@router.post("/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: str, user: CurrentUser = Depends(get_current_user)):
    ticket = support_store.get_ticket(ticket_id)
    if ticket is None:
        raise HTTPException(404, f"No such ticket: {ticket_id}")
    assert_business_access(ticket["business_id"], user)
    try:
        return support_store.update_status(ticket_id, "resolved")
    except LookupError as e:
        raise HTTPException(404, str(e))


@router.post("/tickets/{ticket_id}/status")
def set_ticket_status(ticket_id: str, payload: TicketStatusUpdate, user: CurrentUser = Depends(get_current_user)):
    """Internal support-team action to move a ticket to in_progress, etc."""
    ticket = support_store.get_ticket(ticket_id)
    if ticket is None:
        raise HTTPException(404, f"No such ticket: {ticket_id}")
    assert_business_access(ticket["business_id"], user)
    try:
        return support_store.update_status(ticket_id, payload.status)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
