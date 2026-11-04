from app.models.base import TimestampMixin, SoftDeleteMixin, UUIDMixin
from app.models.subscription_plan import SubscriptionPlan
from app.models.tenant import Tenant, DomainModule
from app.models.company import Company
from app.models.user import User, UserRole, ROLE_HIERARCHY, CREATABLE_ROLES
from app.models.authorization import (
    Role, UserRoleAssignment, UserPermission, RolePermissionAssignment,
)
from app.models.audit import AuditLog
from app.models.logging import ErrorLog, ActivityLog
import app.models.civil       # noqa: F401 — registers civil models
from app.models.client import Client, ClientContact, ClientCommunication
from app.models.invoice import Invoice, InvoiceItem, InvoicePayment
from app.models.purchase_order import PurchaseOrder, POItem
from app.models.purchase_requisition import PurchaseRequisition, PRItem, PRStatus, PRPriority
from app.models.delivery_challan import DeliveryChallan, DCItem, DCStatus
from app.models.inventory import (
    ProductCategory, Warehouse, Product,
    InventoryLevel, StockTransaction,
)
from app.models.retail import (
    Store, POSSession, Sale, SaleItem,
    Promotion, LoyaltyAccount, LoyaltyTransaction,
)
from app.models.agriculture import (
    Farm, CropCycle, FarmExpense, HarvestRecord, AgriInvoice,
)
from app.models.general import (
    ServiceCategory, Service, SubscriptionPlanModel, ClientSubscription,
    RecurringTemplate, GenInvoice, GenInvoiceItem,
)
from app.models.mind_map import MindMap, MindMapNode, MindMapEdge, MindMapActivityLog

__all__ = [
    # Base mixins
    "TimestampMixin", "SoftDeleteMixin", "UUIDMixin",
    # Core
    "Tenant", "DomainModule", "SubscriptionPlan",
    "Company",
    "User", "UserRole", "ROLE_HIERARCHY", "CREATABLE_ROLES",
    # Authorization — PDF tables: user_roles_master, user_role_assignments,
    #                             user_permissions_master, role_permission_assignments
    "Role", "UserRoleAssignment", "UserPermission", "RolePermissionAssignment",
    # Logging
    "AuditLog", "ErrorLog", "ActivityLog",
    # Clients — PDF table: customer_master, customer_contact_persons
    "Client", "ClientContact", "ClientCommunication",
    # Invoicing — PDF tables: billing_invoices, billing_invoice_line_items
    "Invoice", "InvoiceItem", "InvoicePayment",
    # Purchase orders
    "PurchaseOrder", "POItem",
    # Inventory — PDF tables: inventory_products_master, inventory_stock_levels,
    #                          inventory_movement_history
    "ProductCategory", "Warehouse", "Product", "InventoryLevel", "StockTransaction",
]
