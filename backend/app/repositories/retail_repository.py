from __future__ import annotations
import math
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.retail import (
    Store, POSSession, Sale, SaleItem, Promotion, LoyaltyAccount, LoyaltyTransaction,
    SaleStatus, LoyaltyTxnType,
)
from app.models.inventory import Product
from app.schemas.retail import (
    StoreCreate, StoreUpdate, POSOpenSession, POSCloseSession,
    SaleCreate, SaleItemCreate, SaleRefund, PromotionCreate, LoyaltyAdjust,
)


# ── Store ─────────────────────────────────────────────────────────────────────

class StoreRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: StoreCreate) -> Store:
        if data.is_default:
            await self._clear_default(tenant_id)
        store = Store(tenant_id=tenant_id, **data.model_dump())
        self.db.add(store)
        await self.db.commit()
        await self.db.refresh(store)
        return store

    async def list(self, tenant_id: int) -> list[Store]:
        stmt = select(Store).where(Store.tenant_id == tenant_id, Store.is_deleted == False)
        return list((await self.db.execute(stmt.order_by(Store.name))).scalars().all())

    async def get(self, store_id: int, tenant_id: int) -> Optional[Store]:
        stmt = select(Store).where(Store.id == store_id, Store.tenant_id == tenant_id, Store.is_deleted == False)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def update(self, store: Store, data: StoreUpdate) -> Store:
        if data.is_default:
            await self._clear_default(store.tenant_id, exclude_id=store.id)
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(store, f, v)
        await self.db.commit()
        await self.db.refresh(store)
        return store

    async def _clear_default(self, tenant_id: int, exclude_id: Optional[int] = None) -> None:
        stmt = update(Store).where(Store.tenant_id == tenant_id, Store.is_default == True).values(is_default=False)
        if exclude_id:
            stmt = stmt.where(Store.id != exclude_id)
        await self.db.execute(stmt)


# ── POS Session ───────────────────────────────────────────────────────────────

class POSRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def open_session(self, store_id: int, cashier_id: int, data: POSOpenSession) -> POSSession:
        # Ensure no other open session for same cashier+store
        existing = await self._active_session(store_id, cashier_id)
        if existing:
            raise ValueError("A POS session is already open for this store/cashier")
        session = POSSession(
            store_id=store_id,
            cashier_id=cashier_id,
            opened_at=datetime.now(timezone.utc).isoformat(),
            opening_cash=data.opening_cash,
            notes=data.notes,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def close_session(self, session: POSSession, data: POSCloseSession) -> POSSession:
        if not session.is_open:
            raise ValueError("Session is already closed")
        # Calculate expected cash: opening + cash sales - refunds
        # (simplified: expected = opening_cash + total_sales for cash payments)
        session.closing_cash  = data.closing_cash
        session.expected_cash = round(session.opening_cash + session.total_sales, 2)
        session.cash_difference = round(data.closing_cash - session.expected_cash, 2)
        session.closed_at = datetime.now(timezone.utc).isoformat()
        session.is_open   = False
        if data.notes:
            session.notes = data.notes
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_session(self, session_id: int, store_id: int) -> Optional[POSSession]:
        stmt = select(POSSession).where(POSSession.id == session_id, POSSession.store_id == store_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_sessions(self, store_id: int, page: int = 1, size: int = 20) -> tuple[list[POSSession], int]:
        stmt = select(POSSession).where(POSSession.store_id == store_id)
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt  = stmt.order_by(POSSession.opened_at.desc()).offset((page - 1) * size).limit(size)
        return list((await self.db.execute(stmt)).scalars().all()), total

    async def _active_session(self, store_id: int, cashier_id: int) -> Optional[POSSession]:
        stmt = select(POSSession).where(
            POSSession.store_id == store_id,
            POSSession.cashier_id == cashier_id,
            POSSession.is_open == True,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()


# ── Sale ──────────────────────────────────────────────────────────────────────

class SaleRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _next_bill_number(self, tenant_id: int) -> str:
        from datetime import date
        stmt  = select(func.count()).select_from(Sale).where(Sale.tenant_id == tenant_id)
        count = (await self.db.execute(stmt)).scalar_one()
        today = date.today().strftime("%Y%m%d")
        return f"BILL-{tenant_id:03d}-{today}-{count + 1:05d}"

    async def create(self, tenant_id: int, cashier_id: int, data: SaleCreate) -> Sale:
        bill_number = await self._next_bill_number(tenant_id)

        # Compute totals
        subtotal = tax_total = 0.0
        item_rows = []
        for idx, it in enumerate(data.items):
            product = (await self.db.execute(select(Product).where(Product.id == it.product_id))).scalar_one_or_none()
            if not product:
                raise ValueError(f"Product {it.product_id} not found")
            tax_rate    = float(product.tax_rate)
            mrp         = float(product.mrp)
            line_gross  = round(it.quantity * it.unit_price, 2)
            disc_amt    = round(line_gross * it.discount_pct / 100, 2)
            taxable     = round(line_gross - disc_amt, 2)
            tax_amt     = round(taxable * tax_rate / 100, 2)
            line_total  = round(taxable + tax_amt, 2)
            subtotal   += line_gross
            tax_total  += tax_amt
            item_rows.append(dict(
                product_id=it.product_id, item_order=idx,
                product_name=product.name, sku=product.sku,
                unit=product.unit, quantity=it.quantity,
                unit_price=it.unit_price, mrp=mrp,
                discount_pct=it.discount_pct, discount_amt=disc_amt,
                tax_rate=tax_rate, tax_amount=tax_amt,
                line_total=line_total, promotion_id=it.promotion_id,
            ))

        disc_total   = min(data.discount_amount, subtotal)
        taxable_amt  = round(subtotal - disc_total, 2)
        gross_total  = round(taxable_amt + tax_total, 2)
        round_off    = round(round(gross_total) - gross_total, 2)
        grand_total  = round(gross_total + round_off, 2)
        change_due   = max(0.0, round(data.amount_tendered - grand_total, 2))

        # Loyalty points earned (1 point per 100 INR by default)
        pts_earned = int(grand_total // 100)

        sale = Sale(
            tenant_id=tenant_id,
            store_id=data.store_id,
            session_id=data.session_id,
            cashier_id=cashier_id,
            customer_id=data.customer_id,
            bill_number=bill_number,
            sale_date=data.sale_date,
            sale_time=data.sale_time,
            status=SaleStatus.COMPLETED,
            payment_method=data.payment_method,
            subtotal=round(subtotal, 2),
            discount_amount=disc_total,
            taxable_amount=taxable_amt,
            tax_amount=round(tax_total, 2),
            round_off=round_off,
            grand_total=grand_total,
            amount_tendered=data.amount_tendered,
            change_due=change_due,
            loyalty_points_used=data.loyalty_points_used,
            loyalty_points_earned=pts_earned,
            notes=data.notes,
        )
        self.db.add(sale)
        await self.db.flush()

        for row in item_rows:
            self.db.add(SaleItem(sale_id=sale.id, **row))

        # Update session totals
        if data.session_id:
            session = (await self.db.execute(select(POSSession).where(POSSession.id == data.session_id))).scalar_one_or_none()
            if session:
                session.total_sales = round(session.total_sales + grand_total, 2)

        # Loyalty
        if data.customer_id and pts_earned > 0:
            await self._award_loyalty(tenant_id, data.customer_id, sale.id, pts_earned)

        await self.db.commit()
        return await self._load_full(sale.id)

    async def get(self, sale_id: int, tenant_id: int) -> Optional[Sale]:
        stmt = (
            select(Sale)
            .options(selectinload(Sale.items))
            .where(Sale.id == sale_id, Sale.tenant_id == tenant_id, Sale.is_deleted == False)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self,
        tenant_id: int,
        page: int = 1,
        size: int = 20,
        store_id: Optional[int] = None,
        search: Optional[str] = None,
        status: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> tuple[list[Sale], int]:
        stmt = select(Sale).where(Sale.tenant_id == tenant_id, Sale.is_deleted == False)
        if store_id:  stmt = stmt.where(Sale.store_id == store_id)
        if status:    stmt = stmt.where(Sale.status == status)
        if from_date: stmt = stmt.where(Sale.sale_date >= from_date)
        if to_date:   stmt = stmt.where(Sale.sale_date <= to_date)
        if search:
            stmt = stmt.where(Sale.bill_number.ilike(f"%{search}%"))
        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt  = stmt.order_by(Sale.sale_date.desc(), Sale.id.desc()).offset((page - 1) * size).limit(size)
        return list((await self.db.execute(stmt)).scalars().all()), total

    async def refund(self, sale: Sale, data: SaleRefund) -> Sale:
        if sale.status in (SaleStatus.CANCELLED, SaleStatus.REFUNDED):
            raise ValueError("Sale already refunded/cancelled")
        sale.status = SaleStatus.REFUNDED if not data.item_ids else SaleStatus.PARTIAL_REFUND
        await self.db.commit()
        return await self._load_full(sale.id)

    async def _award_loyalty(self, tenant_id: int, customer_id: int, sale_id: int, points: int) -> None:
        stmt = select(LoyaltyAccount).where(LoyaltyAccount.customer_id == customer_id)
        acc  = (await self.db.execute(stmt)).scalar_one_or_none()
        if not acc:
            acc = LoyaltyAccount(tenant_id=tenant_id, customer_id=customer_id)
            self.db.add(acc)
            await self.db.flush()
        acc.points_balance  += points
        acc.lifetime_earned += points
        acc.tier = _loyalty_tier(acc.lifetime_earned)
        self.db.add(LoyaltyTransaction(
            account_id=acc.id, sale_id=sale_id,
            txn_type=LoyaltyTxnType.EARN,
            points=points, balance_after=acc.points_balance,
            description=f"Earned from sale #{sale_id}",
        ))

    async def _load_full(self, sale_id: int) -> Sale:
        stmt = select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id)
        return (await self.db.execute(stmt)).scalar_one()

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0


def _loyalty_tier(lifetime: int) -> str:
    if lifetime >= 10000: return "platinum"
    if lifetime >= 5000:  return "gold"
    if lifetime >= 1000:  return "silver"
    return "bronze"


# ── Promotions ────────────────────────────────────────────────────────────────

class PromotionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant_id: int, data: PromotionCreate) -> Promotion:
        promo = Promotion(tenant_id=tenant_id, **data.model_dump())
        self.db.add(promo)
        await self.db.commit()
        await self.db.refresh(promo)
        return promo

    async def list(self, tenant_id: int, active_only: bool = False) -> list[Promotion]:
        stmt = select(Promotion).where(Promotion.tenant_id == tenant_id, Promotion.is_deleted == False)
        if active_only:
            stmt = stmt.where(Promotion.is_active == True)
        return list((await self.db.execute(stmt.order_by(Promotion.name))).scalars().all())

    async def get(self, promo_id: int, tenant_id: int) -> Optional[Promotion]:
        stmt = select(Promotion).where(Promotion.id == promo_id, Promotion.tenant_id == tenant_id, Promotion.is_deleted == False)
        return (await self.db.execute(stmt)).scalar_one_or_none()


# ── Loyalty ───────────────────────────────────────────────────────────────────

class LoyaltyRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_account(self, customer_id: int) -> Optional[LoyaltyAccount]:
        stmt = select(LoyaltyAccount).where(LoyaltyAccount.customer_id == customer_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def adjust(self, acc: LoyaltyAccount, data: LoyaltyAdjust) -> LoyaltyAccount:
        if data.txn_type == LoyaltyTxnType.REDEEM and data.points > acc.points_balance:
            raise ValueError(f"Insufficient points: balance {acc.points_balance}, requested {data.points}")
        delta = -data.points if data.txn_type == LoyaltyTxnType.REDEEM else data.points
        acc.points_balance    += delta
        acc.lifetime_redeemed += (data.points if data.txn_type == LoyaltyTxnType.REDEEM else 0)
        self.db.add(LoyaltyTransaction(
            account_id=acc.id, txn_type=data.txn_type,
            points=delta, balance_after=acc.points_balance,
            description=data.description,
        ))
        await self.db.commit()
        await self.db.refresh(acc)
        return acc
