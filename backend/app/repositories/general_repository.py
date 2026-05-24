from __future__ import annotations
import math
from datetime import date, timedelta
from typing import Optional
from sqlalchemy import select, func, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.general import (
    ServiceCategory, Service, SubscriptionPlanModel, ClientSubscription,
    RecurringTemplate, GenInvoice, GenInvoiceItem,
    BillingCycle, SubscriptionStatus, GenInvoiceStatus,
)
from app.models.client import Client
from app.schemas.general import (
    ServiceCategoryCreate, ServiceCreate, ServiceUpdate,
    PlanCreate, PlanUpdate,
    SubscriptionCreate, SubscriptionUpdate,
    RecurringTemplateCreate,
    GenInvoiceCreate, GenInvoiceUpdate,
    GenInvoiceStatusUpdate, GenerateFromTemplate,
)


# ── Utilities ─────────────────────────────────────────────────────────────────

def _next_run(cycle: BillingCycle, from_date: date) -> date:
    deltas = {
        BillingCycle.DAILY:       timedelta(days=1),
        BillingCycle.WEEKLY:      timedelta(weeks=1),
        BillingCycle.MONTHLY:     None,
        BillingCycle.QUARTERLY:   None,
        BillingCycle.HALF_YEARLY: None,
        BillingCycle.ANNUAL:      None,
        BillingCycle.ONE_TIME:    None,
    }
    if cycle in (BillingCycle.DAILY, BillingCycle.WEEKLY):
        return from_date + deltas[cycle]
    if cycle == BillingCycle.MONTHLY:
        m = from_date.month + 1
        y = from_date.year + (m - 1) // 12
        m = ((m - 1) % 12) + 1
        return date(y, m, min(from_date.day, 28))
    if cycle == BillingCycle.QUARTERLY:
        return _next_run(BillingCycle.MONTHLY, _next_run(BillingCycle.MONTHLY, _next_run(BillingCycle.MONTHLY, from_date)))
    if cycle == BillingCycle.HALF_YEARLY:
        d = from_date
        for _ in range(6):
            d = _next_run(BillingCycle.MONTHLY, d)
        return d
    if cycle == BillingCycle.ANNUAL:
        return date(from_date.year + 1, from_date.month, min(from_date.day, 28))
    return from_date   # ONE_TIME — don't advance


def _calc_items(items_data, discount: float) -> tuple[list[dict], dict]:
    rows = []
    subtotal = tax_total = 0.0
    for idx, it in enumerate(items_data):
        gross     = round(it.quantity * it.rate, 2)
        disc_amt  = round(gross * it.discount_pct / 100, 2)
        taxable   = round(gross - disc_amt, 2)
        tax_amt   = round(taxable * it.tax_rate / 100, 2)
        line_tot  = round(taxable + tax_amt, 2)
        subtotal += gross
        tax_total += tax_amt
        rows.append(dict(
            item_order=idx, description=it.description,
            hsn_sac=it.hsn_sac, unit=it.unit,
            service_id=getattr(it, "service_id", None),
            quantity=it.quantity, rate=it.rate,
            discount_pct=it.discount_pct, tax_rate=it.tax_rate,
            tax_amount=tax_amt, line_total=line_tot,
        ))
    disc_applied = min(discount, subtotal)
    taxable_amt  = round(subtotal - disc_applied, 2)
    gross_total  = round(taxable_amt + tax_total, 2)
    round_off    = round(round(gross_total) - gross_total, 2)
    grand_total  = round(gross_total + round_off, 2)
    totals = dict(
        subtotal=round(subtotal, 2),
        discount_amount=disc_applied,
        taxable_amount=taxable_amt,
        tax_amount=round(tax_total, 2),
        round_off=round_off,
        grand_total=grand_total,
    )
    return rows, totals


async def _next_inv_number(db: AsyncSession, tenant_id: int) -> str:
    count = (await db.execute(
        select(func.count()).select_from(GenInvoice).where(GenInvoice.tenant_id == tenant_id)
    )).scalar_one()
    year = date.today().year
    return f"GEN-{tenant_id:03d}-{year}-{count + 1:05d}"


# ── Service Category ──────────────────────────────────────────────────────────

class ServiceCategoryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: ServiceCategoryCreate) -> ServiceCategory:
        cat = ServiceCategory(tenant_id=tenant_id, **data.model_dump())
        self.db.add(cat)
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def list(self, tenant_id: int) -> list[ServiceCategory]:
        stmt = select(ServiceCategory).where(
            ServiceCategory.tenant_id == tenant_id,
            ServiceCategory.is_deleted == False,
        ).order_by(ServiceCategory.name)
        return list((await self.db.execute(stmt)).scalars().all())

    async def get(self, cat_id: int, tenant_id: int) -> Optional[ServiceCategory]:
        stmt = select(ServiceCategory).where(
            ServiceCategory.id == cat_id,
            ServiceCategory.tenant_id == tenant_id,
            ServiceCategory.is_deleted == False,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()


# ── Service ───────────────────────────────────────────────────────────────────

class ServiceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: ServiceCreate) -> Service:
        svc = Service(tenant_id=tenant_id, **data.model_dump())
        self.db.add(svc)
        await self.db.commit()
        await self.db.refresh(svc)
        return svc

    async def list(
        self, tenant_id: Optional[int],
        page: int = 1, size: int = 50,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        active_only: bool = False,
    ) -> tuple[list[Service], int]:
        stmt = select(Service).where(Service.is_deleted == False)
        if tenant_id: stmt = stmt.where(Service.tenant_id == tenant_id)
        if search:
            t = f"%{search}%"
            stmt = stmt.where(or_(Service.name.ilike(t), Service.code.ilike(t)))
        if category_id: stmt = stmt.where(Service.category_id == category_id)
        if active_only: stmt = stmt.where(Service.is_active == True)
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows  = (await self.db.execute(stmt.order_by(Service.name).offset((page-1)*size).limit(size))).scalars().all()
        return list(rows), total

    async def get(self, svc_id: int, tenant_id: Optional[int] = None) -> Optional[Service]:
        stmt = select(Service).where(Service.id == svc_id, Service.is_deleted == False)
        if tenant_id: stmt = stmt.where(Service.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def update(self, svc: Service, data: ServiceUpdate) -> Service:
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(svc, f, v)
        await self.db.commit()
        await self.db.refresh(svc)
        return svc

    async def soft_delete(self, svc: Service, user_id: int | None = None) -> None:
        svc.soft_delete(user_id=user_id)
        await self.db.commit()

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0


# ── Subscription Plan ─────────────────────────────────────────────────────────

class PlanRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: PlanCreate) -> SubscriptionPlanModel:
        plan = SubscriptionPlanModel(tenant_id=tenant_id, **data.model_dump())
        self.db.add(plan)
        await self.db.commit()
        await self.db.refresh(plan)
        return plan

    async def list(self, tenant_id: int, active_only: bool = False) -> list[SubscriptionPlanModel]:
        stmt = select(SubscriptionPlanModel).where(
            SubscriptionPlanModel.tenant_id == tenant_id,
            SubscriptionPlanModel.is_deleted == False,
        )
        if active_only: stmt = stmt.where(SubscriptionPlanModel.is_active == True)
        return list((await self.db.execute(stmt.order_by(SubscriptionPlanModel.sort_order, SubscriptionPlanModel.name))).scalars().all())

    async def get(self, plan_id: int, tenant_id: int) -> Optional[SubscriptionPlanModel]:
        stmt = select(SubscriptionPlanModel).where(
            SubscriptionPlanModel.id == plan_id,
            SubscriptionPlanModel.tenant_id == tenant_id,
            SubscriptionPlanModel.is_deleted == False,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def update(self, plan: SubscriptionPlanModel, data: PlanUpdate) -> SubscriptionPlanModel:
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(plan, f, v)
        await self.db.commit()
        await self.db.refresh(plan)
        return plan


# ── Client Subscription ───────────────────────────────────────────────────────

class SubscriptionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, created_by_id: int, data: SubscriptionCreate) -> ClientSubscription:
        plan = (await self.db.execute(
            select(SubscriptionPlanModel).where(SubscriptionPlanModel.id == data.plan_id)
        )).scalar_one_or_none()
        if not plan:
            raise ValueError("Plan not found")

        start = date.fromisoformat(data.start_date)
        trial_end = (start + timedelta(days=plan.trial_days)).isoformat() if plan.trial_days else None
        effective_start = (start + timedelta(days=plan.trial_days)) if plan.trial_days else start
        next_billing = _next_run(plan.billing_cycle, effective_start).isoformat()

        sub = ClientSubscription(
            tenant_id=tenant_id,
            created_by_id=created_by_id,
            trial_end_date=trial_end,
            next_billing_date=next_billing,
            status=SubscriptionStatus.TRIAL if plan.trial_days else SubscriptionStatus.ACTIVE,
            **data.model_dump(),
        )
        self.db.add(sub)
        await self.db.commit()
        await self.db.refresh(sub)
        return sub

    async def get(self, sub_id: int, tenant_id: Optional[int] = None) -> Optional[ClientSubscription]:
        stmt = select(ClientSubscription).where(
            ClientSubscription.id == sub_id,
            ClientSubscription.is_deleted == False,
        )
        if tenant_id: stmt = stmt.where(ClientSubscription.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self, tenant_id: Optional[int],
        page: int = 1, size: int = 20,
        status: Optional[str] = None,
        client_id: Optional[int] = None,
        plan_id: Optional[int] = None,
    ) -> tuple[list[ClientSubscription], int]:
        stmt = select(ClientSubscription).where(ClientSubscription.is_deleted == False)
        if tenant_id: stmt = stmt.where(ClientSubscription.tenant_id == tenant_id)
        if status:    stmt = stmt.where(ClientSubscription.status == status)
        if client_id: stmt = stmt.where(ClientSubscription.client_id == client_id)
        if plan_id:   stmt = stmt.where(ClientSubscription.plan_id == plan_id)
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows  = (await self.db.execute(stmt.order_by(ClientSubscription.id.desc()).offset((page-1)*size).limit(size))).scalars().all()
        return list(rows), total

    async def update(self, sub: ClientSubscription, data: SubscriptionUpdate) -> ClientSubscription:
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(sub, f, v)
        if data.status == SubscriptionStatus.CANCELLED:
            sub.cancelled_at = date.today().isoformat()
        await self.db.commit()
        await self.db.refresh(sub)
        return sub

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0


