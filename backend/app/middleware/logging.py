"""
Global error-logging middleware.
Catches every unhandled exception that escapes a route handler,
persists it to system_error_log, then re-raises so FastAPI still
returns a proper 500 response to the client.
"""
import uuid
import logging
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.services.error_log_service import log_exception

logger = logging.getLogger("nmscb.middleware")


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            user_id = getattr(getattr(request.state, "current_user", None), "id", None)
            client_ip = request.client.host if request.client else None

            await log_exception(
                exc,
                severity="CRITICAL",
                user_id=user_id,
                request_id=request_id,
                endpoint=str(request.url.path),
                http_method=request.method,
                ip_address=client_ip,
            )
            logger.exception("Unhandled exception [request_id=%s] %s %s",
                             request_id, request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )
