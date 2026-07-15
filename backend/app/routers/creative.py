from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.models import CreativeRequest, CreativeOutput
from app.services import creative_service, support_service
from app.services.creative_service import CreativeError
from app.services.llm_service import LLMError

from fastapi import Depends
from app.auth import get_current_user, assert_business_access, CurrentUser

router = APIRouter(prefix="/creative", tags=["creative"], dependencies=[Depends(get_current_user)])


@router.post("/generate", response_model=CreativeOutput)
def generate_creative(payload: CreativeRequest, user: CurrentUser = Depends(get_current_user)):
    assert_business_access(payload.business_id, user)
    try:
        return creative_service.generate_creative(payload.strategy, payload.brand)
    except CreativeError as e:
        support_service.escalate(payload.business_id, "api_error", str(e))
        raise HTTPException(502, str(e))
    except LLMError as e:
        support_service.escalate(payload.business_id, "api_error", str(e))
        raise HTTPException(503, str(e))


@router.get("/preview/{filename}")
def preview_image(filename: str):
    import os
    from app import config
    path = os.path.join(config.GENERATED_IMAGES_PATH, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Creative not found")
    return FileResponse(path, media_type="image/png")