# ── Recurring Template ────────────────────────────────────────────────────────

class RecurringRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, created_by_id: int, data: RecurringTemplateCreate) -> RecurringTemplate:
        tmpl = RecurringTemplate(
            tenant_id=tenant_id,
            created_by_id=created_by_id,
            **{k: v for k, v in data.model_dump().items() if k != "line_items"},
            line_items=[li.model_dump() for li in data.line_items],
        )
        self.db.add(tmpl)
        await self.db.commit()
        await self.db.refresh(tmpl)
        return tmpl

    async def list(self, tenant_id: int) -> list[RecurringTemplate]:
        stmt = select(RecurringTemplate).where(
            RecurringTemplate.tenant_id == tenant_id,
            RecurringTemplate.is_deleted == False,
        ).order_by(RecurringTemplate.name)
        return list((await self.db.execute(stmt)).scalars().all())

    async def get(self, tmpl_id: int, tenant_id: int) -> Optional[RecurringTemplate]:
        stmt = select(RecurringTemplate).where(
            RecurringTemplate.id == tmpl_id,
            RecurringTemplate.tenant_id == tenant_id,
            RecurringTemplate.is_deleted == False,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def generate_invoice(
        self, tmpl: RecurringTemplate, invoice_date: str, created_by_id: int
    ) -> GenInvoice:
        """Materialise one invoice from a recurring template."""
        from app.schemas.general import GenInvoiceItemCreate
        item_creates = [GenInvoiceItemCreate(**li) for li in tmpl.line_items]
        item_rows, totals = _calc_items(item_creates, 0.0)

        invoice_date_obj = date.fromisoformat(invoice_date)
        due_date = (invoice_date_obj + timedelta(days=tmpl.payment_due_days)).isoformat()

        # Snapshot client name
        client = (await self.db.execute(select(Client).where(Client.id == tmpl.client_id))).scalar_one_or_none()
        billing_name = client.display_name if client else None

        inv = GenInvoice(
            tenant_id=tmpl.tenant_id,
            client_id=tmpl.client_id,
            template_id=tmpl.id,
            created_by_id=created_by_id,
            invoice_number=await _next_inv_number(self.db, tmpl.tenant_id),
            invoice_date=invoice_date,
            due_date=due_date,
            currency=tmpl.currency,
            billing_name=billing_name,
            amount_due=totals["grand_total"],
            **totals,
        )
        self.db.add(inv)
        await self.db.flush()

        for row in item_rows:
            self.db.add(GenInvoiceItem(invoice_id=inv.id, **row))

        # Advance template
        tmpl.invoices_generated += 1
        tmpl.next_run_date = _next_run(tmpl.billing_cycle, invoice_date_obj).isoformat()
        if tmpl.end_date and tmpl.next_run_date > tmpl.end_date:
            from app.models.general import RecurringStatus
            tmpl.status = RecurringStatus.STOPPED

        await self.db.commit()
        return await self.db.get(GenInvoice, inv.id)


# ── General Invoice ───────────────────────────────────────────────────────────

class GenInvoiceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, created_by_id: int, data: GenInvoiceCreate) -> GenInvoice:
        item_rows, totals = _calc_items(data.items, data.discount_amount)

        client = (await self.db.execute(select(Client).where(Client.id == data.client_id))).scalar_one_or_none()
        billing_name = client.display_name if client else None
        inv_number   = data.invoice_number or await _next_inv_number(self.db, tenant_id)

        inv = GenInvoice(
            tenant_id=tenant_id,
            created_by_id=created_by_id,
            invoice_number=inv_number,
            billing_name=billing_name,
            amount_due=totals["grand_total"],
            **{k: v for k, v in data.model_dump().items() if k not in ("items", "invoice_number", "discount_amount")},
            discount_amount=totals["discount_amount"],
            **{k: v for k, v in totals.items() if k != "discount_amount"},
        )
        self.db.add(inv)
        await self.db.flush()

        for row in item_rows:
            self.db.add(GenInvoiceItem(invoice_id=inv.id, **row))

        await self.db.commit()
        return await self._load_full(inv.id)

    async def get(self, inv_id: int, tenant_id: Optional[int] = None) -> Optional[GenInvoice]:
        stmt = (
            select(GenInvoice)
            .options(selectinload(GenInvoice.items))
            .where(GenInvoice.id == inv_id, GenInvoice.is_deleted == False)
        )
        if tenant_id: stmt = stmt.where(GenInvoice.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self, tenant_id: Optional[int],
        page: int = 1, size: int = 20,
        search: Optional[str] = None,
        status: Optional[str] = None,
        client_id: Optional[int] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> tuple[list[GenInvoice], int]:
        stmt = select(GenInvoice).where(GenInvoice.is_deleted == False)
        if tenant_id: stmt = stmt.where(GenInvoice.tenant_id == tenant_id)
        if search:
            t = f"%{search}%"
            stmt = stmt.where(or_(GenInvoice.invoice_number.ilike(t), GenInvoice.billing_name.ilike(t)))
        if status:    stmt = stmt.where(GenInvoice.status == status)
        if client_id: stmt = stmt.where(GenInvoice.client_id == client_id)
        if from_date: stmt = stmt.where(GenInvoice.invoice_date >= from_date)
        if to_date:   stmt = stmt.where(GenInvoice.invoice_date <= to_date)
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows  = (await self.db.execute(stmt.order_by(GenInvoice.invoice_date.desc()).offset((page-1)*size).limit(size))).scalars().all()
        return list(rows), total

    async def update_status(self, inv: GenInvoice, data: GenInvoiceStatusUpdate) -> GenInvoice:
        inv.status = data.status
        if data.amount_paid is not None:
            inv.amount_paid = round(data.amount_paid, 2)
            inv.amount_due  = round(inv.grand_total - inv.amount_paid, 2)
            if inv.amount_due <= 0:
                inv.status = GenInvoiceStatus.PAID
                inv.amount_due = 0.0
            elif inv.amount_paid > 0:
                inv.status = GenInvoiceStatus.PARTIAL
        await self.db.commit()
        return await self._load_full(inv.id)

    async def soft_delete(self, inv: GenInvoice, user_id: int | None = None) -> None:
        if inv.status not in (GenInvoiceStatus.DRAFT, GenInvoiceStatus.CANCELLED):
            raise ValueError("Only DRAFT or CANCELLED invoices can be deleted")
        inv.soft_delete(user_id=user_id)
        await self.db.commit()

    async def _load_full(self, inv_id: int) -> GenInvoice:
        stmt = select(GenInvoice).options(selectinload(GenInvoice.items)).where(GenInvoice.id == inv_id)
        return (await self.db.execute(stmt)).scalar_one()

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0
