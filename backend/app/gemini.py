import random
import time
from functools import lru_cache

from google import genai
from google.genai import errors, types

from app.config import get_settings
from app.errors import AppError

RETRYABLE = (429, 500, 502, 503, 504)
BACKOFF_SECONDS = (1, 2, 4, 8, 16)


@lru_cache
def get_client() -> genai.Client:
    return genai.Client(api_key=get_settings().gemini_api_key)


def to_app_error(e: errors.APIError) -> AppError:
    if e.code == 429:
        return AppError("rate_limited", "We're at the free-tier limit. Try again in a minute.")
    return AppError("upstream_error", "The AI service is not responding. Try again.")


def call_with_backoff(fn):
    """Run fn, retrying 429/5xx with exponential backoff (1, 2, 4, 8, 16 s plus jitter)."""
    for delay in (*BACKOFF_SECONDS, None):
        try:
            return fn()
        except errors.APIError as e:
            if e.code not in RETRYABLE or delay is None:
                raise to_app_error(e)
            time.sleep(delay + random.random())


def generate(contents, system: str | None = None, **config) -> str:
    """Generate text with the chat model; on 429/5xx try the fallback model once.

    Extra keyword arguments go to GenerateContentConfig (e.g. response_mime_type, response_schema).
    """
    s = get_settings()
    models = [m for m in (s.gemini_chat_model, s.gemini_fallback_model) if m]
    if not models:
        raise AppError("upstream_error", "The AI service is not configured.")

    last: errors.APIError | None = None
    for model in models:
        try:
            resp = get_client().models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(system_instruction=system, **config),
            )
        except errors.APIError as e:
            last = e
            if e.code in RETRYABLE:
                continue  # try the fallback model
            raise to_app_error(e)
        if not resp.text:
            raise AppError("upstream_error", "The AI service returned no answer. Try again.")
        return resp.text

    raise to_app_error(last)
