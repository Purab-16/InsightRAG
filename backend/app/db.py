from functools import lru_cache

import httpx
from supabase import Client, ClientOptions, create_client

from app.config import get_settings


@lru_cache
def get_db() -> Client:
    """Service-role Supabase client. Backend only, bypasses RLS."""
    s = get_settings()
    # The default clients use HTTP/2 and share one connection across threads. Under parallel requests
    # (a browser fires several at once) that raised ReadError [WinError 10035] and turned into 502s.
    # Plain HTTP/1.1 with a pool gives each thread its own connection.
    http = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(60.0),
        limits=httpx.Limits(max_connections=50, keepalive_expiry=10),
    )
    return create_client(s.supabase_url, s.supabase_service_role_key, options=ClientOptions(httpx_client=http))
