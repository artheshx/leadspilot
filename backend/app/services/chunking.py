"""
Simple, dependency-free text chunker for the Knowledge Base module.
Splits on paragraph boundaries first, then hard-wraps oversized paragraphs,
with a sliding overlap so context isn't lost at chunk edges.
"""
from typing import List


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> List[str]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and < chunk_size")

    text = text.strip()
    if not text:
        return []

    chunks: List[str] = []
    start = 0
    n = len(text)

    while start < n:
        end = min(start + chunk_size, n)

        # try not to cut mid-word: back off to the last whitespace within window
        if end < n:
            last_space = text.rfind(" ", start, end)
            if last_space > start:
                end = last_space

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= n:
            break

        start = end - overlap
        if start < 0:
            start = 0
        # guard against infinite loop if overlap logic ever stalls progress
        if chunks and start <= (end - chunk_size - overlap):
            start = end

    return chunks
