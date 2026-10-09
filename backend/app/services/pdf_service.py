import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from backend.app.models.models import PurchaseOrder, Challan, BatchSheet, Invoice, Plant

class PdfService:
    @staticmethod
    def generate_po_pdf(po: PurchaseOrder) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        elements = []

        plant = Plant.query.first()
        plant_name = plant.name if plant else "Apex Ready-Mix Concrete Plant"
        plant_addr = plant.address if plant else "Plot 42, Hinjewadi Industrial Zone, Pune - 411057"
        plant_gst = plant.gstin if plant else "27AABCA1234F1Z9"

        # Header
        elements.append(Paragraph(f"<b>{plant_name.upper()}</b>", styles["Title"]))
        elements.append(Paragraph(f"{plant_addr} | GSTIN: {plant_gst}", styles["Normal"]))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2563EB"), spaceAfter=15))

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

        plant = Plant.query.first()
        trip = challan.trip
        po = trip.po
        qc = trip.qc_check
        batch = trip.batch_sheet

        copies = [
            ("CUSTOMER COPY", "#1D4ED8"),
            ("DRIVER COPY", "#047857"),
            ("PLANT COPY", "#B91C1C")
        ]

        for i, (copy_title, color_hex) in enumerate(copies):
            elements.append(Paragraph(f"<b>{plant.name if plant else 'APEX RMC PLANT'}</b>", styles["Title"]))
            elements.append(Paragraph(f"DELIVERY CHALLAN - <font color='{color_hex}'><b>{copy_title}</b></font>", styles["Heading2"]))
            elements.append(Spacer(1, 6))

            data = [
                [Paragraph("<b>Challan No:</b>", styles["Normal"]), Paragraph(challan.challan_number, styles["Normal"]),
                 Paragraph("<b>Date/Time:</b>", styles["Normal"]), Paragraph(challan.issued_at.strftime("%Y-%m-%d %H:%M"), styles["Normal"])],
                [Paragraph("<b>Customer:</b>", styles["Normal"]), Paragraph(po.customer.name, styles["Normal"]),
                 Paragraph("<b>PO Number:</b>", styles["Normal"]), Paragraph(po.po_number, styles["Normal"])],
                [Paragraph("<b>Site:</b>", styles["Normal"]), Paragraph(po.site.name, styles["Normal"]),
                 Paragraph("<b>Grade:</b>", styles["Normal"]), Paragraph(po.grade.code, styles["Normal"])],
                [Paragraph("<b>TM Truck No:</b>", styles["Normal"]), Paragraph(trip.truck.tm_number if trip.truck else "N/A", styles["Normal"]),
                 Paragraph("<b>Driver:</b>", styles["Normal"]), Paragraph(f"{trip.driver.name} ({trip.driver.phone})" if trip.driver else "N/A", styles["Normal"])],
                [Paragraph("<b>Loaded Qty:</b>", styles["Normal"]), Paragraph(f"<b>{trip.quantity_cum} cum</b>", styles["Normal"]),
                 Paragraph("<b>Slump:</b>", styles["Normal"]), Paragraph(f"{qc.slump_mm} mm" if qc else "N/A", styles["Normal"])],
                [Paragraph("<b>Batch Sheet No:</b>", styles["Normal"]), Paragraph(batch.batch_number if batch else "N/A", styles["Normal"]),
                 Paragraph("<b>QC Status:</b>", styles["Normal"]), Paragraph(f"<font color='green'><b>APPROVED ({batch.qc_signed_by if batch else 'QC Verified'})</b></font>", styles["Normal"])]
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
        elements.append(Paragraph("<b>AUTOMATIC BATCHING SYSTEM - BATCH SHEET</b>", styles["Title"]))
        elements.append(Paragraph(f"Batch No: <b>{batch.batch_number}</b> | Trip No: {trip.trip_number if trip else 'N/A'}", styles["Heading3"]))
        elements.append(Spacer(1, 10))

        meta_data = [
            ["Grade:", batch.grade.code if batch.grade else "N/A", "Batch Quantity:", f"{batch.quantity_cum} cum"],
            ["Batched At:", batch.batched_at.strftime("%Y-%m-%d %H:%M:%S"), "QC Status:", batch.qc_status],
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
        mat_rows = [["Material Component", "Unit", "Theoretical", "Actual Batched", "Variance (%)"]]
        for m in batch_dict["materials"]:
            theo = m["theoretical"]
            act = m["actual"]
            var_pct = round(((act - theo) / theo * 100), 2) if theo > 0 else 0.0
            mat_rows.append([m["material"], m["unit"], str(theo), str(act), f"{var_pct:+.2f}%"])

        mat_table = Table(mat_rows, colWidths=[180, 60, 100, 100, 100])
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
                [Paragraph(f"<b>DIGITAL QUALITY INSPECTION CERTIFICATE</b><br/>"
                           f"Stamp: <font color='green'><b>APPROVED & VERIFIED</b></font><br/>"
                           f"Inspector: {batch.qc_signed_by}<br/>"
                           f"Timestamp: {batch.qc_signed_at.strftime('%Y-%m-%d %H:%M:%S UTC') if batch.qc_signed_at else ''}", styles["Normal"])]
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

        plant = Plant.query.first()
        elements.append(Paragraph(f"<b>{plant.name if plant else 'APEX RMC PLANT'}</b>", styles["Title"]))
        elements.append(Paragraph("TAX INVOICE", styles["Heading2"]))
        elements.append(Spacer(1, 10))

        meta = [
            ["Invoice No:", invoice.invoice_number, "Issue Date:", invoice.issue_date.isoformat()],
            ["Customer:", invoice.customer.name, "Due Date:", invoice.due_date.isoformat()],
            ["GSTIN:", invoice.customer.gstin, "PO Ref:", invoice.po.po_number if invoice.po else "N/A"]
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
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1E293B")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('PADDING', (0,0), (-1,-1), 5),
            ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ]))
        elements.append(t_lines)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
