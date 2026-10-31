from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"

    gemini_api_key: str = ""
    gemini_chat_model: str = ""
    gemini_fallback_model: str = ""
    gemini_embed_model: str = ""
    embed_dim: int = 768

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    s2_api_key: str = ""

    allowed_origins: str = "http://localhost:3000"

    chunk_size: int = 1200
    chunk_overlap: int = 150
    top_k_per_paper: int = 5

    max_upload_mb: int = 20
    max_pdf_pages: int = 100
    parse_timeout_s: int = 60
    parse_memory_mb: int = 300

    daily_paper_limit: int = 5
    daily_message_limit: int = 30
    global_daily_ai_limit: int = 450
    rate_limit_per_min: int = 20

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
