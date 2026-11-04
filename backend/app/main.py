import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base
from app.core.exceptions import NMSCBException
from app.api.v1.router import api_router
from app.middleware.logging import ErrorLoggingMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise B2B SaaS Billing Management System — NMSCloudBooks",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(ErrorLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(NMSCBException)
async def nmscb_exception_handler(request: Request, exc: NMSCBException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    from app.services.error_log_service import log_exception
    user_id   = getattr(getattr(request.state, "current_user", None), "id", None)
    client_ip = request.client.host if request.client else None
    request_id = getattr(request.state, "request_id", None)
    await log_exception(
        exc,
        severity="CRITICAL",
        user_id=user_id,
        request_id=request_id,
        endpoint=str(request.url.path),
        http_method=request.method,
        ip_address=client_ip,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
    )


app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Serve uploaded media (avatars, etc.)
_media_dir = os.path.join(os.path.dirname(__file__), "..", "media")
os.makedirs(_media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=_media_dir), name="media")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
