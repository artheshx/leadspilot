from app.services import compliance_service
from app.tools.base import Tool


def _run(business_id: str, headline: str = "", primary_text: str = "", cta: str = "",
         landing_page_copy: str = "", **_kwargs) -> dict:
    fields = {
        "headline": headline,
        "primary_text": primary_text,
        "cta": cta,
        "landing_page_copy": landing_page_copy,
    }
    result = compliance_service.check_compliance(fields)
    return {"compliance": result.model_dump()}


TOOL = Tool(
    name="compliance_tool",
    description=(
        "Checks ad copy and/or landing page copy against Meta Ads policy risk areas before a "
        "campaign is staged for launch. Returns risk_level, specific issues, safer rewritten "
        "alternatives, and a rejection risk estimate. Run this on the creative/landing page output "
        "before staging a campaign for approval."
    ),
    args_schema={
        "headline": "ad headline text, if available (string)",
        "primary_text": "ad primary text, if available (string)",
        "cta": "call to action text, if available (string)",
        "landing_page_copy": "landing page headline/subheadline/offer/bullets concatenated, if available (string)",
    },
    handler=_run,
)
