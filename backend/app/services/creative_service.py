"""
Creative Engine (Layer 3, part 1).
- Base image: Pollinations.ai (free, no API key) by default. Swap IMAGE_GEN_PROVIDER
  to "ideogram" or "dalle" later for higher quality / text-in-image without changing callers.
- Logo + brand color overlay: Pillow, fully local, free.
- Ad copy (headline/primary_text/cta): Ollama LLM.
"""
import os
import time
import uuid
import urllib.parse

import requests
from PIL import Image, ImageDraw

from app import config
from app.models import StrategyOutput, BrandKit, CreativeOutput
from app.services import llm_service


class CreativeError(Exception):
    pass


def _generate_base_image(prompt: str, width: int = 1024, height: int = 1024) -> Image.Image:
    if config.IMAGE_GEN_PROVIDER != "pollinations":
        raise CreativeError(
            f"Image provider '{config.IMAGE_GEN_PROVIDER}' not implemented yet in this build. "
            f"Use 'pollinations' (free) for now."
        )

    encoded_prompt = urllib.parse.quote(prompt)
    url = f"{config.POLLINATIONS_BASE_URL}/{encoded_prompt}"
    params = {"width": width, "height": height, "nologo": "true"}

    try:
        resp = requests.get(url, params=params, timeout=90)
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise CreativeError(f"Image generation request failed: {e}") from e

    from io import BytesIO
    try:
        return Image.open(BytesIO(resp.content)).convert("RGBA")
    except Exception as e:
        raise CreativeError(f"Image provider returned non-image data: {e}") from e


def overlay_logo_and_brand_bar(base_image: Image.Image, brand: BrandKit) -> Image.Image:
    """
    Pastes the brand logo (bottom-right, with padding) and draws a thin brand-color
    bar along the bottom edge, so every generated creative stays visually on-brand
    even though the base image itself is generic AI art.
    """
    img = base_image.copy()
    w, h = img.size

    bar_height = max(int(h * 0.06), 24)
    bar_color = _hex_to_rgba(brand.primary_color, alpha=235)
    draw = ImageDraw.Draw(img)
    draw.rectangle([(0, h - bar_height), (w, h)], fill=bar_color)

    if brand.logo_path and os.path.exists(brand.logo_path):
        logo = Image.open(brand.logo_path).convert("RGBA")
        target_w = int(w * 0.18)
        scale = target_w / logo.width
        logo = logo.resize((target_w, int(logo.height * scale)), Image.LANCZOS)

        padding = int(w * 0.03)
        pos = (w - logo.width - padding, h - logo.height - padding)
        img.alpha_composite(logo, dest=pos)

    return img


def _hex_to_rgba(hex_color: str, alpha: int = 255) -> tuple:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        hex_color = "111111"
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    return (r, g, b, alpha)


COPY_SYSTEM_PROMPT = """You are LeadsPilot's ad copywriter. Given a campaign strategy, \
write Meta Ads copy in the specified tone. Respond with ONLY this JSON object:
{"headline": string (max 40 chars), "primary_text": string (max 125 chars), "cta": string (one of: "Shop Now", "Learn More", "Sign Up", "Book Now", "Contact Us", "Get Offer")}"""


def _generate_ad_copy(strategy: StrategyOutput, brand: BrandKit) -> dict:
    prompt = (
        f"Business: {brand.business_name}\n"
        f"Business type: {strategy.business_type}\n"
        f"Target audience: {strategy.target_audience}\n"
        f"Goal: {strategy.goal}\n"
        f"Tone: {strategy.tone}\n"
        f"Creative direction: {strategy.creative_direction}\n"
    )
    return llm_service.chat_json(prompt, system=COPY_SYSTEM_PROMPT)


def generate_creative(strategy: StrategyOutput, brand: BrandKit) -> CreativeOutput:
    image_prompt = (
        f"{strategy.creative_direction}, advertisement style, {strategy.tone} tone, "
        f"clean composition, no text, no watermark, high quality photo"
    )
    base_image = _generate_base_image(image_prompt)
    branded_image = overlay_logo_and_brand_bar(base_image, brand)

    os.makedirs(config.GENERATED_IMAGES_PATH, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.png"
    output_path = os.path.join(config.GENERATED_IMAGES_PATH, filename)
    branded_image.convert("RGB").save(output_path, format="PNG")

    copy = _generate_ad_copy(strategy, brand)

    return CreativeOutput(
        image_path=output_path,
        headline=copy.get("headline", "")[:40],
        primary_text=copy.get("primary_text", "")[:125],
        cta=copy.get("cta", "Learn More"),
    )
