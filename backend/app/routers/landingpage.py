from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse

from app.models import LandingPageRequest, LandingPageOutput
from app.db import landingpage_store
from app.services import landingpage_service
from app.services.landingpage_service import LandingPageError
from app.services.llm_service import LLMError
from app.services import support_service
from app.auth import get_current_user, require_business_access, assert_business_access, CurrentUser

# NOTE: auth is applied per-route here, not at the router level, because
# GET /lp/{page_id} is the actual public landing page — real visitors who
# click through from a live Meta ad land there with no LeadPilot session at
# all. Router-wide auth would 401 every real lead, which defeats the whole
# feature. Every other route here is dashboard/internal-only and stays
# behind login.
router = APIRouter(tags=["landing-page"])


@router.post("/landingpage/generate", dependencies=[Depends(get_current_user)])
def generate_landing_page(payload: LandingPageRequest, user: CurrentUser = Depends(get_current_user)):
    """Template selector + AI content-fill (Layer 3, part 2). Renders a static
    HTML preview and stores a record; nothing is publicly "published" yet."""
    assert_business_access(payload.business_id, user)
    try:
        template_id, content, file_path = landingpage_service.generate_landing_page(payload.strategy, payload.brand)
    except LandingPageError as e:
        support_service.escalate(payload.business_id, "low_confidence_ai", str(e))
        raise HTTPException(502, str(e))
    except LLMError as e:
        support_service.escalate(payload.business_id, "api_error", str(e))
        raise HTTPException(503, str(e))

    page_id = landingpage_store.create_landing_page(
        payload.business_id, template_id, content.model_dump(), file_path, draft_id=payload.draft_id
    )
    return {
        "id": page_id,
        "template_id": template_id,
        "content": content.model_dump(),
        "published_url": f"/lp/{page_id}",
        "status": "draft",
    }


@router.get("/landingpage/{page_id}", dependencies=[Depends(get_current_user)])
def get_landing_page(page_id: str, user: CurrentUser = Depends(get_current_user)):
    page = landingpage_store.get_landing_page(page_id)
    if page is None:
        raise HTTPException(404, f"No such landing page: {page_id}")
    assert_business_access(page["business_id"], user)
    return page


@router.get("/landingpage", tags=["landing-page"])
def list_landing_pages(business_id: str, user: CurrentUser = Depends(require_business_access)):
    return landingpage_store.list_by_business(business_id)


@router.post("/landingpage/{page_id}/publish", dependencies=[Depends(get_current_user)])
def publish_landing_page(page_id: str, user: CurrentUser = Depends(get_current_user)):
    page = landingpage_store.get_landing_page(page_id)
    if page is None:
        raise HTTPException(404, f"No such landing page: {page_id}")
    assert_business_access(page["business_id"], user)
    landingpage_store.mark_published(page_id)
    return {"id": page_id, "status": "published", "published_url": f"/lp/{page_id}"}


@router.get("/lp/{page_id}", response_class=HTMLResponse)
def serve_landing_page(page_id: str):
    """The 'publish mechanism' for this MVP: serves the rendered static HTML.
    Deliberately PUBLIC — no auth dependency — since this is the URL real
    visitors land on after clicking a live Meta ad. Swap for a real
    subdomain/CDN deploy later without touching the render logic."""
    page = landingpage_store.get_landing_page(page_id)
    if page is None:
        raise HTTPException(404, "Landing page not found")
    try:
        with open(page["file_path"], "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        raise HTTPException(404, "Landing page file missing on disk")
