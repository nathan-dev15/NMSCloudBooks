"""
Write error log entries without crashing the caller.
Always uses an independent DB session so a failed request session
doesn't block error persistence.
"""
import traceback
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.logging import ErrorLog

logger = logging.getLogger("nmscb.errors")

_log_engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
_LogSession  = async_sessionmaker(_log_engine, class_=AsyncSession, expire_on_commit=False)


async def log_error(
    *,
    message:      str,
    error_type:   str                = "UNHANDLED_EXCEPTION",
    error_code:   Optional[str]      = None,
    severity:     str                = "ERROR",
    stack_trace:  Optional[str]      = None,
    service_name: Optional[str]      = None,
    function_name: Optional[str]     = None,
    file_path:    Optional[str]      = None,
    line_number:  Optional[int]      = None,
    user_id:      Optional[int]      = None,
    request_id:   Optional[str]      = None,
    endpoint:     Optional[str]      = None,
    http_method:  Optional[str]      = None,
    ip_address:   Optional[str]      = None,
    entity_type:  Optional[str]      = None,
    entity_id:    Optional[int]      = None,
) -> None:
    """Persist an error record. Silently swallows its own failures."""
    try:
        async with _LogSession() as session:
            entry = ErrorLog(
                error_message=message,
                error_type=error_type,
                error_code=error_code,
                severity=severity,
                error_stack_trace=stack_trace,
                service_name=service_name,
                function_name=function_name,
                file_path=file_path,
                line_number=line_number,
                user_id=user_id,
                request_id=request_id,
                endpoint=endpoint,
                http_method=http_method,
                ip_address=ip_address,
                entity_type=entity_type,
                entity_id=entity_id,
            )
            session.add(entry)
            await session.commit()
    except Exception:
        logger.exception("ErrorLogService: failed to persist error entry")


async def log_exception(
    exc: Exception,
    *,
    severity:     str           = "ERROR",
    service_name: Optional[str] = None,
    user_id:      Optional[int] = None,
    request_id:   Optional[str] = None,
    endpoint:     Optional[str] = None,
    http_method:  Optional[str] = None,
    ip_address:   Optional[str] = None,
) -> None:
    """Helper: extract traceback automatically and call log_error."""
    tb = traceback.format_exc()
    frames = traceback.extract_tb(exc.__traceback__)
    last   = frames[-1] if frames else None
    await log_error(
        message=str(exc),
        error_type=type(exc).__name__,
        severity=severity,
        stack_trace=tb if tb.strip() != "NoneType: None" else None,
        service_name=service_name or (last.filename.split("\\")[-1] if last else None),
        function_name=last.name if last else None,
        file_path=last.filename if last else None,
        line_number=last.lineno if last else None,
        user_id=user_id,
        request_id=request_id,
        endpoint=endpoint,
        http_method=http_method,
        ip_address=ip_address,
    )
