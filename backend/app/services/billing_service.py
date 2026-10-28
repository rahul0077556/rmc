from datetime import datetime, timezone, timedelta
from typing import Optional, List
from backend.app.extensions import db
from backend.app.models.models import PurchaseOrder, Trip, Invoice, InvoiceLine
from backend.app.services.sequence_service import get_next_sequence

class BillingService:
    @staticmethod
    def sync_invoice_for_po(po_id: str, user_id: Optional[str] = None) -> Optional[Invoice]:
        """
        Synchronizes or creates the customer Tax Invoice for a Purchase Order
        based on all currently DELIVERED trips. If 1 trip is delivered, the bill reflects 1 trip.
        If 3 trips are delivered, the invoice lines and total amount reflect all 3 trips.
        """
        po = PurchaseOrder.query.get(po_id)
        if not po:
            return None

        # Find all delivered trips for this PO
        delivered_trips = Trip.query.filter_by(po_id=po.id, status="DELIVERED").order_by(Trip.sequence.asc()).all()
        if not delivered_trips:
            return None

        # Check if an invoice already exists for this PO
        invoice = Invoice.query.filter_by(po_id=po.id).first()

        issue_date = datetime.now(timezone.utc).date()
        credit_days = po.payment_terms_days or (po.customer.credit_days if po.customer else 30)
        due_date = issue_date + timedelta(days=credit_days)

        if not invoice:
            inv_num = get_next_sequence("INVOICE", "INV")
            invoice = Invoice(
                invoice_number=inv_num,
                po_id=po.id,
                customer_id=po.customer_id,
                issue_date=issue_date,
                due_date=due_date,
                subtotal=0.0,
                gst_percent=18.0,
                total=0.0,
                status="ISSUED",
                created_by=user_id
            )
            db.session.add(invoice)
            db.session.flush()

        # Sync invoice lines for all delivered trips
        existing_lines = {l.trip_id: l for l in invoice.lines}
        subtotal = 0.0

        for trip in delivered_trips:
            qty = trip.delivered_quantity if trip.delivered_quantity is not None else trip.quantity_cum
            line_amount = round(qty * po.rate_per_cum, 2)
            subtotal += line_amount

            if trip.id in existing_lines:
                line = existing_lines[trip.id]
                line.quantity = qty
                line.rate = po.rate_per_cum
                line.amount = line_amount
            else:
                line = InvoiceLine(
                    invoice_id=invoice.id,
                    trip_id=trip.id,
                    quantity=qty,
                    rate=po.rate_per_cum,
                    amount=line_amount,
                    created_by=user_id
                )
                db.session.add(line)

        # Recalculate invoice totals (Subtotal + 18% GST)
        gst_percent = invoice.gst_percent or 18.0
        total_tax = round(subtotal * (gst_percent / 100.0), 2)
        grand_total = round(subtotal + total_tax, 2)

        invoice.subtotal = round(subtotal, 2)
        invoice.total = grand_total

        # If previously paid partially or in full, re-evaluate status
        if invoice.status != "PAID":
            if invoice.outstanding_amount <= 0.01 and invoice.paid_amount > 0:
                invoice.status = "PAID"
            elif invoice.paid_amount > 0:
                invoice.status = "PARTIALLY_PAID"
            else:
                invoice.status = "ISSUED"

        db.session.flush()
        return invoice

    @staticmethod
    def sync_all_pending_invoices(user_id: Optional[str] = None) -> List[Invoice]:
        """
        Scans all POs with delivered trips and ensures all invoices are up-to-date.
        """
        # Find distinct PO IDs that have delivered trips
        delivered_po_ids = db.session.query(Trip.po_id).filter_by(status="DELIVERED").distinct().all()
        invoices = []
        for (po_id,) in delivered_po_ids:
            inv = BillingService.sync_invoice_for_po(po_id, user_id=user_id)
            if inv:
                invoices.append(inv)
        db.session.commit()
        return invoices
