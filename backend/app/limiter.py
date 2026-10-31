"""Per-IP burst limit for /api routes.

Built on the `limits` library directly instead of slowapi's middleware: slowapi looks up the
route handler to apply default limits, and with current FastAPI nested routers that lookup
returns nothing, so the default limit was silently skipped.

In-memory, so it is per backend instance (fine for one instance). Run uvicorn with
--proxy-headers so request.client is the real client IP behind Render's proxy.
"""

import math
import time

from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import get_settings

_limit = parse(f"{get_settings().rate_limit_per_min}/minute")
_strategy = MovingWindowRateLimiter(MemoryStorage())


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api") or request.method == "OPTIONS":
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        if _strategy.hit(_limit, ip):
            return await call_next(request)

        reset_time = _strategy.get_window_stats(_limit, ip).reset_time
        retry_after = max(1, math.ceil(reset_time - time.time()))
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "rate_limited",
                    "message": "Too many requests. Slow down a little.",
                    "reset_at": None,
                }
            },
            headers={"Retry-After": str(retry_after)},
        )
