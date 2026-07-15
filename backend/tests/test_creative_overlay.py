import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from PIL import Image
from app.services.creative_service import overlay_logo_and_brand_bar, _hex_to_rgba
from app.models import BrandKit


def _make_dummy_logo(path, size=(200, 200)):
    logo = Image.new("RGBA", size, (0, 0, 0, 0))
    # draw a solid red square in the middle so we can detect it after compositing
    for x in range(50, 150):
        for y in range(50, 150):
            logo.putpixel((x, y), (255, 0, 0, 255))
    logo.save(path)


def test_hex_to_rgba():
    assert _hex_to_rgba("#FF0000") == (255, 0, 0, 255)
    assert _hex_to_rgba("00FF00", alpha=128) == (0, 255, 0, 128)
    assert _hex_to_rgba("not-a-color") == (17, 17, 17, 255)  # falls back to default


def test_overlay_adds_brand_bar_and_logo(tmp_dir="/tmp/leadspilot_test"):
    os.makedirs(tmp_dir, exist_ok=True)
    logo_path = os.path.join(tmp_dir, "logo.png")
    _make_dummy_logo(logo_path)

    base = Image.new("RGBA", (1024, 1024), (100, 150, 200, 255))
    brand = BrandKit(business_name="Test Bakery", logo_path=logo_path, primary_color="#FF5500")

    result = overlay_logo_and_brand_bar(base, brand)

    assert result.size == base.size

    # brand bar should be present near the bottom edge
    bar_pixel = result.getpixel((10, 1020))
    assert bar_pixel[:3] == (255, 85, 0), f"expected brand bar color, got {bar_pixel}"

    # logo should be composited somewhere in the bottom-right region (non-background pixel)
    br_region_pixel = result.getpixel((900, 900))
    assert br_region_pixel != (100, 150, 200, 255), "logo does not appear to be composited"


def test_overlay_without_logo_still_adds_bar():
    base = Image.new("RGBA", (800, 800), (10, 10, 10, 255))
    brand = BrandKit(business_name="No Logo Biz", logo_path=None, primary_color="#0000FF")
    result = overlay_logo_and_brand_bar(base, brand)
    bar_pixel = result.getpixel((5, 795))
    assert bar_pixel[:3] == (0, 0, 255)


if __name__ == "__main__":
    test_hex_to_rgba()
    test_overlay_adds_brand_bar_and_logo()
    test_overlay_without_logo_still_adds_bar()
    print("ALL creative overlay tests passed")
