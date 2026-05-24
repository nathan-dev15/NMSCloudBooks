"""
Invoice GST calculation engine + business logic (SOW §5.x).

GST rules:
- IGST  (interstate): full GST rate applied as IGST only
- CGST+SGST (intra-state): rate split equally — 18% → 9% CGST + 9% SGST
- NONE: zero-rated / exempt
"""
from __future__ import annotations
from datetime import date, datetime, timezone
from typing import Optional
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceItem, InvoicePayment, InvoiceStatus, GSTType
from app.models.client import Client
from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate, InvoiceUpdate, PaymentCreate
from app.services.audit_service import AuditService, model_snapshot
from app.core.deletion_guard import assert_is_latest


# ── GST calculation helpers ───────────────────────────────────────────────────

def _calc_item(item: InvoiceItemCreate, gst_type: GSTType) -> dict:
    """Return computed field dict for one InvoiceItem row."""
    gross    = round(item.quantity * item.rate, 2)
    discount = round(gross * item.discount_pct / 100, 2)
    taxable  = round(gross - discount, 2)

    gst_rate = item.gst_rate
    cgst_rate = sgst_rate = igst_rate = 0.0
    cgst_amt  = sgst_amt  = igst_amt  = 0.0

    if gst_type == GSTType.IGST:
        igst_rate = gst_rate
        igst_amt  = round(taxable * igst_rate / 100, 2)
    elif gst_type == GSTType.CGST_SGST:
        cgst_rate = sgst_rate = round(gst_rate / 2, 2)
        cgst_amt  = round(taxable * cgst_rate / 100, 2)
        sgst_amt  = round(taxable * sgst_rate / 100, 2)

    line_total = round(taxable + cgst_amt + sgst_amt + igst_amt, 2)
    return {
        "taxable_amount": taxable,
        "gst_rate":       gst_rate,
        "cgst_rate":      cgst_rate,
        "sgst_rate":      sgst_rate,
        "igst_rate":      igst_rate,
        "cgst_amount":    cgst_amt,
        "sgst_amount":    sgst_amt,
        "igst_amount":    igst_amt,
        "line_total":     line_total,
    }


def _aggregate_totals(item_calcs: list[dict], header_discount: float, gst_type: GSTType) -> dict:
    """Roll up line items into invoice-level totals."""
    taxable_total = cgst_total = sgst_total = igst_total = 0.0
    for c in item_calcs:
        taxable_total += c["taxable_amount"]
        cgst_total    += c["cgst_amount"]
        sgst_total    += c["sgst_amount"]
        igst_total    += c["igst_amount"]

    adj_discount = min(round(header_discount, 2), taxable_total)
    adj_taxable  = round(taxable_total - adj_discount, 2)
    scale        = adj_taxable / taxable_total if taxable_total else 1.0
    cgst_total   = round(cgst_total * scale, 2)
    sgst_total   = round(sgst_total * scale, 2)
    igst_total   = round(igst_total * scale, 2)
    total_tax    = round(cgst_total + sgst_total + igst_total, 2)
    gross_total  = round(adj_taxable + total_tax, 2)
    round_off    = round(round(gross_total) - gross_total, 2)
    grand_total  = round(gross_total + round_off, 2)

    return {
        "subtotal":         taxable_total,
        "discount_amount":  adj_discount,
        "taxable_amount":   adj_taxable,
        "cgst_amount":      cgst_total,
        "sgst_amount":      sgst_total,
        "igst_amount":      igst_total,
        "total_tax_amount": total_tax,
        "round_off":        round_off,
        "grand_total":      grand_total,
    }


# ── Service ───────────────────────────────────────────────────────────────────

class InvoiceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _format_invoice_number(self, tenant_id: int, invoice_id: int) -> str:
        year = date.today().year
        return f"INV-{tenant_id:03d}-{year}-{invoice_id:05d}"

    async def create(
        self, tenant_id: int, created_by_id: int, data: InvoiceCreate
    ) -> Invoice:
        client_row = (await self.db.execute(
            select(Client).where(Client.id == data.client_id)
        )).scalar_one_or_none()

        billing_name    = client_row.display_name if client_row else None
        billing_address = _format_address(client_row) if client_row else None
        billing_gstin   = client_row.gstin if client_row else None

        item_calcs = [_calc_item(it, data.gst_type) for it in data.items]
        totals     = _aggregate_totals(item_calcs, data.discount_amount, data.gst_type)

        invoice = Invoice(
            tenant_id=tenant_id,
            client_id=data.client_id,
            created_by_id=created_by_id,
            invoice_number=data.invoice_number or "PENDING",
            reference_no=data.reference_no,
            invoice_date=data.invoice_date,
            due_date=data.due_date,
            supply_date=data.supply_date,
            gst_type=data.gst_type,
            place_of_supply=data.place_of_supply,
            currency=data.currency,
            notes=data.notes,
            terms=data.terms,
            is_recurring=data.is_recurring,
            tags=data.tags,
            billing_name=billing_name,
            billing_address=billing_address,
            billing_gstin=billing_gstin,
            amount_due=totals["grand_total"],
            **totals,
        )
        self.db.add(invoice)
        await self.db.flush()

        if not data.invoice_number:
            invoice.invoice_number = self._format_invoice_number(tenant_id, invoice.id)

        for idx, (item_in, calc) in enumerate(zip(data.items, item_calcs)):
            self.db.add(InvoiceItem(
                invoice_id=invoice.id,
                item_order=idx,
                description=item_in.description,
                hsn_sac=item_in.hsn_sac,
                unit=item_in.unit,
                quantity=item_in.quantity,
                rate=item_in.rate,
                discount_pct=item_in.discount_pct,
                **calc,
            ))

        await AuditService(self.db).log(
            action="CREATE",
            resource_type="billing_invoices",
            resource_id=invoice.id,
            doc_number=invoice.invoice_number,
            user_id=created_by_id,
            tenant_id=tenant_id,
            after=model_snapshot(invoice),
        )

        await self.db.commit()
        return await self._reload(invoice.id)

    async def update(
        self, invoice: Invoice, data: InvoiceUpdate, user_id: int | None = None
    ) -> Invoice:
        if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.SENT):
            raise ValueError("Only DRAFT or SENT invoices can be edited")

        before = model_snapshot(invoice)

        # Invoice number changes — DRAFT only
        if data.invoice_number or data.regenerate_invoice_number:
            if invoice.status != InvoiceStatus.DRAFT:
                raise ValueError("Invoice number can only be changed on DRAFT invoices")
            if data.regenerate_invoice_number:
                invoice.invoice_number = self._format_invoice_number(
                    invoice.tenant_id, invoice.id
                )
            else:
                conflict = (await self.db.execute(
                    select(Invoice.id).where(
                        Invoice.tenant_id == invoice.tenant_id,
                        Invoice.invoice_number == data.invoice_number,
                        Invoice.id != invoice.id,
                        Invoice.is_deleted == False,
                    )
                )).scalar_one_or_none()
                if conflict:
                    raise ValueError(f"Invoice number '{data.invoice_number}' is already in use")
                invoice.invoice_number = data.invoice_number

        for field in {"reference_no", "invoice_date", "due_date", "supply_date",
                      "gst_type", "place_of_supply", "notes", "terms", "tags"}:
            val = getattr(data, field, None)
            if val is not None:
                setattr(invoice, field, val)

        if data.items is not None:
            await self.db.execute(
                sa_delete(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)
            )
            gst_type   = data.gst_type or invoice.gst_type
            disc       = data.discount_amount if data.discount_amount is not None else invoice.discount_amount
            item_calcs = [_calc_item(it, gst_type) for it in data.items]
            totals     = _aggregate_totals(item_calcs, disc, gst_type)
            for k, v in totals.items():
                setattr(invoice, k, v)
            invoice.amount_due = totals["grand_total"] - invoice.amount_paid
            for idx, (item_in, calc) in enumerate(zip(data.items, item_calcs)):
                self.db.add(InvoiceItem(
                    invoice_id=invoice.id,
                    item_order=idx,
                    description=item_in.description,
                    hsn_sac=item_in.hsn_sac,
                    unit=item_in.unit,
                    quantity=item_in.quantity,
                    rate=item_in.rate,
                    discount_pct=item_in.discount_pct,
                    **calc,
                ))

        await AuditService(self.db).log(
            action="UPDATE",
            resource_type="billing_invoices",
            resource_id=invoice.id,
            doc_number=invoice.invoice_number,
            user_id=user_id,
            tenant_id=invoice.tenant_id,
            before=before,
            after=model_snapshot(invoice),
        )

        await self.db.commit()
        return await self._reload(invoice.id)

    async def cancel(self, invoice: Invoice, user_id: int | None = None) -> Invoice:
        """Explicit cancel — preferred alternative to deletion for non-latest invoices."""
        allowed = {InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE}
        if invoice.status not in allowed:
            raise ValueError(f"Cannot cancel an invoice in {invoice.status} status")

        before = {"status": invoice.status.value}
        invoice.status    = InvoiceStatus.CANCELLED
        invoice.is_active = False

        await AuditService(self.db).log(
            action="CANCEL",
            resource_type="billing_invoices",
            resource_id=invoice.id,
            doc_number=invoice.invoice_number,
            user_id=user_id,
            tenant_id=invoice.tenant_id,
            before=before,
            after={"status": InvoiceStatus.CANCELLED.value},
        )

        await self.db.commit()
        return await self._reload(invoice.id)

    async def delete(
        self, invoice_id: int, tenant_id: int | None, user_id: int | None = None
    ) -> bool:
        """
        Soft-delete an invoice. Business rules:
          1. Status must be DRAFT or CANCELLED.
          2. Must be the latest (highest-id) non-deleted invoice for the tenant.
        """
        from app.repositories.invoice_repository import InvoiceRepository
        repo = InvoiceRepository(self.db)
        inv  = await repo.get(invoice_id, tenant_id)
        if not inv:
            return False

        if inv.status not in (InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED):
            raise ValueError("Only DRAFT or CANCELLED invoices can be deleted")

        await assert_is_latest(self.db, Invoice, invoice_id, tenant_id, "invoice")

        before = model_snapshot(inv)
        inv.is_deleted = True
        inv.deleted_at = datetime.now(timezone.utc)
        inv.is_active  = False

        await AuditService(self.db).log(
            action="DELETE",
            resource_type="billing_invoices",
            resource_id=invoice_id,
            doc_number=inv.invoice_number,
            user_id=user_id,
            tenant_id=tenant_id,
            before=before,
        )

        await self.db.commit()
        return True

    async def record_payment(
        self, invoice: Invoice, recorded_by_id: int, data: PaymentCreate
    ) -> InvoicePayment:
        if invoice.status == InvoiceStatus.CANCELLED:
            raise ValueError("Cannot record payment on a cancelled invoice")

        payment = InvoicePayment(
            invoice_id=invoice.id,
            recorded_by_id=recorded_by_id,
            **data.model_dump(),
        )
        self.db.add(payment)

        invoice.amount_paid = round(float(invoice.amount_paid) + float(data.amount), 2)
        invoice.amount_due  = round(float(invoice.grand_total) - float(invoice.amount_paid), 2)
        if invoice.amount_due <= 0:
            invoice.status    = InvoiceStatus.PAID
            invoice.amount_due = 0.0
        elif invoice.amount_paid > 0:
            invoice.status = InvoiceStatus.PARTIAL

        await AuditService(self.db).log(
            action="PAYMENT_RECORDED",
            resource_type="billing_invoices",
            resource_id=invoice.id,
            doc_number=invoice.invoice_number,
            user_id=recorded_by_id,
            tenant_id=invoice.tenant_id,
            after={"amount": data.amount, "mode": data.mode.value if hasattr(data.mode, "value") else data.mode},
            description=f"Payment of {data.amount} recorded on {invoice.invoice_number}",
        )

        await self.db.commit()
        await self.db.refresh(payment)
        return payment

    async def change_status(
        self, invoice: Invoice, new_status: InvoiceStatus, user_id: int | None = None
    ) -> Invoice:
        allowed_transitions = {
            InvoiceStatus.DRAFT:     {InvoiceStatus.SENT, InvoiceStatus.CANCELLED},
            InvoiceStatus.SENT:      {InvoiceStatus.PARTIAL, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED},
            InvoiceStatus.PARTIAL:   {InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED},
            InvoiceStatus.OVERDUE:   {InvoiceStatus.PAID, InvoiceStatus.CANCELLED},
            InvoiceStatus.PAID:      {InvoiceStatus.VOID},
            InvoiceStatus.CANCELLED: set(),
            InvoiceStatus.VOID:      set(),
        }
        if new_status not in allowed_transitions.get(invoice.status, set()):
            raise ValueError(f"Cannot transition from {invoice.status} to {new_status}")

        before = {"status": invoice.status.value}
        invoice.status = new_status

        await AuditService(self.db).log(
            action="STATUS_CHANGE",
            resource_type="billing_invoices",
            resource_id=invoice.id,
            doc_number=invoice.invoice_number,
            user_id=user_id,
            tenant_id=invoice.tenant_id,
            before=before,
            after={"status": new_status.value},
        )

        await self.db.commit()
        return await self._reload(invoice.id)

    async def _reload(self, invoice_id: int) -> Invoice:
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(selectinload(Invoice.items), selectinload(Invoice.payments))
        )
        return result.scalar_one()


def _format_address(client: Client) -> str:
    parts = [
        client.address_line1, client.address_line2,
        client.city, client.state, client.pincode, client.country,
    ]
    return ", ".join(p for p in parts if p)
