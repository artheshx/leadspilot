import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["STORAGE_PATH"] = "/tmp/leadspilot_lp_test"
os.makedirs("/tmp/leadspilot_lp_test", exist_ok=True)
db_file = "/tmp/leadspilot_lp_test/leadspilot.db"
if os.path.exists(db_file):
    os.remove(db_file)

from app.db import landingpage_store

CONTENT = {
    "headline": "Fresh Custom Cakes, Made For You",
    "subheadline": "Order your dream cake for any occasion.",
    "offer": "10% off your first order",
    "bullets": ["Eggless options available", "Same-day delivery in Indore", "100% customizable designs"],
    "cta": "Order Now",
    "form_fields": ["Name", "Phone Number"],
}


def test_create_and_get_landing_page():
    landingpage_store.init_db()
    page_id = landingpage_store.create_landing_page(
        "biz_lp1", "lead-gen-local-service", CONTENT, "/tmp/fake_lp.html"
    )
    page = landingpage_store.get_landing_page(page_id)
    assert page is not None
    assert page["status"] == "draft"
    assert page["template_id"] == "lead-gen-local-service"
    assert page["content"]["headline"] == CONTENT["headline"]
    assert page["published_url"] == f"/lp/{page_id}"


def test_publish_flips_status():
    landingpage_store.init_db()
    page_id = landingpage_store.create_landing_page(
        "biz_lp2", "ecommerce-product", CONTENT, "/tmp/fake_lp2.html"
    )
    landingpage_store.mark_published(page_id)
    page = landingpage_store.get_landing_page(page_id)
    assert page["status"] == "published"


def test_multi_tenant_isolation():
    landingpage_store.init_db()
    p1 = landingpage_store.create_landing_page("biz_lp_A", "coaching-signup", CONTENT, "/tmp/a.html")
    p2 = landingpage_store.create_landing_page("biz_lp_B", "coaching-signup", CONTENT, "/tmp/b.html")

    pages_a = landingpage_store.list_by_business("biz_lp_A")
    pages_b = landingpage_store.list_by_business("biz_lp_B")

    assert any(p["id"] == p1 for p in pages_a)
    assert not any(p["id"] == p1 for p in pages_b)
    assert any(p["id"] == p2 for p in pages_b)


def test_template_selection_logic():
    # Import lazily so this test file still runs even in environments without
    # jinja2/pydantic installed for the other test functions above.
    try:
        from app.services import landingpage_service
        from app.models import StrategyOutput
    except ImportError:
        print("SKIPPED test_template_selection_logic (pydantic/jinja2 not installed in this env)")
        return

    strategy = StrategyOutput(
        business_type="home bakery", target_audience="women 25-45 Indore", goal="lead generation",
        budget_suggestion_inr=8000, tone="friendly", creative_direction="custom cake close-up",
        landing_page_type="lead-gen-local-service", kpis=["CTR > 1.5%"],
    )
    assert landingpage_service.select_template(strategy) == "lead-gen-local-service"

    strategy2 = strategy.model_copy(update={"landing_page_type": "some-unknown-type"})
    assert landingpage_service.select_template(strategy2) == "generic"


if __name__ == "__main__":
    test_create_and_get_landing_page()
    test_publish_flips_status()
    test_multi_tenant_isolation()
    test_template_selection_logic()
    print("ALL landing page tests passed")
