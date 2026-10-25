from datetime import datetime, timezone
from flask import Blueprint, request, make_response
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    Trip, PurchaseOrder, Truck, Driver, Challan
)
from backend.app.services.sequence_service import get_next_sequence
from backend.app.services.state_machine import StateMachine, StateMachineError
from backend.app.services.notification_service import NotificationService
from backend.app.services.pdf_service import PdfService
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_scoped_customer_id, get_current_user_id

trips_bp = Blueprint("trips", __name__, url_prefix="/api/v1/trips")

@trips_bp.route("", methods=["GET"])
@jwt_required()
@roles_required()
def list_trips():
    scoped_cust = get_scoped_customer_id()
    query = Trip.query

    if scoped_cust:
        query = query.join(PurchaseOrder).filter(PurchaseOrder.customer_id == scoped_cust)
    else:
        po_id = request.args.get("poId")
        if po_id:
            query = query.filter(Trip.po_id == po_id)

    status = request.args.get("status")
    if status:
        query = query.filter(Trip.status == status)

    trips = query.order_by(Trip.planned_datetime.desc()).all()
    return success_response(data=[t.to_dict() for t in trips])

@trips_bp.route("", methods=["POST"])
@jwt_required()
@roles_required("dispatcher")
def create_trip():
    data = request.get_json(silent=True) or {}
    po_id = data.get("poId")
    quantity_cum = float(data.get("quantity", 0))
    tm_id = data.get("tmId")
    driver_id = data.get("driverId")
    planned_time = data.get("plannedTime")
    notes = data.get("notes", "")

    if not po_id or quantity_cum <= 0:
        return error_response(code="VALIDATION_ERROR", message="PO ID and valid quantity (>0) are required.")

    po = PurchaseOrder.query.filter((PurchaseOrder.id == po_id) | (PurchaseOrder.po_number == po_id)).first()
    if not po or po.is_deleted:
        return error_response(code="NOT_FOUND", message="Purchase order not found.", status_code=404)

    if po.status not in ["APPROVED", "IN_PROGRESS"]:
        return error_response(
            code="INVALID_PO_STATE",
            message=f"Cannot plan trips for PO in status '{po.status}'. PO must be APPROVED or IN_PROGRESS.",
            status_code=409
        )

    # RULE 1: PO balance rule. Never allow trips beyond the balance.
    balance = po.balance_quantity
    if quantity_cum > balance + 0.001:  # small float tolerance
        return error_response(
            code="EXCEEDS_BALANCE",
            message=f"Trip quantity ({quantity_cum} cum) exceeds remaining PO balance ({balance} cum).",
            status_code=409
        )

    # Validate truck and driver
    truck = None
    if tm_id:
        truck = Truck.query.get(tm_id)
        if not truck:
            return error_response(code="NOT_FOUND", message="Truck not found.", status_code=404)
        
        # RULE 2: Trip quantity must be <= TM capacity
        if quantity_cum > truck.capacity_cum:
            return error_response(
                code="EXCEEDS_CAPACITY",
                message=f"Trip quantity ({quantity_cum} cum) exceeds TM {truck.tm_number} capacity ({truck.capacity_cum} cum).",
                status_code=409
            )

        # TM cannot be in maintenance or already in active transit/loaded
        if truck.status in ["MAINTENANCE", "IN_TRANSIT", "LOADED"]:
            return error_response(
                code="TRUCK_UNAVAILABLE",
                message=f"Truck {truck.tm_number} is currently {truck.status} and cannot be assigned.",
                status_code=409
            )

    driver = None
    if driver_id:
        driver = Driver.query.get(driver_id)
        if not driver:
            return error_response(code="NOT_FOUND", message="Driver not found.", status_code=404)
        if driver.status == "UNAVAILABLE":
            return error_response(code="DRIVER_UNAVAILABLE", message="Selected driver is unavailable.", status_code=409)

    # Parse planned time
    try:
        planned_dt = datetime.fromisoformat(planned_time.replace("Z", "+00:00")) if planned_time else datetime.now(timezone.utc)
    except Exception:
        planned_dt = datetime.now(timezone.utc)

    trip_number = get_next_sequence("TRIP", "TRIP")
    user_id = get_current_user_id()
    seq_num = len(po.trips) + 1

    trip = Trip(
        trip_number=trip_number,
        po_id=po.id,
        truck_id=tm_id,
        driver_id=driver_id,
        sequence=seq_num,
        quantity_cum=quantity_cum,
        planned_datetime=planned_dt,
        status="PLANNED",
        notes=notes,
        created_by=user_id
    )

    if truck:
        truck.status = "ASSIGNED"
    if driver:
        driver.status = "ASSIGNED"

    # Mark PO as IN_PROGRESS if first trip
    if po.status == "APPROVED":
        StateMachine.transition_po(po, "IN_PROGRESS", user_id=user_id)

    db.session.add(trip)
    db.session.commit()
    return success_response(data=trip.to_dict(), status_code=201)

