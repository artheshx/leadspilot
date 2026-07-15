import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.chunking import chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_short_text_returns_single_chunk():
    text = "This is a short business strategy note."
    chunks = chunk_text(text, chunk_size=800, overlap=120)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_long_text_splits_into_multiple_chunks_with_overlap():
    text = ("Meta Ads performance improves when creatives are refreshed regularly. " * 40).strip()
    chunks = chunk_text(text, chunk_size=200, overlap=40)
    assert len(chunks) > 1
    for c in chunks:
        assert len(c) <= 200 + 5  # small slack for word-boundary snapping
    # overlap check: end of one chunk should share some words with start of next
    assert any(word in chunks[1] for word in chunks[0].split()[-5:])


def test_invalid_params_raise():
    try:
        chunk_text("hello", chunk_size=0)
        assert False, "expected ValueError"
    except ValueError:
        pass
    try:
        chunk_text("hello", chunk_size=100, overlap=100)
        assert False, "expected ValueError"
    except ValueError:
        pass


if __name__ == "__main__":
    test_empty_text_returns_no_chunks()
    test_short_text_returns_single_chunk()
    test_long_text_splits_into_multiple_chunks_with_overlap()
    test_invalid_params_raise()
    print("ALL chunking tests passed")
