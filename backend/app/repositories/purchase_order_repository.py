from __future__ import annotations
import math
from datetime import date, datetime, timezone
from typing import Optional
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.purchase_order import PurchaseOrder, POItem, POStatus, POPriority
from app.models.client import Client
from app.schemas.purchase_order import POCreate, POUpdate, POReceive
from app.core.filters import FilterBuilder
from app.core.deletion_guard import assert_is_latest
from app.services.audit_service import AuditService, model_snapshot


class PurchaseOrderRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _format_po_number(tenant_id: int, po_id: int) -> str:
        return f"PO-{tenant_id:03d}-{date.today().year}-{po_id:05d}"

    @staticmethod
    def _calc_item(qty: float, price: float, tax_rate: float) -> tuple[float, float, float]:
        subtotal   = round(qty * price, 2)
        tax_amount = round(subtotal * tax_rate / 100, 2)
        return subtotal, tax_amount, round(subtotal + tax_amount, 2)

    async def _vendor_snapshot(self, vendor_id: Optional[int]) -> tuple[Optional[str], Optional[str], Optional[str]]:
        if not vendor_id:
            return None, None, None
        client = (await self.db.execute(select(Client).where(Client.id == vendor_id))).scalar_one_or_none()
        if not client:
            return None, None, None
        addr_parts = [client.address_line1, client.address_line2, client.city, client.state, client.pincode, client.country]
        return client.display_name, ", ".join(p for p in addr_parts if p) or None, client.gstin

    async def _load_full(self, po_id: int) -> PurchaseOrder:
        return (await self.db.execute(
            select(PurchaseOrder).options(selectinload(PurchaseOrder.items)).where(PurchaseOrder.id == po_id)
        )).scalar_one()

    # ── CRUD ──────────────────────────────────────────────────────────────────

    async def create(self, tenant_id: int, created_by_id: int, data: POCreate) -> PurchaseOrder:
        vendor_name, vendor_address, vendor_gstin = await self._vendor_snapshot(data.vendor_id)

        item_rows, subtotal_total, tax_total = [], 0.0, 0.0
        for idx, it in enumerate(data.items):
            sub, tax, total = self._calc_item(it.quantity, it.unit_price, it.tax_rate)
            subtotal_total += sub
            tax_total      += tax
            item_rows.append(dict(
                item_order=idx, description=it.description, sku=it.sku,
                hsn_sac=it.hsn_sac, unit=it.unit,
                quantity=it.quantity, unit_price=it.unit_price,
                tax_rate=it.tax_rate, tax_amount=tax, line_total=total,
            ))

        grand_total = round(subtotal_total + tax_total - data.discount_amount, 2)

        po = PurchaseOrder(
            tenant_id=tenant_id,
            created_by_id=created_by_id,
            vendor_id=data.vendor_id,
            po_number=data.po_number or "PENDING",  # resolved after flush
            reference_no=data.reference_no,
            order_date=data.order_date,
            expected_date=data.expected_date,
            priority=data.priority,
            currency=data.currency,
            subtotal=round(subtotal_total, 2),
            tax_amount=round(tax_total, 2),
            discount_amount=data.discount_amount,
            grand_total=grand_total,
            vendor_name=vendor_name,
            vendor_address=vendor_address,
            vendor_gstin=vendor_gstin,
            delivery_address=data.delivery_address,
            shipping_terms=data.shipping_terms,
            payment_terms=data.payment_terms,
            notes=data.notes,
            internal_notes=data.internal_notes,
            tags=data.tags,
        )
        self.db.add(po)
        await self.db.flush()  # get po.id

        if not data.po_number:
            po.po_number = self._format_po_number(tenant_id, po.id)

        for row in item_rows:
            self.db.add(POItem(purchase_order_id=po.id, **row))

        await AuditService(self.db).log(
            action="CREATE",
            resource_type="purchase_orders",
            resource_id=po.id,
            doc_number=po.po_number,
            user_id=created_by_id,
            tenant_id=tenant_id,
            after=model_snapshot(po),
        )

        await self.db.commit()
        return await self._load_full(po.id)

    async def get(self, po_id: int, tenant_id: Optional[int] = None) -> Optional[PurchaseOrder]:
        stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.items))
            .where(PurchaseOrder.id == po_id, PurchaseOrder.is_deleted == False)
        )
        if tenant_id is not None:
            stmt = stmt.where(PurchaseOrder.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self,
        tenant_id: Optional[int],
        page: int = 1,
        size: int = 20,
        search: Optional[str] = None,
        multi_q: Optional[list[str]] = None,
        status: Optional[str] = None,
        statuses: Optional[list[str]] = None,
        priority: Optional[str] = None,
        priorities: Optional[list[str]] = None,
        vendor_id: Optional[int] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> tuple[list[PurchaseOrder], int]:
        base = select(PurchaseOrder).where(PurchaseOrder.is_deleted == False)

        stmt = (
            FilterBuilder(base)
            .tenant(PurchaseOrder.tenant_id, tenant_id)
            .single_search(search, PurchaseOrder.po_number, PurchaseOrder.reference_no, PurchaseOrder.vendor_name)
            .multi_search(multi_q, PurchaseOrder.po_number, PurchaseOrder.reference_no, PurchaseOrder.vendor_name, PurchaseOrder.vendor_gstin)
            .eq(PurchaseOrder.status, status)
            .in_(PurchaseOrder.status, statuses)
            .eq(PurchaseOrder.priority, priority)
            .in_(PurchaseOrder.priority, priorities)
            .eq(PurchaseOrder.vendor_id, vendor_id)
            .date_range(PurchaseOrder.order_date, from_date, to_date)
            .build()
        )

        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt  = stmt.order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc()).offset((page - 1) * size).limit(size)
        rows  = (await self.db.execute(stmt)).scalars().all()
        return list(rows), total

    async def filter_options(self, tenant_id: Optional[int]) -> dict:
        """Return distinct dropdown values for cascading filter support."""
        base_filter = [PurchaseOrder.is_deleted == False]
        if tenant_id is not None:
            base_filter.append(PurchaseOrder.tenant_id == tenant_id)

        statuses = (await self.db.execute(
            select(PurchaseOrder.status).where(*base_filter).distinct()
        )).scalars().all()
        priorities = (await self.db.execute(
            select(PurchaseOrder.priority).where(*base_filter).distinct()
        )).scalars().all()

        return {
            "statuses":   [s.value if hasattr(s, "value") else s for s in statuses],
            "priorities": [p.value if hasattr(p, "value") else p for p in priorities],
        }

    async def update(
        self, po: PurchaseOrder, data: POUpdate, user_id: int | None = None
    ) -> PurchaseOrder:
        if po.status not in (POStatus.DRAFT, POStatus.PENDING):
            raise ValueError("Only DRAFT or PENDING POs can be edited")

        before = model_snapshot(po)

        # PO number changes — DRAFT only
        if data.po_number or data.regenerate_po_number:
            if po.status != POStatus.DRAFT:
                raise ValueError("PO number can only be changed on DRAFT purchase orders")
            if data.regenerate_po_number:
                po.po_number = self._format_po_number(po.tenant_id, po.id)
            else:
                conflict = (await self.db.execute(
                    select(PurchaseOrder.id).where(
                        PurchaseOrder.tenant_id == po.tenant_id,
                        PurchaseOrder.po_number == data.po_number,
                        PurchaseOrder.id != po.id,
                        PurchaseOrder.is_deleted == False,
                    )
                )).scalar_one_or_none()
                if conflict:
                    raise ValueError(f"PO number '{data.po_number}' is already in use")
                po.po_number = data.po_number

        for f in {"vendor_id", "reference_no", "order_date", "expected_date",
                  "priority", "delivery_address", "shipping_terms",
                  "payment_terms", "notes", "internal_notes", "tags"}:
            v = getattr(data, f, None)
            if v is not None:
                setattr(po, f, v)

        if data.vendor_id is not None:
            vn, va, vg = await self._vendor_snapshot(data.vendor_id)
            po.vendor_name, po.vendor_address, po.vendor_gstin = vn, va, vg

        if data.items is not None:
            await self.db.execute(delete(POItem).where(POItem.purchase_order_id == po.id))
            disc = data.discount_amount if data.discount_amount is not None else po.discount_amount
            sub_t = tax_t = 0.0
            for idx, it in enumerate(data.items):
                sub, tax, total = self._calc_item(it.quantity, it.unit_price, it.tax_rate)
                sub_t += sub; tax_t += tax
                self.db.add(POItem(
                    purchase_order_id=po.id, item_order=idx,
                    description=it.description, sku=it.sku, hsn_sac=it.hsn_sac,
                    unit=it.unit, quantity=it.quantity, unit_price=it.unit_price,
                    tax_rate=it.tax_rate, tax_amount=tax, line_total=total,
                ))
            po.subtotal        = round(sub_t, 2)
            po.tax_amount      = round(tax_t, 2)
            po.discount_amount = disc
            po.grand_total     = round(sub_t + tax_t - disc, 2)

        await AuditService(self.db).log(
            action="UPDATE",
            resource_type="purchase_orders",
            resource_id=po.id,
            doc_number=po.po_number,
            user_id=user_id,
            tenant_id=po.tenant_id,
            before=before,
            after=model_snapshot(po),
        )

        await self.db.commit()
        return await self._load_full(po.id)

    async def change_status(
        self, po: PurchaseOrder, new_status: POStatus,
        user_id: Optional[int] = None,
        rejection_reason: Optional[str] = None,
    ) -> PurchaseOrder:
        allowed: dict[POStatus, set[POStatus]] = {
            POStatus.DRAFT:     {POStatus.PENDING, POStatus.CANCELLED},
            POStatus.PENDING:   {POStatus.APPROVED, POStatus.CANCELLED},
            POStatus.APPROVED:  {POStatus.ORDERED, POStatus.CANCELLED},
            POStatus.ORDERED:   {POStatus.PARTIAL, POStatus.RECEIVED, POStatus.CANCELLED},
            POStatus.PARTIAL:   {POStatus.RECEIVED, POStatus.CLOSED},
            POStatus.RECEIVED:  {POStatus.CLOSED},
            POStatus.CANCELLED: set(),
            POStatus.CLOSED:    set(),
        }
        if new_status not in allowed.get(po.status, set()):
            raise ValueError(f"Cannot transition from {po.status} to {new_status}")

        before = {"status": po.status.value if hasattr(po.status, "value") else po.status}
        po.status = new_status
        if new_status == POStatus.APPROVED:
            po.approved_by_id = user_id
            po.approved_date  = date.today().isoformat()
        if rejection_reason:
            po.rejection_reason = rejection_reason

        action = "CANCEL" if new_status == POStatus.CANCELLED else "STATUS_CHANGE"
        await AuditService(self.db).log(
            action=action,
            resource_type="purchase_orders",
            resource_id=po.id,
            doc_number=po.po_number,
            user_id=user_id,
            tenant_id=po.tenant_id,
            before=before,
            after={"status": new_status.value if hasattr(new_status, "value") else new_status},
        )

        await self.db.commit()
        return await self._load_full(po.id)

    async def cancel(
        self, po: PurchaseOrder, user_id: int | None = None
    ) -> PurchaseOrder:
        """Explicit cancel — preferred alternative to deletion."""
        cancellable = {POStatus.DRAFT, POStatus.PENDING, POStatus.APPROVED, POStatus.ORDERED}
        if po.status not in cancellable:
            raise ValueError(f"Cannot cancel a PO in {po.status} status")
        return await self.change_status(po, POStatus.CANCELLED, user_id=user_id)

    async def record_receipt(
        self, po: PurchaseOrder, data: POReceive, user_id: int | None = None
    ) -> PurchaseOrder:
        if po.status not in (POStatus.ORDERED, POStatus.PARTIAL):
            raise ValueError("PO must be in ORDERED or PARTIAL state to record receipt")

        item_map = {i.id: i for i in po.items}
        for recv in data.items:
            item = item_map.get(recv.item_id)
            if not item:
                raise ValueError(f"Item {recv.item_id} not found in this PO")
            remaining = item.quantity - item.qty_received
            if recv.qty_received > remaining:
                raise ValueError(
                    f"Receiving {recv.qty_received} exceeds remaining qty {remaining} for item {recv.item_id}"
                )
            item.qty_received = round(item.qty_received + recv.qty_received, 3)
            if item.qty_received >= item.quantity:
                item.is_closed = True

        po.received_date = data.received_date
        if data.notes:
            po.internal_notes = (po.internal_notes or "") + f"\nReceipt note: {data.notes}"

        all_closed = all(i.is_closed for i in po.items)
        po.status  = POStatus.RECEIVED if all_closed else POStatus.PARTIAL

        await AuditService(self.db).log(
            action="RECEIPT_RECORDED",
            resource_type="purchase_orders",
            resource_id=po.id,
            doc_number=po.po_number,
            user_id=user_id,
            tenant_id=po.tenant_id,
            after={"received_date": data.received_date, "status": po.status.value},
        )

        await self.db.commit()
        return await self._load_full(po.id)

    async def soft_delete(
        self, po_id: int, tenant_id: Optional[int], user_id: int | None = None
    ) -> bool:
        """
        Business rules:
          1. Status must be DRAFT or CANCELLED.
          2. Must be the latest non-deleted PO for the tenant.
        """
        po = await self.get(po_id, tenant_id)
        if not po:
            return False
        if po.status not in (POStatus.DRAFT, POStatus.CANCELLED):
            raise ValueError("Only DRAFT or CANCELLED POs can be deleted")

        await assert_is_latest(self.db, PurchaseOrder, po_id, tenant_id, "purchase order")

        before = model_snapshot(po)
        po.is_deleted = True
        po.deleted_at = datetime.now(timezone.utc)

        await AuditService(self.db).log(
            action="DELETE",
            resource_type="purchase_orders",
            resource_id=po_id,
            doc_number=po.po_number,
            user_id=user_id,
            tenant_id=tenant_id,
            before=before,
        )

        await self.db.commit()
        return True

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0
