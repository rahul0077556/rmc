import io
from datetime import datetime, timezone
from typing import List, Any, Optional
from reportlab.lib.pagesizes import letter, A4, landscape
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from backend.app.models.models import PurchaseOrder, Challan, BatchSheet, Invoice, Plant

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render 'Page X of Y' along with
    official running audit footnotes on every page.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        # Footer text
        self.setFont("Helvetica", 7)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(24, 12, "CONFIDENTIAL & AUDIT CERTIFIED — RMC COMMAND CENTER ENTERPRISE OPERATIONS")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(841.89 - 24, 12, page_str)

        # Thin footer rule
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(24, 20, 841.89 - 24, 20)

class PdfService:
    @staticmethod
    def _resolve_plant(plant_id: Optional[str] = None) -> Plant:
        if plant_id:
            p = Plant.query.get(plant_id)
            if p:
                return p
        p = Plant.query.filter_by(name="ROXXCON RMC NAGPUR").first()
        if p:
            return p
        return Plant.query.first()

    @staticmethod
    def generate_po_pdf(po: PurchaseOrder) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        elements = []

        plant = PdfService._resolve_plant(po.plant_id if hasattr(po, "plant_id") else None)
        plant_name = plant.name if plant else "ROXXCON RMC NAGPUR"
        plant_addr = plant.address if plant else "Industrial Facility, Nagpur, Maharashtra"
        plant_gst = plant.gstin if plant else "27AABCA1234F1Z9"

        # Blue Heading Styles for Clean Light Mode
        styles["Title"].textColor = colors.HexColor("#1E40AF")  # Royal Blue
        styles["Heading2"].textColor = colors.HexColor("#1D4ED8") # Blue-700
        styles["Normal"].textColor = colors.HexColor("#0F172A")

        # Header
        elements.append(Paragraph(f"<b>{plant_name.upper()}</b>", styles["Title"]))
        elements.append(Paragraph(f"{plant_addr} | GSTIN: {plant_gst}", styles["Normal"]))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563EB"), spaceAfter=15))

        elements.append(Paragraph(f"<b>PURCHASE ORDER: {po.po_number}</b>", styles["Heading2"]))
        elements.append(Spacer(1, 10))

        # PO Details Table
        data = [
            [Paragraph("<b>Customer:</b>", styles["Normal"]), Paragraph(po.customer.name, styles["Normal"]),
             Paragraph("<b>Status:</b>", styles["Normal"]), Paragraph(po.status, styles["Normal"])],
            [Paragraph("<b>Site:</b>", styles["Normal"]), Paragraph(f"{po.site.name} - {po.site.address}", styles["Normal"]),
             Paragraph("<b>Date/Time:</b>", styles["Normal"]), Paragraph(po.delivery_datetime.strftime("%Y-%m-%d %H:%M"), styles["Normal"])],
            [Paragraph("<b>Grade:</b>", styles["Normal"]), Paragraph(po.grade.code, styles["Normal"]),
             Paragraph("<b>Quantity:</b>", styles["Normal"]), Paragraph(f"{po.quantity_cum} cum", styles["Normal"])],
            [Paragraph("<b>Rate:</b>", styles["Normal"]), Paragraph(f"₹{po.rate_per_cum}/cum", styles["Normal"]),
             Paragraph("<b>Purpose:</b>", styles["Normal"]), Paragraph(po.purpose, styles["Normal"])],
            [Paragraph("<b>Pump:</b>", styles["Normal"]), Paragraph("Yes" if po.pump_required else "No", styles["Normal"]),
             Paragraph("<b>Payment Terms:</b>", styles["Normal"]), Paragraph(f"{po.payment_terms_days} Days", styles["Normal"])],
            [Paragraph("<b>Approved By:</b>", styles["Normal"]), Paragraph(po.approver.name if po.approver else "N/A", styles["Normal"]),
             Paragraph("<b>UBITECH Ref:</b>", styles["Normal"]), Paragraph(po.ubitech_ref or "N/A", styles["Normal"])]
        ]

        t = Table(data, colWidths=[90, 180, 90, 180])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('PADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))

        if po.notes:
            elements.append(Paragraph(f"<b>Notes:</b> {po.notes}", styles["Normal"]))
            elements.append(Spacer(1, 15))

        elements.append(Paragraph("<i>Computer generated document. Authorized signature not required.</i>", styles["Italic"]))
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_challan_pdf(challan: Challan) -> bytes:
        """
        Generates 3-copy layout delivery challan (Customer Copy, Driver Copy, Plant Copy)
        along with QC stamp confirmation.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=30, bottomMargin=30)
        styles = getSampleStyleSheet()
        elements = []

        trip = challan.trip
        po = trip.po if trip else None
        qc = trip.qc_check if trip else None
        batch = trip.batch_sheet if trip else None

        plant = PdfService._resolve_plant(trip.plant_id if trip else None)
        facility_name = plant.name if plant else "ROXXCON RMC NAGPUR"

        rate = po.rate_per_cum if po else 0.0
        qty = trip.delivered_quantity or trip.quantity_cum if trip else 0.0
        base_amt = round(qty * rate, 2)
        gst_amt = round(base_amt * 0.18, 2)
        total_amt = round(base_amt + gst_amt, 2)

        copies = [
            ("CUSTOMER COPY", "#1D4ED8"),
            ("DRIVER COPY", "#047857"),
            ("PLANT COPY", "#B91C1C")
        ]

        for i, (copy_title, color_hex) in enumerate(copies):
            elements.append(Paragraph(f"<b><font color='#1E40AF'>{facility_name.upper()}</font></b>", styles["Title"]))
            elements.append(Paragraph(f"<font color='#1D4ED8'>DELIVERY CHALLAN</font> - <font color='{color_hex}'><b>{copy_title}</b></font>", styles["Heading2"]))
            elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563EB"), spaceAfter=6, spaceBefore=2))
            elements.append(Spacer(1, 4))

            data = [
                [Paragraph("<b>Challan No:</b>", styles["Normal"]), Paragraph(challan.challan_number, styles["Normal"]),
                 Paragraph("<b>Date/Time:</b>", styles["Normal"]), Paragraph(challan.issued_at.strftime("%Y-%m-%d %H:%M"), styles["Normal"])],
                [Paragraph("<b>Customer:</b>", styles["Normal"]), Paragraph(po.customer.name if po and po.customer else "N/A", styles["Normal"]),
                 Paragraph("<b>PO Number:</b>", styles["Normal"]), Paragraph(po.po_number if po else "N/A", styles["Normal"])],
                [Paragraph("<b>Site:</b>", styles["Normal"]), Paragraph(po.site.name if po and po.site else "N/A", styles["Normal"]),
                 Paragraph("<b>Grade:</b>", styles["Normal"]), Paragraph(po.grade.code if po and po.grade else "N/A", styles["Normal"])],
                [Paragraph("<b>TM Truck No:</b>", styles["Normal"]), Paragraph(trip.truck.tm_number if trip and trip.truck else "N/A", styles["Normal"]),
                 Paragraph("<b>Driver:</b>", styles["Normal"]), Paragraph(f"{trip.driver.name} ({trip.driver.phone})" if trip and trip.driver else "N/A", styles["Normal"])],
                [Paragraph("<b>Loaded Qty:</b>", styles["Normal"]), Paragraph(f"<b>{trip.quantity_cum if trip else 0.0} cum</b>", styles["Normal"]),
                 Paragraph("<b>Slump:</b>", styles["Normal"]), Paragraph(f"{qc.slump_mm} mm" if qc else "N/A", styles["Normal"])],
                [Paragraph("<b>Batch Sheet No:</b>", styles["Normal"]), Paragraph(batch.batch_number if batch else "N/A", styles["Normal"]),
                 Paragraph("<b>QC Status:</b>", styles["Normal"]), Paragraph(f"<font color='green'><b>APPROVED ({batch.qc_signed_by if batch else 'QC Verified'})</b></font>", styles["Normal"])],
                [Paragraph("<b>Agreed Rate:</b>", styles["Normal"]), Paragraph(f"₹{rate:,.2f} / cum", styles["Normal"]),
                 Paragraph("<b>Taxable Value:</b>", styles["Normal"]), Paragraph(f"₹{base_amt:,.2f}", styles["Normal"])],
                [Paragraph("<b>GST (18%):</b>", styles["Normal"]), Paragraph(f"₹{gst_amt:,.2f}", styles["Normal"]),
                 Paragraph("<b>Total Trip Amount:</b>", styles["Normal"]), Paragraph(f"<b><font color='#047857'>₹{total_amt:,.2f}</font></b>", styles["Normal"])]
            ]

            t = Table(data, colWidths=[90, 180, 90, 180])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
                ('PADDING', (0,0), (-1,-1), 4),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 6))

            # Receiver acknowledgement box
            ack_table = Table([
                [Paragraph("<b>Released By:</b> " + challan.released_by, styles["Normal"]),
                 Paragraph("<b>Customer / Receiver Signature:</b> ____________________", styles["Normal"])]
            ], colWidths=[270, 270])
            ack_table.setStyle(TableStyle([
                ('LINEABOVE', (0,0), (-1,-1), 0.5, colors.HexColor("#94A3B8")),
                ('PADDING', (0,0), (-1,-1), 4),
            ]))
            elements.append(ack_table)

            if i < len(copies) - 1:
                elements.append(Spacer(1, 10))
                elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#94A3B8"), dash=[4, 3], spaceAfter=10))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_batch_sheet_pdf(batch: BatchSheet) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        elements = []

        trip = batch.trip
        plant = PdfService._resolve_plant(trip.plant_id if trip else None)
        facility_name = (batch.plant_name or (plant.name if plant else "ROXXCON RMC NAGPUR")).upper()

        elements.append(Paragraph(f"<b><font color='#1E40AF'>{facility_name}</font></b>", styles["Title"]))
        elements.append(Paragraph(f"<font color='#1D4ED8'>AUTOMATIC BATCHING SYSTEM — DOSING DOCKET: <b>{batch.batch_number}</b></font>", styles["Heading2"]))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563EB"), spaceAfter=8, spaceBefore=4))
        elements.append(Spacer(1, 6))

        meta_data = [
            ["Trip Number:", trip.trip_number if trip else "N/A", "Design Mix / Grade:", batch.grade.code if batch.grade else "N/A"],
            ["Batched Quantity:", f"{batch.quantity_cum} cum", "W/C Ratio:", f"{batch.wc_ratio or 0.45:.2f}"],
            ["Customer Name:", trip.po.customer.name if trip and trip.po and trip.po.customer else "Direct Dispatch", "Pour Site:", trip.po.site.name if trip and trip.po and trip.po.site else "Site"],
            ["Batched At:", batch.batched_at.strftime("%Y-%m-%d %H:%M:%S") if batch.batched_at else "N/A", "QC Inspection:", batch.qc_status],
            ["QC Signed By:", batch.qc_signed_by or "Pending", "QC Signed At:", batch.qc_signed_at.strftime("%Y-%m-%d %H:%M:%S") if batch.qc_signed_at else "N/A"]
        ]
        meta_table = Table(meta_data, colWidths=[100, 170, 100, 170])
        meta_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('PADDING', (0,0), (-1,-1), 5),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 15))

        # Weighed materials table
        batch_dict = batch.to_dict()
        mat_rows = [["Material Component", "Unit", "Theoretical Target", "Actual Batched", "Design Variance (%)"]]
        for m in batch_dict.get("materials", []):
            theo = m.get("theoretical", 0.0)
            act = m.get("actual", 0.0)
            var_pct = round(((act - theo) / theo * 100), 2) if theo > 0 else 0.0
            mat_rows.append([m.get("material", "Material"), m.get("unit", "kg"), str(theo), str(act), f"{var_pct:+.2f}%"])

        mat_table = Table(mat_rows, colWidths=[160, 60, 110, 110, 100])
        mat_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1E293B")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ]))
        elements.append(mat_table)
        elements.append(Spacer(1, 20))

        # Digital QC Stamp Box
        if batch.qc_status == "APPROVED":
            stamp_data = [
                [Paragraph(f"<b>DIGITAL QUALITY INSPECTION CERTIFICATE (IS 456 / IS 4926)</b><br/>"
                           f"Result: <font color='#059669'><b>APPROVED & VERIFIED PASS</b></font><br/>"
                           f"QC Inspector: {batch.qc_signed_by or 'Quality Lab Chemist'}<br/>"
                           f"Timestamp: {batch.qc_signed_at.strftime('%Y-%m-%d %H:%M:%S UTC') if batch.qc_signed_at else datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", styles["Normal"])]
            ]
            stamp_table = Table(stamp_data, colWidths=[540])
            stamp_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#ECFDF5")),
                ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor("#059669")),
                ('PADDING', (0,0), (-1,-1), 10),
            ]))
            elements.append(stamp_table)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_invoice_pdf(invoice: Invoice) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        elements = []

        plant = PdfService._resolve_plant(invoice.plant_id if hasattr(invoice, "plant_id") else None)
        facility_name = plant.name if plant else "ROXXCON RMC NAGPUR"

        elements.append(Paragraph(f"<b><font color='#1E40AF'>{facility_name.upper()}</font></b>", styles["Title"]))
        elements.append(Paragraph("<font color='#1D4ED8'>TAX INVOICE — COMMERCIAL READY-MIX CONCRETE BILLING</font>", styles["Heading2"]))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563EB"), spaceAfter=10, spaceBefore=4))

        meta = [
            ["Invoice No:", invoice.invoice_number, "Issue Date:", invoice.issue_date.isoformat()],
            ["Customer:", invoice.customer.name if invoice.customer else "N/A", "Due Date:", invoice.due_date.isoformat()],
            ["Customer GSTIN:", invoice.customer.gstin if invoice.customer else "N/A", "PO Ref:", invoice.po.po_number if invoice.po else "N/A"]
        ]
        t_meta = Table(meta, colWidths=[90, 180, 90, 180])
        t_meta.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('PADDING', (0,0), (-1,-1), 5),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ]))
        elements.append(t_meta)
        elements.append(Spacer(1, 15))

        lines = [["Trip No", "Delivered Qty (cum)", "Rate (₹/cum)", "Amount (₹)"]]
        for line in invoice.lines:
            lines.append([
                line.trip.trip_number if line.trip else "Trip",
                str(line.quantity),
                f"₹{line.rate:,.2f}",
                f"₹{line.amount:,.2f}"
            ])
        lines.append(["", "", "Subtotal:", f"₹{invoice.subtotal:,.2f}"])
        lines.append(["", "", f"GST ({invoice.gst_percent}%):", f"₹{(invoice.total - invoice.subtotal):,.2f}"])
        lines.append(["", "", "Total:", f"₹{invoice.total:,.2f}"])
        lines.append(["", "", "Paid:", f"₹{invoice.paid_amount:,.2f}"])
        lines.append(["", "", "Balance Due:", f"₹{invoice.outstanding_amount:,.2f}"])

        t_lines = Table(lines, colWidths=[160, 120, 130, 130])
        t_lines.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1E40AF")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('PADDING', (0,0), (-1,-1), 5),
            ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ]))
        elements.append(t_lines)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_report_pdf(
        title: str,
        cols: List[str],
        rows: List[List[Any]],
        plant_name: Optional[str] = None,
        plant_city: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        user_name: Optional[str] = None
    ) -> bytes:
        """
        Generates an executive, certified A4 Landscape PDF for any plant report
        with official letterhead, complete multi-page auto-wrapped tables,
        repeating headers, KPI summaries, and authorization signature blocks.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=20,
            rightMargin=20,
            topMargin=20,
            bottomMargin=24
        )
        styles = getSampleStyleSheet()
        elements = []

        facility = (plant_name or "ROXXCON RMC NAGPUR").upper()
        city = (plant_city or "Nagpur").upper()

        # Styles
        style_title = ParagraphStyle(
            'ReportPlantTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#1E40AF") # Royal Blue
        )
        style_sub = ParagraphStyle(
            'ReportPlantSub',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#475569")
        )
        style_banner_title = ParagraphStyle(
            'ReportBannerTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=12,
            textColor=colors.white,
            alignment=0
        )
        style_banner_meta = ParagraphStyle(
            'ReportBannerMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#DBEAFE"),
            alignment=2
        )

        # 1. Official Plant Header
        elements.append(Paragraph(f"<b>{facility}</b>", style_title))
        elements.append(Paragraph(f"CERTIFIED READY-MIX CONCRETE OPERATIONS & COMPLIANCE SYSTEM | LOCATION: {city}", style_sub))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563EB"), spaceAfter=6, spaceBefore=4))

        # 2. Report Document Meta Banner
        date_range_str = f"{from_date.strftime('%d-%b-%Y')} to {to_date.strftime('%d-%b-%Y')}" if from_date and to_date else "Current Cycle"
        now_str = datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M UTC")

        banner_table = Table([
            [
                Paragraph(f"<b>{title.upper()}</b>", style_banner_title),
                Paragraph(f"<b>Period:</b> {date_range_str} &nbsp;|&nbsp; <b>Generated:</b> {now_str} &nbsp;|&nbsp; <b>Officer:</b> {user_name or 'Plant Desk'}", style_banner_meta)
            ]
        ], colWidths=[360, 441])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#1E40AF")), # Royal Blue Banner
            ('PADDING', (0,0), (-1,-1), 5),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elements.append(banner_table)
        elements.append(Spacer(1, 6))

        # 3. Dynamic Column Weights & Table Building
        avail_width = 801.89  # (841.89 - 40 margin)
        num_cols = max(len(cols), 1)

        weights = []
        for c in cols:
            cl = c.lower()
            if cl in ["s.no", "sr no.", "#"]:
                weights.append(22)
            elif any(k in cl for k in ["description", "material", "customer", "site", "driver", "supplier", "remarks", "party", "action"]):
                weights.append(75)
            elif any(k in cl for k in ["status", "result", "unit", "grade", "ticket", "slip", "muster", "bio"]):
                weights.append(42)
            elif any(k in cl for k in ["wo", "wp", "ph", "el", "co", "ab"]):
                weights.append(18)
            else:
                weights.append(36)

        total_w = sum(weights)
        col_widths = [w * (avail_width / total_w) for w in weights]

        # Compact font sizes for wide reports
        is_extra_wide = num_cols > 15
        hdr_font_size = 5.5 if is_extra_wide else 6.5
        hdr_leading = 6.5 if is_extra_wide else 8.0
        cell_font_size = 5.2 if is_extra_wide else 6.2
        cell_leading = 6.2 if is_extra_wide else 7.5

        style_hdr = ParagraphStyle("RptHdr", fontName="Helvetica-Bold", fontSize=hdr_font_size, leading=hdr_leading, textColor=colors.white, alignment=1)
        style_cell = ParagraphStyle("RptCell", fontName="Helvetica", fontSize=cell_font_size, leading=cell_leading, textColor=colors.HexColor("#0F172A"), alignment=0)
        style_num = ParagraphStyle("RptNum", fontName="Helvetica", fontSize=cell_font_size, leading=cell_leading, textColor=colors.HexColor("#0F172A"), alignment=2)
        style_badge_ok = ParagraphStyle("RptBadgeOk", fontName="Helvetica-Bold", fontSize=cell_font_size, leading=cell_leading, textColor=colors.HexColor("#047857"), alignment=1)
        style_badge_bad = ParagraphStyle("RptBadgeBad", fontName="Helvetica-Bold", fontSize=cell_font_size, leading=cell_leading, textColor=colors.HexColor("#B91C1C"), alignment=1)

        table_data = [[Paragraph(f"<b>{c}</b>", style_hdr) for c in cols]]

        if rows:
            for r in rows:
                row_cells = []
                for c_idx, val in enumerate(r):
                    val_str = str(val if val is not None else "")
                    is_status = val_str in ["PASS", "ADEQUATE", "CALIBRATION OK", "ALL DUES CLEARED", "STANDARD CREDIT", "PASSED (CALIBRATED)", "Within Fuel Norms"]
                    is_bad = val_str in ["FAIL", "REORDER REQUIRED"] or "REJECT" in val_str or "CRITICAL" in val_str or "EXCEEDED" in val_str or "SHORTFALL" in val_str

                    if is_status:
                        row_cells.append(Paragraph(val_str, style_badge_ok))
                    elif is_bad:
                        row_cells.append(Paragraph(val_str, style_badge_bad))
                    elif isinstance(val, (int, float)):
                        row_cells.append(Paragraph(val_str, style_num))
                    else:
                        row_cells.append(Paragraph(val_str, style_cell))
                table_data.append(row_cells)
        else:
            table_data.append([Paragraph("<i>No operational records found within selected date filter.</i>", style_cell)] + [Paragraph("", style_cell) for _ in range(num_cols - 1)])

        t = Table(table_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),  # Royal Blue Table Header
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
            ("PADDING", (0, 0), (-1, -1), 2.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 12))

        # 4. Sign-Off & Official Authorization Box
        style_sig = ParagraphStyle(
            'ReportSig',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=colors.HexColor("#334155")
        )

        sig_data = [
            [
                Paragraph("<b>Prepared By:</b><br/>Plant Store / Dispatch Incharge<br/><br/>Sign: ___________________", style_sig),
                Paragraph("<b>Quality Certified:</b><br/>QA / QC Lab Chemist (IS 456)<br/><br/>Sign: ___________________", style_sig),
                Paragraph("<b>Commercial Audit:</b><br/>Accounts & Billing Lead<br/><br/>Sign: ___________________", style_sig),
                Paragraph("<b>Authorized Plant Officer:</b><br/>Plant Operations Head / Director<br/><br/>Sign & Seal: ___________________", style_sig),
            ]
        ]
        sig_table = Table(sig_data, colWidths=[195, 195, 195, 216])
        sig_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#94A3B8")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        elements.append(KeepTogether([sig_table]))

        doc.build(elements, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer.getvalue()
