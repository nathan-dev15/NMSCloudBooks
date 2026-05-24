"""
Document export service — CSV, Excel, PDF.

Requires:
    pip install openpyxl fpdf2
"""
from __future__ import annotations
import csv
import io
from typing import Any

from fastapi.responses import StreamingResponse


# ── Low-level formatters ──────────────────────────────────────────────────────

def _fmt(v) -> str:
    """Format numeric values with two decimal places."""
    if v is None:
        return "-"
    try:
        return f"{float(v):,.2f}"
    except (TypeError, ValueError):
        return str(v)


def _enum_val(v) -> str:
    return v.value if hasattr(v, "value") else (str(v) if v is not None else "")


def _rows_to_csv(rows: list[dict], headers: list[str]) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )


def _rows_to_excel(
    rows: list[dict], headers: list[str], sheet_name: str = "Sheet1", filename: str = "export.xlsx"
) -> StreamingResponse:
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise RuntimeError("openpyxl is required: pip install openpyxl")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name

    header_fill = PatternFill("solid", fgColor="2B4E7E")
    header_font = Font(bold=True, color="FFFFFF")
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for row in rows:
        ws.append([row.get(h) for h in headers])

    # Auto-width
    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _build_pdf(title: str, sections: list[dict], filename: str = "export.pdf") -> StreamingResponse:
    """
    Build a PDF using fpdf2 (free, LGPL, pure-Python).

    sections: list of {
        "heading": str,
        "data": dict | list[dict],
        "headers": list[str],   # required when data is a list
    }
    """
    try:
        from fpdf import FPDF
    except ImportError:
        raise RuntimeError("fpdf2 is required: pip install fpdf2")

    BR, BG, BB = 43, 78, 126   # brand blue #2B4E7E

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(left=15, top=20, right=15)
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ── Document title ────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 15)
    pdf.set_text_color(BR, BG, BB)
    pdf.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(BR, BG, BB)
    pdf.set_line_width(0.4)
    pdf.line(15, pdf.get_y(), pdf.w - 15, pdf.get_y())
    pdf.ln(4)
    pdf.set_text_color(0, 0, 0)

    usable_w = pdf.w - pdf.l_margin - pdf.r_margin

    for sec in sections:
        # ── Section heading ───────────────────────────────────────────────────
        if sec.get("heading"):
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(BR, BG, BB)
            pdf.cell(0, 7, sec["heading"], new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)
            pdf.ln(1)

        data = sec.get("data", {})
        hdrs = sec.get("headers", [])

        if isinstance(data, dict):
            # ── Key-value table ───────────────────────────────────────────────
            pdf.set_font("Helvetica", "", 9)
            key_w, val_w = 60, usable_w - 60
            for k, v in data.items():
                pdf.set_fill_color(232, 237, 245)
                pdf.cell(key_w, 7, str(k), border=1, fill=True)
                pdf.set_fill_color(255, 255, 255)
                pdf.cell(val_w, 7, str(v) if v is not None else "", border=1,
                         new_x="LMARGIN", new_y="NEXT")

        elif isinstance(data, list) and hdrs:
            # ── Column table ──────────────────────────────────────────────────
            col_w = usable_w / len(hdrs)

            # Header row
            pdf.set_fill_color(BR, BG, BB)
            pdf.set_text_color(255, 255, 255)
            pdf.set_font("Helvetica", "B", 8)
            for h in hdrs:
                pdf.cell(col_w, 7, str(h), border=1, fill=True)
            pdf.ln()

            # Data rows with alternating shading
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("Helvetica", "", 8)
            for i, row in enumerate(data):
                pdf.set_fill_color(255, 255, 255) if i % 2 == 0 else pdf.set_fill_color(245, 245, 245)
                for h in hdrs:
                    pdf.cell(col_w, 6, str(row.get(h) or ""), border=1, fill=True)
                pdf.ln()

        pdf.ln(5)

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue()),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Public ExportService ──────────────────────────────────────────────────────

