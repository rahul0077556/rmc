from datetime import datetime
from flask import Blueprint, request, make_response
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import PurchaseOrder, Customer, Site, Grade, MixDesign
from backend.app.services.sequence_service import get_next_sequence
from backend.app.services.state_machine import StateMachine, StateMachineError
from backend.app.services.erp_service import ErpService
from backend.app.services.pdf_service import PdfService
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_scoped_customer_id, get_current_user_id

orders_bp = Blueprint("orders", __name__, url_prefix="/api/v1/purchase-orders")

@orders_bp.route("", methods=["GET"])
@jwt_required()
@roles_required()
def list_orders():
    scoped_cust = get_scoped_customer_id()
    query = PurchaseOrder.query.filter_by(is_deleted=False)

    if scoped_cust:
        query = query.filter_by(customer_id=scoped_cust)
    else:
        cust_id = request.args.get("customerId")
        if cust_id:
            query = query.filter_by(customer_id=cust_id)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    search = request.args.get("search", "").strip()
    if search:
        query = query.filter(PurchaseOrder.po_number.ilike(f"%{search}%"))

    orders = query.order_by(PurchaseOrder.created_at.desc()).all()
    return success_response(data=[o.to_dict() for o in orders])

@orders_bp.route("", methods=["POST"])
@jwt_required()
@roles_required("sales", "sales_manager", "owner")
def create_order():
    data = request.get_json(silent=True) or {}
    customer_id = data.get("customerId")
    site_id = data.get("siteId")
    grade_code = data.get("grade")
    grade_id = data.get("gradeId")
    quantity_cum = float(data.get("quantity", 0))
    rate_per_cum = float(data.get("ratePerCum", 0))
    delivery_date = data.get("deliveryDate")
    delivery_time = data.get("deliveryTime", "09:00")
    purpose = data.get("purpose", "Slab")
    pump_required = bool(data.get("pumpRequired", False))
    payment_terms_days = int(data.get("paymentTermsDays", 30))
    notes = data.get("notes", "")

    if not customer_id or not site_id or quantity_cum <= 0:
        return error_response(code="VALIDATION_ERROR", message="Customer, site, and valid quantity (>0) are required.")

    if not grade_id and grade_code:
        g = Grade.query.filter_by(code=grade_code).first()
        if g: grade_id = g.id

    if not grade_id:
        return error_response(code="VALIDATION_ERROR", message="Valid concrete grade is required.")

    customer = db.session.get(Customer, customer_id)
    if not customer:
        return error_response(code="NOT_FOUND", message="Customer not found.", status_code=404)

    site = Site.query.filter_by(id=site_id, customer_id=customer_id).first()
    if not site:
        return error_response(code="VALIDATION_ERROR", message="Delivery site must belong to the selected customer.")

    # Parse delivery datetime
    try:
        deliv_dt = datetime.strptime(f"{delivery_date} {delivery_time}", "%Y-%m-%d %H:%M")
    except Exception:
        deliv_dt = datetime.now()

    if deliv_dt.date() < datetime.now().date():
        return error_response(code="VALIDATION_ERROR", message="Delivery date cannot be in the past.")

    mix_design_id = data.get("mixDesignId")
    if not mix_design_id and grade_id:
        default_mix = MixDesign.query.filter_by(grade_id=grade_id, is_default=True).first() or MixDesign.query.filter_by(grade_id=grade_id).first()
        if default_mix:
            mix_design_id = default_mix.id
    slump_required_mm = int(data.get("slumpRequiredMm", 120))
    rate_reason = data.get("rateReason", "").strip()

    po_number = get_next_sequence("PO", "PO")
    user_id = get_current_user_id()

    # Mock UBITECH ERP synchronization
    erp_res = ErpService.sync_order(po_number, customer.name, quantity_cum, grade_code or "")

    po = PurchaseOrder(
        po_number=po_number,
        customer_id=customer_id,
        site_id=site_id,
        grade_id=grade_id,
        mix_design_id=mix_design_id,
        slump_required_mm=slump_required_mm,
        rate_reason=rate_reason,
        quantity_cum=quantity_cum,
        rate_per_cum=rate_per_cum or (Grade.query.get(grade_id).default_rate if grade_id else 4500.0),
        delivery_datetime=deliv_dt,
        purpose=purpose,
        pump_required=pump_required,
        pump_ownership=data.get("pumpOwnership") if pump_required else None,
        pump_type=data.get("pumpType") if pump_required else None,
        pipeline_length=data.get("pipelineLength") if pump_required else None,
        workers_required=data.get("workersRequired") if pump_required else None,
        payment_terms_days=payment_terms_days or customer.credit_days,
        ubitech_ref=erp_res.get("ubitech_ref"),
        notes=notes,
        status="DRAFT",
        created_by=user_id
    )

    db.session.add(po)
    db.session.commit()
    return success_response(data=po.to_dict(), status_code=201)

