"""
Reusable SQLAlchemy filter / search builder.

Usage:
    stmt = (
        FilterBuilder(select(Invoice).where(Invoice.is_deleted == False))
        .tenant(Invoice.tenant_id, tenant_id)
        .single_search(q, Invoice.invoice_number, Invoice.billing_name)
        .multi_search(multi_q, Invoice.invoice_number, Invoice.billing_name)
        .eq(Invoice.status, status)
        .in_(Invoice.status, statuses)           # multiple status values
        .date_range(Invoice.invoice_date, from_date, to_date)
        .build()
    )
"""
from typing import Any
from sqlalchemy import or_


class FilterBuilder:
    def __init__(self, stmt):
        self._stmt = stmt

    # ── Scope ────────────────────────────────────────────────────────────────

    def tenant(self, column, tenant_id: int | None):
        """Apply tenant scope (skip for SUPER_ADMIN where tenant_id is None)."""
        if tenant_id is not None:
            self._stmt = self._stmt.where(column == tenant_id)
        return self

    # ── Search ───────────────────────────────────────────────────────────────

    def single_search(self, term: str | None, *columns):
        """OR ILIKE search for a single keyword across supplied columns."""
        if term:
            like = f"%{term}%"
            self._stmt = self._stmt.where(or_(*[c.ilike(like) for c in columns]))
        return self

    def multi_search(self, terms: list[str] | None, *columns):
        """
        Multi-keyword AND search: every term must match at least one column.
        Pass already-split list; endpoint splits on comma.
        Example: ["INV", "2026"] → rows where "INV" appears anywhere AND "2026" appears anywhere.
        """
        if terms:
            for t in terms:
                like = f"%{t.strip()}%"
                self._stmt = self._stmt.where(or_(*[c.ilike(like) for c in columns]))
        return self

    # ── Exact / Set ──────────────────────────────────────────────────────────

    def eq(self, column, value: Any):
        """Filter by exact value (skipped when value is None)."""
        if value is not None:
            self._stmt = self._stmt.where(column == value)
        return self

    def in_(self, column, values: list | None):
        """Filter by membership in a list (e.g. multiple statuses)."""
        if values:
            self._stmt = self._stmt.where(column.in_(values))
        return self

    # ── Date range ───────────────────────────────────────────────────────────

    def date_range(self, column, from_date: str | None, to_date: str | None):
        if from_date:
            self._stmt = self._stmt.where(column >= from_date)
        if to_date:
            self._stmt = self._stmt.where(column <= to_date)
        return self

    # ── Cascading helpers ────────────────────────────────────────────────────

    def cascade(self, column, value: Any):
        """Alias for eq() — use for dependent-dropdown (cascading) filters."""
        return self.eq(column, value)

    # ── Terminal ─────────────────────────────────────────────────────────────

    def build(self):
        return self._stmt