class ExportService:
    """Build export responses for each document type."""

    # ── Invoices ─────────────────────────────────────────────────────────────

    @staticmethod
    def invoices_list(invoices: list, fmt: str = "csv") -> StreamingResponse:
        headers = [
            "invoice_number", "invoice_date", "due_date", "status",
            "billing_name", "billing_gstin", "currency",
            "subtotal", "discount_amount", "taxable_amount",
            "cgst_amount", "sgst_amount", "igst_amount",
            "grand_total", "amount_paid", "amount_due",
        ]
        rows = [{h: _enum_val(getattr(inv, h, None)) for h in headers} for inv in invoices]
        if fmt == "excel":
            return _rows_to_excel(rows, headers, "Invoices", "invoices.xlsx")
        return _rows_to_csv(rows, headers)

    @staticmethod
    def invoice_pdf(inv) -> StreamingResponse:
        header = {
            "Invoice #":    inv.invoice_number,
            "Date":         inv.invoice_date,
            "Due Date":     inv.due_date,
            "Status":       _enum_val(inv.status),
            "Client":       inv.billing_name or "-",
            "GSTIN":        inv.billing_gstin or "-",
            "Address":      inv.billing_address or "-",
            "Currency":     inv.currency,
            "Reference #":  inv.reference_no or "-",
        }
        totals = {
            "Subtotal":     _fmt(inv.subtotal),
            "Discount":     _fmt(inv.discount_amount),
            "Taxable":      _fmt(inv.taxable_amount),
            "CGST":         _fmt(inv.cgst_amount),
            "SGST":         _fmt(inv.sgst_amount),
            "IGST":         _fmt(inv.igst_amount),
            "Grand Total":  _fmt(inv.grand_total),
            "Amount Paid":  _fmt(inv.amount_paid),
            "Amount Due":   _fmt(inv.amount_due),
        }
        item_hdrs = ["#", "Description", "HSN/SAC", "Unit", "Qty", "Rate", "Disc%", "Taxable", "GST%", "Total"]
        items = [
            {
                "#": i + 1, "Description": it.description, "HSN/SAC": it.hsn_sac or "",
                "Unit": it.unit or "", "Qty": it.quantity, "Rate": _fmt(it.rate),
                "Disc%": it.discount_pct, "Taxable": _fmt(it.taxable_amount),
                "GST%": it.gst_rate, "Total": _fmt(it.line_total),
            }
            for i, it in enumerate(inv.items)
        ]
        return _build_pdf(
            f"Invoice — {inv.invoice_number}",
            [
                {"heading": "Invoice Details", "data": header},
                {"heading": "Line Items", "data": items, "headers": item_hdrs},
                {"heading": "Totals", "data": totals},
            ],
            filename=f"invoice_{inv.invoice_number}.pdf",
        )

    # ── Purchase Orders ───────────────────────────────────────────────────────

    @staticmethod
    def pos_list(pos: list, fmt: str = "csv") -> StreamingResponse:
        headers = [
            "po_number", "order_date", "expected_date", "status", "priority",
            "vendor_name", "vendor_gstin", "currency",
            "subtotal", "tax_amount", "discount_amount", "grand_total",
        ]
        rows = [{h: _enum_val(getattr(po, h, None)) for h in headers} for po in pos]
        if fmt == "excel":
            return _rows_to_excel(rows, headers, "Purchase Orders", "purchase_orders.xlsx")
        return _rows_to_csv(rows, headers)

    @staticmethod
    def po_pdf(po) -> StreamingResponse:
        header = {
            "PO #":          po.po_number,
            "Order Date":    po.order_date,
            "Expected Date": po.expected_date or "-",
            "Status":        _enum_val(po.status),
            "Priority":      _enum_val(po.priority),
            "Vendor":        po.vendor_name or "-",
            "GSTIN":         po.vendor_gstin or "-",
            "Delivery To":   po.delivery_address or "-",
            "Payment Terms": po.payment_terms or "-",
            "Shipping Terms": po.shipping_terms or "-",
        }
        totals = {
            "Subtotal":  _fmt(po.subtotal),
            "Tax":       _fmt(po.tax_amount),
            "Discount":  _fmt(po.discount_amount),
            "Grand Total": _fmt(po.grand_total),
        }
        item_hdrs = ["#", "Description", "SKU", "HSN/SAC", "Unit", "Qty", "Unit Price", "Tax%", "Tax Amt", "Total"]
        items = [
            {
                "#": i + 1, "Description": it.description, "SKU": it.sku or "",
                "HSN/SAC": it.hsn_sac or "", "Unit": it.unit or "",
                "Qty": it.quantity, "Unit Price": _fmt(it.unit_price),
                "Tax%": it.tax_rate, "Tax Amt": _fmt(it.tax_amount), "Total": _fmt(it.line_total),
            }
            for i, it in enumerate(po.items)
        ]
        return _build_pdf(
            f"Purchase Order — {po.po_number}",
            [
                {"heading": "PO Details", "data": header},
                {"heading": "Line Items", "data": items, "headers": item_hdrs},
                {"heading": "Totals", "data": totals},
            ],
            filename=f"po_{po.po_number}.pdf",
        )
