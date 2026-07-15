from app.db import support_store
from app.services import support_service
from app.tools.base import Tool


def escalate(business_id: str, issue_type: str, description: str, campaign_id: str = None):
    """Direct helper (not the Tool.run path) used by the AI Manager itself to
    auto-escalate when a tool call fails repeatedly — best-effort, never raises."""
    return support_service.escalate(business_id, issue_type, description, campaign_id)


def _run(business_id: str, action: str = "escalate", **kwargs) -> dict:
    if action == "escalate":
        description = kwargs.get("description") or "User requested help."
        issue_type = kwargs.get("issue_type", "user_flagged")
        ticket_id = escalate(business_id, issue_type, description, kwargs.get("campaign_id"))
        return {"ticket_id": ticket_id, "status": "open" if ticket_id else "failed_to_log"}

    if action == "list_tickets":
        return {"tickets": support_store.list_tickets(business_id)}

    raise ValueError(f"Unknown support_tool action '{action}'. Supported: escalate, list_tickets.")


TOOL = Tool(
    name="support_tool",
    description=(
        "Answers troubleshooting questions and escalates issues to human support when the AI "
        "can't resolve something itself. actions: 'escalate' (issue_type: "
        "api_error|low_confidence_ai|user_flagged, description: string, campaign_id: optional), "
        "'list_tickets'. Use this when the user explicitly asks for human help, or after a tool "
        "has failed more than once for the same request."
    ),
    args_schema={
        "action": "escalate|list_tickets (string)",
        "description": "what went wrong / what the user needs help with (string)",
        "issue_type": "api_error|low_confidence_ai|user_flagged (string)",
    },
    handler=_run,
)
