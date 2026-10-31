import time
from collections import deque

from google.genai import errors, types

from app.config import get_settings
from app.errors import AppError
from app.gemini import call_with_backoff, get_client

# Free tier allows ~30K embedding tokens per minute. Token counts are estimated
# (chars / 3 is conservative), and we stay under this budget per rolling minute.
TPM_BUDGET = 28_000
BATCH_MAX_ITEMS = 100
BATCH_MAX_TOKENS = 14_000
WINDOW_SECONDS = 60

_window: deque[tuple[float, int]] = deque()  # (timestamp, estimated tokens)


def _tokens(text: str) -> int:
    return max(1, len(text) // 3)


def _wait_for_budget(tokens: int) -> None:
    while True:
        now = time.monotonic()
        while _window and now - _window[0][0] >= WINDOW_SECONDS:
            _window.popleft()
        if sum(t for _, t in _window) + tokens <= TPM_BUDGET or not _window:
            _window.append((now, tokens))
            return
        time.sleep(max(0.5, WINDOW_SECONDS - (now - _window[0][0]) + 0.1))


def _batches(texts: list[str]):
    batch, tokens = [], 0
    for text in texts:
        t = _tokens(text)
        if batch and (len(batch) >= BATCH_MAX_ITEMS or tokens + t > BATCH_MAX_TOKENS):
            yield batch, tokens
            batch, tokens = [], 0
        batch.append(text)
        tokens += t
    if batch:
        yield batch, tokens


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    s = get_settings()

    def call():
        return get_client().models.embed_content(
            model=s.gemini_embed_model,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type=task_type, output_dimensionality=s.embed_dim
            ),
        )

    resp = call_with_backoff(call)
    vectors = [list(e.values) for e in resp.embeddings]
    if len(vectors) != len(texts) or any(len(v) != s.embed_dim for v in vectors):
        raise AppError("upstream_error", "The AI service returned an unexpected embedding.")
    return vectors


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed chunks (retrieval-document task), batched and paced to the free-tier limits."""
    vectors: list[list[float]] = []
    for batch, tokens in _batches(texts):
        _wait_for_budget(tokens)
        vectors.extend(_embed(batch, "RETRIEVAL_DOCUMENT"))
    return vectors


def embed_query(text: str) -> list[float]:
    _wait_for_budget(_tokens(text))
    return _embed([text], "RETRIEVAL_QUERY")[0]
