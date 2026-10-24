from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, make_response
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    Invoice, InvoiceLine, Payment, PurchaseOrder, Trip, Customer, User
)
from backend.app.services.sequence_service import get_next_sequence
from backend.app.services.state_machine import StateMachine, StateMachineError
from backend.app.services.pdf_service import PdfService
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_scoped_customer_id, get_current_user_id

billing_bp = Blueprint("billing", __name__, url_prefix="/api/v1/invoices")

@billing_bp.route("", methods=["GET"])
@jwt_required()
@roles_required()
def list_invoices():
    scoped_cust = get_scoped_customer_id()
    query = Invoice.query

    if scoped_cust:
        query = query.filter_by(customer_id=scoped_cust)
    else:
        cust_id = request.args.get("customerId")
        if cust_id:
            query = query.filter_by(customer_id=cust_id)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    invoices = query.order_by(Invoice.issue_date.desc()).all()
    return success_response(data=[inv.to_dict() for inv in invoices])

@billing_bp.route("", methods=["POST"])
@jwt_required()
@roles_required("dispatcher", "account", "sales_manager")
def create_invoice():
    data = request.get_json() or {}
    po_id = data.get("poId")
    trip_ids = data.get("tripIds", [])
    gst_percent = float(data.get("gstPercent", 18.0))

    if not po_id:
        return error_response(code="VALIDATION_ERROR", message="PO ID is required.")

    po = PurchaseOrder.query.get(po_id)
    if not po:
        return error_response(code="NOT_FOUND", message="PO not found.", status_code=404)

    # Collect delivered trips for this PO
    trips_query = Trip.query.filter_by(po_id=po.id, status="DELIVERED")
    if trip_ids:
        trips_query = trips_query.filter(Trip.id.in_(trip_ids))
    delivered_trips = trips_query.all()

    # BUSINESS RULE 7: Invoices can only be created for delivered quantity
    if not delivered_trips:
        return error_response(
            code="NO_DELIVERED_TRIPS",
            message="Cannot create invoice: No delivered trips found for this PO.",
            status_code=400
        )

    # Calculate subtotal using PO rate
    subtotal = 0.0
    for trip in delivered_trips:
        qty = trip.delivered_quantity or trip.quantity_cum
        subtotal += round(qty * po.rate_per_cum, 2)

    total_tax = round(subtotal * (gst_percent / 100.0), 2)
    grand_total = round(subtotal + total_tax, 2)

    issue_date = datetime.now(timezone.utc).date()
    credit_days = po.payment_terms_days or (po.customer.credit_days if po.customer else 30)
    due_date = issue_date + timedelta(days=credit_days)

    inv_num = get_next_sequence("INVOICE", "INV")
    user_id = get_current_user_id()

    invoice = Invoice(
        invoice_number=inv_num,
        po_id=po.id,
        customer_id=po.customer_id,
        issue_date=issue_date,
        due_date=due_date,
        subtotal=subtotal,
        gst_percent=gst_percent,
        total=grand_total,
        status="ISSUED",
        created_by=user_id
    )
    db.session.add(invoice)
    db.session.flush()

    for trip in delivered_trips:
        qty = trip.delivered_quantity or trip.quantity_cum
        line = InvoiceLine(
            invoice_id=invoice.id,
            trip_id=trip.id,
            quantity=qty,
            rate=po.rate_per_cum,
            amount=round(qty * po.rate_per_cum, 2),
            created_by=user_id
        )
        db.session.add(line)

    db.session.commit()
    return success_response(data=invoice.to_dict(), status_code=201)

@billing_bp.route("/<id>", methods=["GET"])
@jwt_required()
@roles_required()
def get_invoice(id):
    scoped_cust = get_scoped_customer_id()
    inv = Invoice.query.get(id)
    if not inv:
        return error_response(code="NOT_FOUND", message="Invoice not found.", status_code=404)

    if scoped_cust and inv.customer_id != scoped_cust:
        return error_response(code="FORBIDDEN", message="Cannot access another customer's invoice.", status_code=403)

    return success_response(data=inv.to_dict())

@billing_bp.route("/<id>/payments", methods=["POST"])
@jwt_required()
@roles_required("dispatcher", "account", "sales_manager")
def record_payment(id):
    inv = Invoice.query.get(id)
    if not inv:
        return error_response(code="NOT_FOUND", message="Invoice not found.", status_code=404)

    data = request.get_json() or {}
    amount = float(data.get("amount", 0))
    mode = data.get("mode", "NEFT")
    reference = data.get("reference", "REF-PAY-001")
    paid_on_str = data.get("paidOn")

    if amount <= 0:
        return error_response(code="VALIDATION_ERROR", message="Payment amount must be greater than zero.")

    # BUSINESS RULE 7: Payments cannot exceed the outstanding amount
    outstanding = inv.outstanding_amount
    if amount > outstanding + 0.01:
        return error_response(
            code="EXCEEDS_OUTSTANDING",
            message=f"Payment amount (₹{amount:,.2f}) exceeds outstanding balance (₹{outstanding:,.2f}).",
            status_code=409
        )

    user_id = get_current_user_id()
    user = User.query.get(user_id)
    paid_on = datetime.strptime(paid_on_str, "%Y-%m-%d").date() if paid_on_str else datetime.now(timezone.utc).date()

    payment = Payment(
        invoice_id=inv.id,
        amount=amount,
        paid_on=paid_on,
        mode=mode,
        reference=reference,
        recorded_by=user.name if user else "Accounts",
        created_by=user_id
    )
    db.session.add(payment)
    db.session.flush()

    # Update invoice state
    new_outstanding = inv.outstanding_amount
    if new_outstanding <= 0.01:
        StateMachine.transition_invoice(inv, "PAID", user_id=user_id)
    else:
        StateMachine.transition_invoice(inv, "PARTIALLY_PAID", user_id=user_id)

    db.session.commit()
    return success_response(data=inv.to_dict())

@billing_bp.route("/<id>/pdf", methods=["GET"])
@jwt_required()
@roles_required()
def get_invoice_pdf(id):
    inv = Invoice.query.get(id)
    if not inv:
        return error_response(code="NOT_FOUND", message="Invoice not found.", status_code=404)

    pdf_bytes = PdfService.generate_invoice_pdf(inv)
    response = make_response(pdf_bytes)
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = f"inline; filename={inv.invoice_number}.pdf"
    return response
