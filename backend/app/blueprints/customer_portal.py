from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.app.models.models import PurchaseOrder, Trip
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_scoped_customer_id

portal_bp = Blueprint("portal", __name__, url_prefix="/api/v1/my")

@portal_bp.route("/orders", methods=["GET"])
@jwt_required()
@roles_required("customer")
def get_my_orders():
    customer_id = get_scoped_customer_id()
    if not customer_id:
        return error_response(code="FORBIDDEN", message="User not linked to any customer account.", status_code=403)

    orders = (
        PurchaseOrder.query
        .filter_by(customer_id=customer_id, is_deleted=False)
        .order_by(PurchaseOrder.created_at.desc())
        .all()
    )
    return success_response(data=[o.to_dict() for o in orders])

@portal_bp.route("/orders/<id>/tracking", methods=["GET"])
@jwt_required()
@roles_required("customer")
def get_order_tracking(id):
    customer_id = get_scoped_customer_id()
    po = PurchaseOrder.query.filter_by(id=id, is_deleted=False).first()
    if not po:
        return error_response(code="NOT_FOUND", message="Order not found.", status_code=404)

    # Customer isolation enforcement
    if po.customer_id != customer_id:
        return error_response(code="FORBIDDEN", message="Unauthorized to access this customer order.", status_code=403)

    # Stepper calculation based on overall order & trip progress
    # Steps: Order Approved -> Scheduled -> Batching -> Quality Check -> Dispatched -> In Transit -> Delivered
    trips = po.trips
    step = 0
    if po.status in ["APPROVED", "IN_PROGRESS", "COMPLETED"]:
        step = 1  # Order Approved
    if any(t.status in ["PLANNED", "SENT_TO_PRODUCTION", "BATCHING", "LOADED", "QC_PENDING", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"] for t in trips):
        step = 2  # Scheduled
    if any(t.status in ["BATCHING", "LOADED", "QC_PENDING", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"] for t in trips):
        step = 3  # Batching
    if any(t.status in ["QC_PENDING", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"] for t in trips):
        step = 4  # Quality Check
    if any(t.status in ["DISPATCHED", "IN_TRANSIT", "DELIVERED"] for t in trips):
        step = 5  # Dispatched
    if any(t.status in ["IN_TRANSIT", "DELIVERED"] for t in trips):
        step = 6  # In Transit
    if po.status == "COMPLETED" or (trips and all(t.status == "DELIVERED" for t in trips)):
        step = 7  # Delivered

    step_labels = [
        "Order Placed",
        "Order Approved",
        "Trips Scheduled",
        "Batching Underway",
        "Quality Verification",
        "TM Dispatched",
        "In Transit",
        "All Concrete Delivered"
    ]

    return success_response(data={
        "order": po.to_dict(),
        "currentStep": step,
        "currentStepName": step_labels[min(step, len(step_labels) - 1)],
        "trips": [t.to_dict() for t in trips]
    })
