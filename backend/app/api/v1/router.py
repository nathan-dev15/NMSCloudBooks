from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, users, tenants, clients, invoices, purchase_orders,
    purchase_requisitions, delivery_challans, business_types,
    inventory, retail, agriculture, general, error_logs, profile,
)
from app.api.v1.endpoints.civil.router import civil_router
from app.api.v1.endpoints.companies import router as companies_router
from app.api.v1.endpoints.subscriptions import router as subscriptions_router
from app.api.v1.endpoints.mind_maps import router as mind_maps_router

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(subscriptions_router)
api_router.include_router(users.router)
api_router.include_router(tenants.router)
api_router.include_router(companies_router)
api_router.include_router(civil_router)
api_router.include_router(clients.router)
api_router.include_router(invoices.router)
api_router.include_router(purchase_orders.router)
api_router.include_router(purchase_requisitions.router)
api_router.include_router(delivery_challans.router)
api_router.include_router(inventory.router)
api_router.include_router(retail.router)
api_router.include_router(agriculture.router)
api_router.include_router(general.router)
api_router.include_router(business_types.router)
api_router.include_router(mind_maps_router)
api_router.include_router(error_logs.router)
