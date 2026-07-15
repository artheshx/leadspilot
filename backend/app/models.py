from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class BrandKit(BaseModel):
    business_name: str
    logo_path: Optional[str] = None       # path to uploaded logo (PNG w/ transparency preferred)
    primary_color: str = "#111111"        # hex
    secondary_color: str = "#FFFFFF"       # hex


class StrategyInput(BaseModel):
    business_id: str
    business_prompt: str = Field(..., min_length=10, description="One-liner business description from the user")


class StrategyOutput(BaseModel):
    """Structured campaign strategy — the AI's output must match this exactly."""
    business_type: str
    target_audience: str
    goal: str                              # e.g. "lead generation", "sales", "awareness"
    budget_suggestion_inr: int
    tone: str                              # e.g. "friendly", "premium", "urgent"
    creative_direction: str                # short visual description for image-gen prompt
    landing_page_type: str                 # e.g. "lead-gen-local-service", "ecommerce-product"
    kpis: List[str]

    @field_validator("budget_suggestion_inr")
    @classmethod
    def budget_must_be_reasonable(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("budget_suggestion_inr must be > 0")
        if v > 200000:
            # Safety cap — never let the AI suggest an absurd budget by mistake.
            raise ValueError("budget_suggestion_inr exceeds safety cap (200000)")
        return v


class CreativeRequest(BaseModel):
    business_id: str
    strategy: StrategyOutput
    brand: BrandKit


class CreativeOutput(BaseModel):
    image_path: str
    headline: str
    primary_text: str
    cta: str


# ---------------------------------------------------------------------------
# Phase 5 — Landing Page Engine
# ---------------------------------------------------------------------------

ALLOWED_LANDING_PAGE_TEMPLATES = (
    "lead-gen-local-service",
    "ecommerce-product",
    "coaching-signup",
    "generic",
)


class LandingPageRequest(BaseModel):
    business_id: str
    strategy: StrategyOutput
    brand: BrandKit
    draft_id: Optional[str] = None  # link back to the approval draft, if one exists yet


class LandingPageContent(BaseModel):
    """AI-filled copy for whichever template gets selected."""
    headline: str
    subheadline: str
    offer: str
    bullets: List[str] = Field(default_factory=list)
    cta: str
    form_fields: List[str] = Field(default_factory=list)

    @field_validator("bullets")
    @classmethod
    def cap_bullets(cls, v: List[str]) -> List[str]:
        return v[:5]

    @field_validator("form_fields")
    @classmethod
    def default_form_fields(cls, v: List[str]) -> List[str]:
        return v[:6] if v else ["Name", "Phone Number"]


class LandingPageOutput(BaseModel):
    template_id: str
    content: LandingPageContent
    published_url: Optional[str] = None
    status: str = "draft"  # draft / published


# ---------------------------------------------------------------------------
# Phase 6 — Monitoring + Recommendation Engine
# ---------------------------------------------------------------------------

class PerformanceLog(BaseModel):
    campaign_id: str
    date: str
    impressions: int
    clicks: int
    ctr: float
    cpc: float
    spend: float
    conversions: int


ALLOWED_RECOMMENDATION_TYPES = (
    "pause_creative",
    "increase_budget",
    "decrease_budget",
    "change_targeting",
    "no_action",
)


class RecommendationOutput(BaseModel):
    """The AI's plain-language read on recent performance vs. the campaign's goals."""
    type: str
    reasoning: str
    suggested_change: Dict[str, Any] = Field(default_factory=dict)
    confidence: str = "medium"  # low / medium / high

    @field_validator("type")
    @classmethod
    def type_must_be_known(cls, v: str) -> str:
        if v not in ALLOWED_RECOMMENDATION_TYPES:
            raise ValueError(f"type must be one of {ALLOWED_RECOMMENDATION_TYPES}, got '{v}'")
        return v

    @field_validator("confidence")
    @classmethod
    def confidence_must_be_known(cls, v: str) -> str:
        if v not in ("low", "medium", "high"):
            raise ValueError("confidence must be one of low/medium/high")
        return v


# ---------------------------------------------------------------------------
# Phase 7 — Support Escalation
# ---------------------------------------------------------------------------

ALLOWED_ISSUE_TYPES = ("api_error", "low_confidence_ai", "user_flagged")


class SupportTicketCreate(BaseModel):
    business_id: str
    campaign_id: Optional[str] = None
    issue_type: str = "user_flagged"
    description: str = Field(..., min_length=3)

    @field_validator("issue_type")
    @classmethod
    def issue_type_must_be_known(cls, v: str) -> str:
        if v not in ALLOWED_ISSUE_TYPES:
            raise ValueError(f"issue_type must be one of {ALLOWED_ISSUE_TYPES}")
        return v


# ---------------------------------------------------------------------------
# AI Manager architecture — Business Analysis Tool + Compliance Tool outputs
# ---------------------------------------------------------------------------

class BusinessProfile(BaseModel):
    """Structured read on a business, produced by the Business Analysis Tool
    and persisted via the Memory Tool so later turns/tools don't need the
    user to repeat themselves."""
    business_name: Optional[str] = None
    business_type: str
    niche: str
    primary_goal: str
    target_customer: str
    notes: Optional[str] = None


ALLOWED_RISK_LEVELS = ("low", "medium", "high")


class ComplianceResult(BaseModel):
    """Output of the Compliance Tool's policy-risk check on ad/landing copy."""
    risk_level: str = "low"
    issues: List[str] = Field(default_factory=list)
    safer_alternatives: List[str] = Field(default_factory=list)
    rejection_risk_estimate: str = "low"

    @field_validator("risk_level")
    @classmethod
    def risk_level_must_be_known(cls, v: str) -> str:
        if v not in ALLOWED_RISK_LEVELS:
            raise ValueError(f"risk_level must be one of {ALLOWED_RISK_LEVELS}")
        return v
