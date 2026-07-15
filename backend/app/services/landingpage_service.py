"""
Landing Page Engine (Layer 3, part 2).

MVP simplification of the TRD's "5-8 Next.js templates" plan: three parameterized
HTML templates (one per `landing_page_type` the Strategy Engine can output) plus
a generic fallback, filled in with AI-generated copy and rendered to a static
HTML file. "Publishing" in this build means serving that file locally at
/lp/{page_id} — swap in a real subdomain/CDN deploy step later without touching
the template-fill logic.
"""
import os
import uuid

from jinja2 import Template
from pydantic import ValidationError

from app import config
from app.models import StrategyOutput, BrandKit, LandingPageContent
from app.services import llm_service

LANDING_PAGES_PATH = os.path.join(config.STORAGE_PATH, "landingpages")


class LandingPageError(Exception):
    pass


# ---------------------------------------------------------------------------
# Templates — one per Strategy Engine landing_page_type, + a generic fallback
# ---------------------------------------------------------------------------

_BASE_STYLE = """
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: 'Inter', system-ui, sans-serif; background:#fafaf8; color:#161616; }
  .hero { background: {{ primary_color }}; color: #fff; padding: 4rem 1.5rem 3rem; text-align:center; }
  .hero img.logo { max-height: 56px; margin-bottom: 1.25rem; }
  .hero h1 { font-size: 2.1rem; margin: 0 0 0.6rem; }
  .hero p.sub { font-size: 1.05rem; opacity: 0.92; max-width: 560px; margin: 0 auto; }
  .offer-banner { background:#111; color:{{ secondary_color }}; text-align:center; padding:0.85rem; font-weight:600; }
  .content { max-width: 640px; margin: 0 auto; padding: 2.5rem 1.5rem; }
  ul.bullets { list-style:none; padding:0; margin: 0 0 2rem; }
  ul.bullets li { padding: 0.6rem 0; border-bottom: 1px solid #eee; }
  ul.bullets li::before { content: "✓ "; color: {{ primary_color }}; font-weight:700; }
  form.leadform { background:#fff; border:1px solid #e5e5e5; border-radius:10px; padding:1.5rem; box-shadow:0 4px 18px rgba(0,0,0,0.05); }
  form.leadform input { width:100%; padding:0.75rem; margin-bottom:0.75rem; border:1px solid #ddd; border-radius:6px; font-size:0.95rem; }
  form.leadform button { width:100%; padding:0.9rem; background:{{ primary_color }}; color:#fff; border:none; border-radius:6px; font-size:1rem; font-weight:600; cursor:pointer; }
  footer { text-align:center; padding:1.5rem; color:#999; font-size:0.8rem; }
</style>
"""

_TEMPLATE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{ business_name }} — {{ headline }}</title>
""" + _BASE_STYLE + """
</head>
<body>
  <div class="hero">
    {% if logo_url %}<img class="logo" src="{{ logo_url }}" alt="{{ business_name }} logo" />{% endif %}
    <h1>{{ headline }}</h1>
    <p class="sub">{{ subheadline }}</p>
  </div>
  <div class="offer-banner">{{ offer }}</div>
  <div class="content">
    <ul class="bullets">
      {% for b in bullets %}<li>{{ b }}</li>{% endfor %}
    </ul>
    <form class="leadform" onsubmit="event.preventDefault(); alert('Thanks! (This is an unpublished preview — no data is actually submitted.)');">
      {% for field in form_fields %}<input type="text" placeholder="{{ field }}" required />{% endfor %}
      <button type="submit">{{ cta }}</button>
    </form>
  </div>
  <footer>Built with LeadsPilot &middot; preview only, not yet published</footer>
</body>
</html>
"""

TEMPLATES = {
    "lead-gen-local-service": _TEMPLATE_HTML,
    "ecommerce-product": _TEMPLATE_HTML,
    "coaching-signup": _TEMPLATE_HTML,
    "generic": _TEMPLATE_HTML,
}
# NOTE: all four currently share one layout with different copy/tone (MVP).
# To give each template a genuinely distinct layout, replace the relevant
# dict entry above with its own HTML string — the render/generate functions
# below don't need to change.


def select_template(strategy: StrategyOutput) -> str:
    """Strategy Engine already names a landing_page_type; fall back to 'generic'
    if it ever names something this build doesn't have a template for."""
    return strategy.landing_page_type if strategy.landing_page_type in TEMPLATES else "generic"


CONTENT_SYSTEM_PROMPT = """You are LeadsPilot's landing page copywriter. Given a campaign \
strategy and brand, produce ONE JSON object — nothing else — with exactly these fields:

{
  "headline": string (bold, benefit-led, max 70 chars),
  "subheadline": string (one supporting sentence, max 140 chars),
  "offer": string (a short punchy line for a banner, e.g. "Flat 20% off this week only"),
  "bullets": array of 3-5 short strings (concrete benefits/features),
  "cta": string (button text, e.g. "Get My Free Quote", "Order Now", "Book a Slot"),
  "form_fields": array of 2-4 short strings (form field labels, e.g. "Name", "Phone Number", "City")
}

Respond with ONLY the JSON object. No prose, no markdown fences."""


def _generate_content(strategy: StrategyOutput, brand: BrandKit, max_validation_retries: int = 2) -> LandingPageContent:
    prompt = (
        f"Business: {brand.business_name}\n"
        f"Business type: {strategy.business_type}\n"
        f"Target audience: {strategy.target_audience}\n"
        f"Goal: {strategy.goal}\n"
        f"Tone: {strategy.tone}\n"
        f"Landing page type: {strategy.landing_page_type}\n"
        f"Creative direction: {strategy.creative_direction}\n"
        f"Produce the JSON landing page content now."
    )

    last_error = None
    for _ in range(max_validation_retries + 1):
        raw_json = llm_service.chat_json(prompt, system=CONTENT_SYSTEM_PROMPT)
        try:
            return LandingPageContent(**raw_json)
        except ValidationError as e:
            last_error = e
            prompt = (
                f"{prompt}\n\nYour previous JSON failed validation with this error:\n{e}\n"
                f"Fix the fields and return a corrected JSON object only."
            )

    raise LandingPageError(f"Landing page content generation failed validation after retries: {last_error}")


def render_and_save(template_id: str, content: LandingPageContent, brand: BrandKit) -> str:
    """Renders the filled template to a static HTML file on disk and returns its path."""
    template_str = TEMPLATES.get(template_id, TEMPLATES["generic"])
    template = Template(template_str)

    logo_url = None
    if brand.logo_path and os.path.exists(brand.logo_path):
        # Local preview only: browsers can't load an arbitrary filesystem path,
        # so we skip embedding the logo unless/until it's served from a public URL.
        logo_url = None

    html = template.render(
        business_name=brand.business_name,
        primary_color=brand.primary_color,
        secondary_color=brand.secondary_color,
        logo_url=logo_url,
        headline=content.headline,
        subheadline=content.subheadline,
        offer=content.offer,
        bullets=content.bullets,
        cta=content.cta,
        form_fields=content.form_fields,
    )

    os.makedirs(LANDING_PAGES_PATH, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.html"
    output_path = os.path.join(LANDING_PAGES_PATH, filename)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    return output_path


def generate_landing_page(strategy: StrategyOutput, brand: BrandKit) -> tuple:
    """Full pipeline: select template -> AI content-fill -> render to disk.
    Returns (template_id, LandingPageContent, file_path)."""
    template_id = select_template(strategy)
    content = _generate_content(strategy, brand)
    file_path = render_and_save(template_id, content, brand)
    return template_id, content, file_path