def find_po(id):
    return PurchaseOrder.query.filter(
        (PurchaseOrder.id == id) | (PurchaseOrder.po_number == id),
        PurchaseOrder.is_deleted == False
    ).first()

@orders_bp.route("/<id>", methods=["GET"])
@jwt_required()
@roles_required()
def get_order(id):
    scoped_cust = get_scoped_customer_id()
    po = find_po(id)
    if not po:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    if scoped_cust and po.customer_id != scoped_cust:
        return error_response(code="FORBIDDEN", message="Cannot view another customer's order.", status_code=403)

    return success_response(data=po.to_dict())

@orders_bp.route("/<id>", methods=["PUT", "PATCH"])
@jwt_required()
@roles_required("sales", "sales_manager", "owner")
def update_order(id):
    po = find_po(id)
    if not po:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    if po.status not in ["DRAFT", "REJECTED", "APPROVED"]:
        return error_response(
            code="INVALID_STATE", 
            message=f"Cannot edit order in status '{po.status}'. Only DRAFT, REJECTED, or APPROVED orders can be edited.",
            status_code=409
        )

    data = request.get_json(silent=True) or {}

    # If PO is already APPROVED, controlled edits are enforced
    if po.status == "APPROVED":
        if "quantity" in data:
            new_qty = float(data["quantity"])
            active_trips_qty = sum(t.quantity_cum for t in po.trips if t.status not in ["CANCELLED", "REPLACED"])
            min_allowed = max(po.delivered_quantity, active_trips_qty)
            if new_qty < min_allowed:
                return error_response(
                    code="VALIDATION_ERROR",
                    message=f"Cannot reduce PO quantity to {new_qty} cum. Minimum {min_allowed} cum has already been planned or delivered.",
                    status_code=400
                )
            reason = data.get("reason", "").strip() or data.get("rateReason", "").strip()
            if not reason and new_qty != po.quantity_cum:
                return error_response(code="VALIDATION_ERROR", message="Reason is required when modifying quantity of an approved PO.")
            old_qty = po.quantity_cum
            po.quantity_cum = new_qty
            if reason:
                po.notes = f"{po.notes or ''}\n[Qty revised from {old_qty} to {new_qty} cum on {datetime.now().strftime('%Y-%m-%d %H:%M')}: {reason}]".strip()
    else:
        if "quantity" in data: po.quantity_cum = float(data["quantity"])
    if "ratePerCum" in data: po.rate_per_cum = float(data["ratePerCum"])
    if "purpose" in data: po.purpose = data["purpose"]
    if "pumpRequired" in data: po.pump_required = bool(data["pumpRequired"])
    if "pumpOwnership" in data: po.pump_ownership = data["pumpOwnership"]
    if "pumpType" in data: po.pump_type = data["pumpType"]
    if "pipelineLength" in data: po.pipeline_length = data["pipelineLength"]
    if "workersRequired" in data: po.workers_required = data["workersRequired"]
    if "paymentTermsDays" in data: po.payment_terms_days = int(data["paymentTermsDays"])
    if "notes" in data: po.notes = data["notes"]
    if "siteId" in data: po.site_id = data["siteId"]
    if "deliveryDate" in data and "deliveryTime" in data:
        try:
            po.delivery_datetime = datetime.strptime(f"{data['deliveryDate']} {data['deliveryTime']}", "%Y-%m-%d %H:%M")
        except Exception:
            pass

    db.session.commit()
    return success_response(data=po.to_dict())

