from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import register_error_handlers
from app.limiter import RateLimitMiddleware
from app.routers import arxiv, chat, compare, export, me, papers

settings = get_settings()

app = FastAPI(
    title="InsightRAG",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Added first so CORS (added next) wraps it and 429 responses still carry CORS headers.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


register_error_handlers(app)

api = APIRouter(prefix="/api")
api.include_router(me.router)
api.include_router(papers.router)
api.include_router(chat.router)
api.include_router(compare.router)
api.include_router(arxiv.router)
api.include_router(export.router)
app.include_router(api)


@app.get("/health")
def health():
    return {"status": "ok"}
