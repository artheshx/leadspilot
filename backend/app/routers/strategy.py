from fastapi import APIRouter, HTTPException

from app.models import StrategyInput, StrategyOutput
from app.services import strategy_service, support_service
from app.services.llm_service import LLMError

from fastapi import Depends
from app.auth import get_current_user, assert_business_access, CurrentUser

router = APIRouter(prefix="/strategy", tags=["strategy"], dependencies=[Depends(get_current_user)])


@router.post("/generate", response_model=StrategyOutput)
def generate_strategy(payload: StrategyInput, user: CurrentUser = Depends(get_current_user)):
    assert_business_access(payload.business_id, user)
    try:
        return strategy_service.generate_strategy(payload.business_id, payload.business_prompt)
    except LLMError as e:
        support_service.escalate(payload.business_id, "api_error", str(e))
        raise HTTPException(503, str(e))
    except ValueError as e:
        support_service.escalate(payload.business_id, "low_confidence_ai", str(e))
        raise HTTPException(422, str(e))
