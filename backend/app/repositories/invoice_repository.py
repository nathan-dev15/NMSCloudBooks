from __future__ import annotations
import math
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceStatus
from app.core.filters import FilterBuilder


class InvoiceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, invoice_id: int, tenant_id: Optional[int] = None) -> Optional[Invoice]:
        stmt = (
            select(Invoice)
            .options(selectinload(Invoice.items), selectinload(Invoice.payments))
            .where(Invoice.id == invoice_id, Invoice.is_deleted == False)
        )
        if tenant_id is not None:
            stmt = stmt.where(Invoice.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_by_number(self, number: str, tenant_id: Optional[int] = None) -> Optional[Invoice]:
        stmt = select(Invoice).where(Invoice.invoice_number == number, Invoice.is_deleted == False)
        if tenant_id is not None:
            stmt = stmt.where(Invoice.tenant_id == tenant_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list(
        self,
        tenant_id: Optional[int],
        page: int = 1,
        size: int = 20,
        # Single keyword search
        search: Optional[str] = None,
        # Multi-keyword search (caller splits on comma)
        multi_q: Optional[list[str]] = None,
        # Exact / dropdown filters
        status: Optional[str] = None,
        statuses: Optional[list[str]] = None,   # multi-status
        client_id: Optional[int] = None,
        project_id: Optional[int] = None,       # cascading: project → block
        project_block_id: Optional[int] = None,
        invoice_type: Optional[str] = None,
        # Date range
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> tuple[list[Invoice], int]:
        base = select(Invoice).where(Invoice.is_deleted == False)

        stmt = (
            FilterBuilder(base)
            .tenant(Invoice.tenant_id, tenant_id)
            .single_search(search, Invoice.invoice_number, Invoice.reference_no, Invoice.billing_name)
            .multi_search(multi_q, Invoice.invoice_number, Invoice.reference_no, Invoice.billing_name, Invoice.billing_gstin)
            .eq(Invoice.status, status)
            .in_(Invoice.status, statuses)
            .eq(Invoice.client_id, client_id)
            .eq(Invoice.project_id, project_id)
            .eq(Invoice.project_block_id, project_block_id)
            .eq(Invoice.invoice_type, invoice_type)
            .date_range(Invoice.invoice_date, from_date, to_date)
            .build()
        )

        total = (await self.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt  = stmt.order_by(Invoice.invoice_date.desc(), Invoice.id.desc()).offset((page - 1) * size).limit(size)
        rows  = (await self.db.execute(stmt)).scalars().all()
        return list(rows), total

    async def filter_options(self, tenant_id: Optional[int]) -> dict:
        """Return distinct values for dropdown filters (cascading-search support)."""
        def _base():
            stmt = select(Invoice).where(Invoice.is_deleted == False)
            if tenant_id is not None:
                stmt = stmt.where(Invoice.tenant_id == tenant_id)
            return stmt

        statuses = (await self.db.execute(
            select(Invoice.status)
            .where(Invoice.is_deleted == False)
            .where(*(  [Invoice.tenant_id == tenant_id] if tenant_id is not None else []  ))
            .distinct()
        )).scalars().all()

        types = (await self.db.execute(
            select(Invoice.invoice_type)
            .where(Invoice.is_deleted == False, Invoice.invoice_type.isnot(None))
            .where(*(  [Invoice.tenant_id == tenant_id] if tenant_id is not None else []  ))
            .distinct()
        )).scalars().all()

        return {
            "statuses":      [s.value if hasattr(s, "value") else s for s in statuses],
            "invoice_types": list(filter(None, types)),
        }

    @staticmethod
    def pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0
