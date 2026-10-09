from datetime import datetime, timezone, timedelta
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    PurchaseOrder, Trip, Invoice, Customer, Truck, Driver, QcCheck
)
from backend.app.utils.responses import success_response
from backend.app.utils.decorators import roles_required

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/v1/dashboard")

@dashboard_bp.route("/owner-summary", methods=["GET"])
@jwt_required()
@roles_required("owner", "dispatcher")
def get_owner_summary():
    orders = PurchaseOrder.query.filter_by(is_deleted=False).all()
    invoices = Invoice.query.all()

    total_orders = len(orders)
    pending_orders = len([o for o in orders if o.status in ["DRAFT", "SUBMITTED", "APPROVED", "IN_PROGRESS"]])
    delivered_orders = len([o for o in orders if o.status == "COMPLETED"])
    total_qty_delivered = sum(o.delivered_quantity for o in orders)
    outstanding_payments = sum(inv.outstanding_amount for inv in invoices)

    return success_response(data={
        "totalOrders": total_orders,
        "pendingOrders": pending_orders,
        "deliveredOrders": delivered_orders,
        "totalQuantityDelivered": round(total_qty_delivered, 1),
        "outstandingPayments": round(outstanding_payments, 2)
    })

@dashboard_bp.route("/orders-per-date", methods=["GET"])
@jwt_required()
@roles_required("owner", "dispatcher")
def get_orders_per_date():
    days = int(request.args.get("days", 30))
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    orders = (
        PurchaseOrder.query
        .filter(PurchaseOrder.created_at >= start_date, PurchaseOrder.is_deleted == False)
        .all()
    )

    by_date = {}
    for i in range(days + 1):
        dt = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        by_date[dt] = {"date": dt, "count": 0, "quantity": 0.0}

    for o in orders:
        dt = o.delivery_datetime.strftime("%Y-%m-%d")
        if dt in by_date:
            by_date[dt]["count"] += 1
            by_date[dt]["quantity"] += o.quantity_cum

    chart_data = sorted(list(by_date.values()), key=lambda x: x["date"])
    return success_response(data=chart_data)

@dashboard_bp.route("/daily-schedule", methods=["GET"])
@jwt_required()
@roles_required("owner", "dispatcher")
def get_daily_schedule():
    target_date_str = request.args.get("date")
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except Exception:
            target_date = datetime.now(timezone.utc).date()
    else:
        target_date = datetime.now(timezone.utc).date()

    trips = Trip.query.all()
    
    # Filter for selected date
    selected_date_trips = [t for t in trips if t.planned_datetime.date() == target_date]
    till_today_trips = [t for t in trips if t.planned_datetime.date() <= target_date]

    def summarize(trip_list):
        return {
            "scheduled": len([t for t in trip_list if t.status in ["PLANNED", "SENT_TO_PRODUCTION", "BATCHING", "LOADED", "QC_PENDING", "QC_APPROVED"]]),
            "inTransit": len([t for t in trip_list if t.status in ["DISPATCHED", "IN_TRANSIT"]]),
            "delivered": len([t for t in trip_list if t.status == "DELIVERED"])
        }

    return success_response(data={
        "date": target_date.isoformat(),
        "selectedDate": summarize(selected_date_trips),
        "tillToday": summarize(till_today_trips)
    })

@dashboard_bp.route("/payment-status", methods=["GET"])
@jwt_required()
@roles_required("owner", "dispatcher")
def get_payment_status():
    invoices = Invoice.query.all()
    total_invoiced = sum(inv.total for inv in invoices)
    total_received = sum(inv.paid_amount for inv in invoices)
    total_outstanding = sum(inv.outstanding_amount for inv in invoices)
    total_overdue = sum(inv.outstanding_amount for inv in invoices if inv.is_overdue)

    # Per-customer breakdown
    customers = Customer.query.all()
    cust_breakdown = []
    for c in customers:
        c_invoices = [inv for inv in invoices if inv.customer_id == c.id]
        c_invoiced = sum(inv.total for inv in c_invoices)
        c_received = sum(inv.paid_amount for inv in c_invoices)
        c_out = sum(inv.outstanding_amount for inv in c_invoices)
        c_over = sum(inv.outstanding_amount for inv in c_invoices if inv.is_overdue)
        cust_breakdown.append({
            "customerId": c.id,
            "customerName": c.name,
            "creditDays": c.credit_days,
            "invoiced": round(c_invoiced, 2),
            "received": round(c_received, 2),
            "outstanding": round(c_out, 2),
            "overdue": round(c_over, 2)
        })

    return success_response(data={
        "summary": {
            "totalInvoiced": round(total_invoiced, 2),
            "totalReceived": round(total_received, 2),
            "totalOutstanding": round(total_outstanding, 2),
            "totalOverdue": round(total_overdue, 2)
        },
        "customerBreakdown": cust_breakdown
    })

