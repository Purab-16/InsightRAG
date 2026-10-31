from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_db() -> Client:
    """Service-role Supabase client. Backend only, bypasses RLS."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)
