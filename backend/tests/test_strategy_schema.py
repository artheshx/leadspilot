import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import StrategyOutput

try:
    from pydantic import ValidationError
except ImportError:
    from pydantic import ValidationError  # stub path already inserted by caller


VALID = dict(
    business_type="home bakery",
    target_audience="women aged 25-45 in Indore interested in custom cakes",
    goal="lead generation",
    budget_suggestion_inr=8000,
    tone="friendly",
    creative_direction="close-up of a decorated custom birthday cake on a wooden table",
    landing_page_type="lead-gen-local-service",
    kpis=["CTR > 1.5%", "CPC under 15 INR"],
)


def test_valid_strategy_parses():
    s = StrategyOutput(**VALID)
    assert s.business_type == "home bakery"
    assert s.budget_suggestion_inr == 8000


def test_budget_safety_cap_rejects_absurd_value():
    bad = dict(VALID, budget_suggestion_inr=5_000_000)  # AI hallucinated a huge budget
    try:
        StrategyOutput(**bad)
        assert False, "expected ValidationError for budget over safety cap"
    except ValidationError:
        pass


def test_zero_or_negative_budget_rejected():
    for bad_budget in (0, -100):
        bad = dict(VALID, budget_suggestion_inr=bad_budget)
        try:
            StrategyOutput(**bad)
            assert False, f"expected ValidationError for budget={bad_budget}"
        except ValidationError:
            pass


def test_missing_field_rejected():
    incomplete = dict(VALID)
    del incomplete["kpis"]
    try:
        StrategyOutput(**incomplete)
        assert False, "expected ValidationError for missing field"
    except ValidationError:
        pass


if __name__ == "__main__":
    test_valid_strategy_parses()
    test_budget_safety_cap_rejects_absurd_value()
    test_zero_or_negative_budget_rejected()
    test_missing_field_rejected()
    print("ALL strategy schema tests passed")
