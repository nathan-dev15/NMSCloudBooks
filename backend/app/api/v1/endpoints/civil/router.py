from fastapi import APIRouter
from app.api.v1.endpoints.civil import projects, requests, stock, billing

civil_router = APIRouter()
civil_router.include_router(projects.router)
civil_router.include_router(requests.router)
civil_router.include_router(stock.router)
civil_router.include_router(billing.router)
