from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

STATUS_BY_CODE = {
    "invalid_input": 400,
    "unauthorized": 401,
    "not_found": 404,
    "not_ready": 409,
    "file_too_large": 413,
    "rate_limited": 429,
    "upstream_error": 502,
}

CODE_BY_STATUS = {status: code for code, status in STATUS_BY_CODE.items()}


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        reset_at: datetime | None = None,
        headers: dict[str, str] | None = None,
    ):
        self.code = code
        self.message = message
        self.reset_at = reset_at
        self.headers = headers
        super().__init__(message)


def _body(code: str, message: str, reset_at: datetime | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "reset_at": reset_at.isoformat() if reset_at else None,
        }
    }


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse(
            status_code=STATUS_BY_CODE[exc.code],
            content=_body(exc.code, exc.message, exc.reset_at),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=400,
            content=_body("invalid_input", "Invalid request."),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        code = CODE_BY_STATUS.get(exc.status_code, "invalid_input")
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(code, str(exc.detail)),
        )