@orders_bp.route("/<id>", methods=["DELETE"])
@jwt_required()
@roles_required("sales", "sales_manager", "owner")
def delete_order(id):
    po = PurchaseOrder.query.filter_by(id=id, is_deleted=False).first()
    if not po:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    # Soft delete only allowed while DRAFT
    if po.status != "DRAFT":
        return error_response(
            code="CANNOT_DELETE",
            message="Orders can only be deleted while in DRAFT status. Approved or active orders must be cancelled.",
            status_code=409
        )

    po.is_deleted = True
    db.session.commit()
    return success_response(data={"message": f"PO {po.po_number} deleted successfully."})

@orders_bp.route("/<id>/submit", methods=["POST"])
@jwt_required()
@roles_required("sales", "sales_manager", "owner")
def submit_order(id):
    po = find_po(id)
    if not po:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    try:
        StateMachine.transition_po(po, "SUBMITTED", user_id=get_current_user_id())
        db.session.commit()
        return success_response(data=po.to_dict())
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@orders_bp.route("/<id>/approve", methods=["POST"])
@jwt_required()
@roles_required("sales_manager", "owner")
def approve_order(id):
    po = find_po(id)
    if not po:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    data = request.get_json(silent=True) or {}
    remarks = data.get("remarks", "Approved by Sales Manager")

    try:
        StateMachine.transition_po(po, "APPROVED", user_id=get_current_user_id(), remarks=remarks)
        db.session.commit()
        return success_response(data=po.to_dict())
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@orders_bp.route("/<id>/reject", methods=["POST"])
@jwt_required()
@roles_required("sales_manager", "owner")
def reject_order(id):
    po = find_po(id)
    if not po:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    data = request.get_json(silent=True) or {}
    remarks = data.get("remarks", "Rejected by Sales Manager")

    try:
        StateMachine.transition_po(po, "REJECTED", user_id=get_current_user_id(), remarks=remarks)
        db.session.commit()
        return success_response(data=po.to_dict())
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@orders_bp.route("/<id>/cancel", methods=["POST"])
@jwt_required()
@roles_required("sales", "sales_manager", "dispatcher", "owner")
def cancel_order(id):
    po = find_po(id)
    if not po:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    # Golden rule / requirement: Cancel only when no trip has loaded
    loaded_trips = [t for t in po.trips if t.status in ["LOADED", "QC_PENDING", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"]]
    if loaded_trips:
        return error_response(
            code="CANNOT_CANCEL",
            message=f"Cannot cancel PO: trip {loaded_trips[0].trip_number} is already {loaded_trips[0].status}. Once batching or loading has occurred, cancellation is blocked.",
            status_code=409
        )

    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "Cancelled by user")

    # Cancel any planned / sent to production trips and restore truck/driver availability
    for t in po.trips:
        if t.status in ["PLANNED", "SENT_TO_PRODUCTION"]:
            t.status = "CANCELLED"
            if t.truck:
                t.truck.status = "AVAILABLE"
            if t.driver:
                t.driver.status = "AVAILABLE"

    try:
        StateMachine.transition_po(po, "CANCELLED", user_id=get_current_user_id(), remarks=reason)
        db.session.commit()
        return success_response(data=po.to_dict())
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@orders_bp.route("/<id>/pdf", methods=["GET"])
@jwt_required()
@roles_required()
def get_order_pdf(id):
    po = PurchaseOrder.query.filter_by(id=id, is_deleted=False).first()
    if not po:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    pdf_bytes = PdfService.generate_po_pdf(po)
    response = make_response(pdf_bytes)
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = f"inline; filename={po.po_number}.pdf"
    return response