@trips_bp.route("/<id>", methods=["PATCH"])
@jwt_required()
@roles_required("dispatcher")
def assign_trip(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    data = request.get_json(silent=True) or {}
    tm_id = data.get("tmId")
    driver_id = data.get("driverId")

    if tm_id:
        truck = Truck.query.get(tm_id)
        if not truck:
            return error_response(code="NOT_FOUND", message="Truck not found.", status_code=404)
        if trip.quantity_cum > truck.capacity_cum:
            return error_response(code="EXCEEDS_CAPACITY", message=f"Trip quantity exceeds truck capacity ({truck.capacity_cum} cum).", status_code=409)
        trip.truck_id = tm_id
        truck.status = "ASSIGNED"

    if driver_id:
        driver = Driver.query.get(driver_id)
        if not driver:
            return error_response(code="NOT_FOUND", message="Driver not found.", status_code=404)
        trip.driver_id = driver_id
        driver.status = "ASSIGNED"

    db.session.commit()
    return success_response(data=trip.to_dict())

@trips_bp.route("/<id>/send-to-production", methods=["POST"])
@jwt_required()
@roles_required("dispatcher")
def send_to_production(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    if not trip.truck_id or not trip.driver_id:
        return error_response(code="RESOURCE_UNASSIGNED", message="Please assign both a Truck and a Driver before sending to production.", status_code=400)

    try:
        user_id = get_current_user_id()
        StateMachine.transition_trip(trip, "SENT_TO_PRODUCTION", user_id=user_id)

        # Log simulated WhatsApp coordination message with Production
        NotificationService.send_whatsapp(
            recipient="Plant Batching Operator",
            template="production_order_alert",
            payload_data={
                "message": f"Production Alert: Trip {trip.trip_number} scheduled. Grade: {trip.po.grade.code}, Qty: {trip.quantity_cum} cum, TM: {trip.truck.tm_number}, Driver: {trip.driver.name}."
            },
            related_trip_id=trip.id,
            related_po_id=trip.po_id,
            created_by=user_id
        )

        db.session.commit()
        return success_response(data=trip.to_dict())
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@trips_bp.route("/<id>/release", methods=["POST"])
@jwt_required()
@roles_required("dispatcher")
def release_trip(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    # HARD BUSINESS RULE 4: Release is impossible without QC approval
    if trip.status != "QC_APPROVED":
        return error_response(
            code="QC_APPROVAL_REQUIRED",
            message=f"Hard Rule: Cannot release Trip {trip.trip_number} without QC Approval. Current status is '{trip.status}'.",
            status_code=409
        )

    user_id = get_current_user_id()
    try:
        # Generate challan if not already existing
        if not trip.challan:
            ch_num = get_next_sequence("CHALLAN", "CH")
            challan = Challan(
                challan_number=ch_num,
                trip_id=trip.id,
                issued_at=datetime.now(timezone.utc),
                printed_copies=3,
                released_by="Dispatcher Release Desk",
                created_by=user_id
            )
            db.session.add(challan)
            db.session.flush()

        StateMachine.transition_trip(trip, "DISPATCHED", user_id=user_id)

        # Send simulated WhatsApp to customer
        NotificationService.send_whatsapp(
            recipient=trip.po.customer.phone,
            template="dispatch_release_alert",
            payload_data={
                "customer": trip.po.customer.name,
                "poNumber": trip.po.po_number,
                "tripNumber": trip.trip_number,
                "tmNumber": trip.truck.tm_number if trip.truck else "N/A",
                "driver": f"{trip.driver.name} ({trip.driver.phone})" if trip.driver else "N/A",
                "grade": trip.po.grade.code,
                "quantity": f"{trip.quantity_cum} cum",
                "dispatchTime": trip.dispatched_at.strftime("%Y-%m-%d %H:%M UTC") if trip.dispatched_at else "",
                "message": f"Concrete Dispatched: {trip.quantity_cum} cum {trip.po.grade.code} in TM {trip.truck.tm_number if trip.truck else ''} is on its way to {trip.po.site.name}."
            },
            related_trip_id=trip.id,
            related_po_id=trip.po_id,
            created_by=user_id
        )

        db.session.commit()
        return success_response(data=trip.to_dict())
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@trips_bp.route("/<id>/in-transit", methods=["POST"])
@jwt_required()
@roles_required("dispatcher")
def mark_in_transit(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    try:
        StateMachine.transition_trip(trip, "IN_TRANSIT", user_id=get_current_user_id())
        db.session.commit()
        return success_response(data=trip.to_dict())
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@trips_bp.route("/<id>/deliver", methods=["POST"])
@jwt_required()
@roles_required("dispatcher")
def mark_delivered(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    data = request.get_json() or {}
    delivered_qty = float(data.get("deliveredQuantity", trip.quantity_cum))
    receiver_name = data.get("receiverName", "Site Engineer")

    try:
        StateMachine.transition_trip(
            trip, 
            "DELIVERED", 
            user_id=get_current_user_id(),
            extra_data={"delivered_quantity": delivered_qty, "receiver_name": receiver_name}
        )
        db.session.commit()
        return success_response(data=trip.to_dict())
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@trips_bp.route("/<id>/challan/pdf", methods=["GET"])
@jwt_required()
@roles_required()
def get_challan_pdf(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    if not trip.challan:
        return error_response(code="CHALLAN_NOT_GENERATED", message="Challan not yet generated for this trip.", status_code=400)

    pdf_bytes = PdfService.generate_challan_pdf(trip.challan)
    response = make_response(pdf_bytes)
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = f"inline; filename={trip.challan.challan_number}.pdf"
    return response