@dashboard_bp.route("/percentages", methods=["GET"])
@jwt_required()
@roles_required("owner", "dispatcher")
def get_percentages():
    orders = PurchaseOrder.query.filter_by(is_deleted=False).all()
    trips = Trip.query.all()
    invoices = Invoice.query.all()
    trucks = Truck.query.all()
    qc_checks = QcCheck.query.all()

    # 1. % PO Quantity Delivered
    total_ordered_qty = sum(o.quantity_cum for o in orders) or 1.0
    total_deliv_qty = sum(o.delivered_quantity for o in orders)
    po_qty_delivered_pct = round((total_deliv_qty / total_ordered_qty) * 100, 1)

    # 2. % Trips on time (dispatched within 30 min of planned or delivered)
    dispatched_trips = [t for t in trips if t.status in ["DISPATCHED", "IN_TRANSIT", "DELIVERED"]]
    on_time = 0
    for t in dispatched_trips:
        if t.dispatched_at and t.dispatched_at <= t.planned_datetime + timedelta(minutes=45):
            on_time += 1
    trips_on_time_pct = round((on_time / max(len(dispatched_trips), 1)) * 100, 1)

    # 3. % QC Approval rate & % TM Rejections
    total_qc = len(qc_checks) or 1
    qc_approved = len([q for q in qc_checks if q.decision == "APPROVE"])
    qc_rejected = len([q for q in qc_checks if q.decision == "REJECT"])
    qc_approval_rate_pct = round((qc_approved / total_qc) * 100, 1)
    tm_rejection_rate_pct = round((qc_rejected / total_qc) * 100, 1)

    # 4. % Invoices Paid
    total_inv_count = len(invoices) or 1
    paid_inv_count = len([inv for inv in invoices if inv.status == "PAID"])
    invoices_paid_pct = round((paid_inv_count / total_inv_count) * 100, 1)

    # 5. % TM Utilization (non-maintenance and currently assigned/loaded/in transit)
    active_trucks = [t for t in trucks if t.status in ["ASSIGNED", "LOADED", "IN_TRANSIT"]]
    available_trucks = [t for t in trucks if t.status != "MAINTENANCE"]
    tm_utilization_pct = round((len(active_trucks) / max(len(available_trucks), 1)) * 100, 1)

    # 6. % Order Pending
    pending_orders = len([o for o in orders if o.status in ["DRAFT", "SUBMITTED", "APPROVED", "IN_PROGRESS"]])
    order_pending_pct = round((pending_orders / max(len(orders), 1)) * 100, 1)

    return success_response(data={
        "poQuantityDelivered": min(100.0, po_qty_delivered_pct),
        "tripsOnTime": min(100.0, trips_on_time_pct),
        "qcApprovalRate": min(100.0, qc_approval_rate_pct),
        "tmRejections": min(100.0, tm_rejection_rate_pct),
        "invoicesPaid": min(100.0, invoices_paid_pct),
        "tmUtilization": min(100.0, tm_utilization_pct),
        "orderPending": min(100.0, order_pending_pct)
    })

@dashboard_bp.route("/truck-availability", methods=["GET"])
@jwt_required()
@roles_required("owner", "dispatcher")
def get_truck_availability():
    trucks = Truck.query.all()
    drivers = Driver.query.all()

    # Group by capacities: 5, 7, 8, 9, 10 cum
    capacities = [5, 7, 8, 9, 10]
    by_capacity = {}
    for cap in capacities:
        by_capacity[cap] = {
            "capacity": cap,
            "total": 0,
            "available": 0,
            "assigned": 0,
            "loaded": 0,
            "inTransit": 0,
            "maintenance": 0
        }

    for t in trucks:
        cap = t.capacity_cum
        if cap in by_capacity:
            by_capacity[cap]["total"] += 1
            status = t.status.upper()
            if status == "AVAILABLE": by_capacity[cap]["available"] += 1
            elif status == "ASSIGNED": by_capacity[cap]["assigned"] += 1
            elif status == "LOADED": by_capacity[cap]["loaded"] += 1
            elif status == "IN_TRANSIT": by_capacity[cap]["inTransit"] += 1
            elif status == "MAINTENANCE": by_capacity[cap]["maintenance"] += 1

    driver_summary = {
        "total": len(drivers),
        "available": len([d for d in drivers if d.status == "AVAILABLE"]),
        "assigned": len([d for d in drivers if d.status == "ASSIGNED"]),
        "unavailable": len([d for d in drivers if d.status == "UNAVAILABLE"])
    }

    return success_response(data={
        "byCapacity": list(by_capacity.values()),
        "drivers": driver_summary
    })
