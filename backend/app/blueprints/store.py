from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    Material, StockTransaction, WeighbridgeTicket,
    TransitMixerPayload, DprRecord, ExpenseRecord,
    AttendanceRecord, WeighbridgeSettings
)
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required

store_bp = Blueprint("store", __name__, url_prefix="/api/v1/store")

# --- INVENTORY & MATERIAL STOCKS ---
@store_bp.route("/inventory", methods=["GET"])
@jwt_required()
@roles_required()
def get_inventory():
    materials = Material.query.order_by(Material.name.asc()).all()
    # Map to InventoryItem structure
    items = []
    for m in materials:
        cat = "CEMENT"
        name_lower = m.name.lower()
        if "sand" in name_lower: cat = "SAND"
        elif "aggregate" in name_lower or "agg" in name_lower: cat = "AGGREGATE"
        elif "fly" in name_lower or "ash" in name_lower or "ggbs" in name_lower: cat = "SUPPLEMENTARY"
        elif "water" in name_lower: cat = "WATER"
        elif "admixture" in name_lower: cat = "ADMIXTURE"
        elif "diesel" in name_lower or "fuel" in name_lower: cat = "FUEL"

        # Material capacity estimated based on standard plant silos
        capacity = 500000.0 if cat in ["SAND", "AGGREGATE", "WATER"] else 200000.0

        items.append({
            "id": m.id,
            "material": m.name,
            "category": cat,
            "currentStock": round(m.current_stock, 1),
            "unit": m.unit,
            "capacity": capacity,
            "reorderLevel": round(m.reorder_level, 1),
            "lastUpdated": m.updated_at.isoformat() if m.updated_at else datetime.now(timezone.utc).isoformat()
        })
    return success_response(data=items)

@store_bp.route("/inventory/adjust", methods=["POST"])
@jwt_required()
@roles_required("store", "owner", "dispatcher", "production")
def adjust_inventory():
    data = request.get_json() or {}
    material_id = data.get("materialId")
    material_name = data.get("material")
    qty = float(data.get("quantity", 0))
    action_type = data.get("type", "ADJUST")  # IN, OUT, ADJUST
    note = data.get("note", "Manual adjustment via Store console")

    material = None
    if material_id:
        material = Material.query.get(material_id)
    elif material_name:
        material = Material.query.filter(Material.name.ilike(f"%{material_name}%")).first()

    if not material:
        return error_response(code="NOT_FOUND", message="Material not found in database.", status_code=404)

    if action_type == "IN":
        material.current_stock += qty
    elif action_type == "OUT":
        material.current_stock = max(0.0, material.current_stock - qty)
    else:
        material.current_stock = qty

    tx = StockTransaction(
        material_id=material.id,
        type=action_type,
        quantity=qty,
        reference=data.get("reference", "MANUAL-STORE"),
        note=note
    )
    db.session.add(tx)
    db.session.commit()

    return success_response(data=material.to_dict(), message="Material stock adjusted successfully.")

# --- WEIGHBRIDGE TICKETS ---
@store_bp.route("/weighbridge/tickets", methods=["GET"])
@jwt_required()
@roles_required()
def list_weighbridge_tickets():
    tickets = WeighbridgeTicket.query.order_by(WeighbridgeTicket.created_at.desc()).all()
    return success_response(data=[t.to_dict() for t in tickets])

@store_bp.route("/weighbridge/tickets", methods=["POST"])
@jwt_required()
@roles_required("store", "owner", "dispatcher")
def create_weighbridge_ticket():
    data = request.get_json() or {}
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Generate sequential ticket number if not provided
    ticket_num = data.get("ticketNumber")
    if not ticket_num:
        count = WeighbridgeTicket.query.count() + 1
        ticket_num = f"WB-2026-{str(count).padStart(5, '0')}" if hasattr(str(count), 'padStart') else f"WB-2026-{count:05d}"

    ticket = WeighbridgeTicket(
        ticket_number=ticket_num,
        type=data.get("type", "INWARD"),
        vehicle_number=data.get("vehicleNumber", "").strip().upper(),
        material=data.get("material", "River Sand (Zone II)"),
        supplier_or_customer=data.get("supplierOrCustomer", "Sai ReadyMix Inward"),
        gross_weight=float(data.get("grossWeight", 0.0)),
        tare_weight=float(data.get("tareWeight", 0.0)),
        net_weight=float(data.get("netWeight", 0.0)),
        gross_time=data.get("grossTime", now_str),
        tare_time=data.get("tareTime", now_str),
        status=data.get("status", "COMPLETED"),
        variance=float(data.get("variance", 0.0)),
        challan_weight=float(data.get("challanWeight", 0.0)),
        received_rs=float(data.get("receivedRs", 0.0)),
        wb_name=data.get("wbName", "Weighbridge #1"),
        driver_name=data.get("driverName", ""),
        watchman_name=data.get("watchmanName", "Ganesh K"),
        gate_pass_no=data.get("gatePassNo", "")
    )
    db.session.add(ticket)

    # If inward and net weight is positive, automatically update material stock in database
    if ticket.type == "INWARD" and ticket.net_weight > 0 and ticket.status == "COMPLETED":
        mat = Material.query.filter(Material.name.ilike(f"%{ticket.material}%")).first()
        if mat:
            mat.current_stock += ticket.net_weight
            tx = StockTransaction(
                material_id=mat.id,
                type="IN",
                quantity=ticket.net_weight,
                reference=ticket.ticket_number,
                note=f"Weighbridge Inward gate pass {ticket.gate_pass_no or ticket.ticket_number}"
            )
            db.session.add(tx)

    db.session.commit()
    return success_response(data=ticket.to_dict(), status_code=201)

@store_bp.route("/weighbridge/tickets/<id>", methods=["PUT", "PATCH"])
@jwt_required()
@roles_required("store", "owner", "dispatcher")
def update_weighbridge_ticket(id):
    ticket = WeighbridgeTicket.query.get(id)
    if not ticket:
        return error_response(code="NOT_FOUND", message="Weighbridge ticket not found.", status_code=404)

    data = request.get_json() or {}
    prev_status = ticket.status
    prev_net = ticket.net_weight

    if "tareWeight" in data: ticket.tare_weight = float(data["tareWeight"])
    if "grossWeight" in data: ticket.gross_weight = float(data["grossWeight"])
    if "netWeight" in data: ticket.net_weight = float(data["netWeight"])
    elif "tareWeight" in data or "grossWeight" in data:
        ticket.net_weight = max(0.0, ticket.gross_weight - ticket.tare_weight)

    if "status" in data: ticket.status = data["status"]
    if "tareTime" in data: ticket.tare_time = data["tareTime"]
    if "grossTime" in data: ticket.gross_time = data["grossTime"]
    if "variance" in data: ticket.variance = float(data["variance"])
    if "challanWeight" in data: ticket.challan_weight = float(data["challanWeight"])
    if "receivedRs" in data: ticket.received_rs = float(data["receivedRs"])
    if "driverName" in data: ticket.driver_name = data["driverName"]
    if "watchmanName" in data: ticket.watchman_name = data["watchmanName"]
    if "gatePassNo" in data: ticket.gate_pass_no = data["gatePassNo"]

    # If transitioning to COMPLETED with net weight, update material stock
    if ticket.type == "INWARD" and ticket.status == "COMPLETED" and (prev_status != "COMPLETED" or ticket.net_weight != prev_net):
        delta = ticket.net_weight if prev_status != "COMPLETED" else (ticket.net_weight - prev_net)
        if delta != 0:
            mat = Material.query.filter(Material.name.ilike(f"%{ticket.material}%")).first()
            if mat:
                mat.current_stock += delta
                tx = StockTransaction(
                    material_id=mat.id,
                    type="IN" if delta > 0 else "ADJUST",
                    quantity=abs(delta),
                    reference=ticket.ticket_number,
                    note=f"Weighbridge ticket completed/updated ({ticket.ticket_number})"
                )
                db.session.add(tx)

    db.session.commit()
    return success_response(data=ticket.to_dict())

# --- TRANSIT MIXER PAYLOADS ---
@store_bp.route("/transit-mixers", methods=["GET"])
@jwt_required()
@roles_required()
def list_transit_mixers():
    mixers = TransitMixerPayload.query.order_by(TransitMixerPayload.s_no.asc()).all()
    return success_response(data=[m.to_dict() for m in mixers])

@store_bp.route("/transit-mixers/<vehicle_no>", methods=["PUT", "PATCH"])
@jwt_required()
@roles_required("store", "owner", "dispatcher")
def update_transit_mixer(vehicle_no):
    mixer = TransitMixerPayload.query.filter_by(vehicle_no=vehicle_no).first()
    if not mixer:
        return error_response(code="NOT_FOUND", message="Transit mixer payload record not found.", status_code=404)

    data = request.get_json() or {}
    for field in [
        "vehicleType", "make", "location", "vehicleTyreDetails", "overLoadPass",
        "installedHandiCapacityCum", "rtoGvwKg", "tareWeightKg", "weightOfWaterKg",
        "newTareWeightKg", "actualWeightForLoadingKg", "payLoadCapacityRcGvwCum",
        "supplyPayLoadCapacityOverloadPassCum"
    ]:
        if field in data:
            db_attr = {
                "vehicleType": "vehicle_type",
                "make": "make",
                "location": "location",
                "vehicleTyreDetails": "vehicle_tyre_details",
                "overLoadPass": "overload_pass",
                "installedHandiCapacityCum": "installed_handi_capacity_cum",
                "rtoGvwKg": "rto_gvw_kg",
                "tareWeightKg": "tare_weight_kg",
                "weightOfWaterKg": "weight_of_water_kg",
                "newTareWeightKg": "new_tare_weight_kg",
                "actualWeightForLoadingKg": "actual_weight_for_loading_kg",
                "payLoadCapacityRcGvwCum": "payload_capacity_rc_gvw_cum",
                "supplyPayLoadCapacityOverloadPassCum": "supply_payload_capacity_overload_pass_cum"
            }[field]
            setattr(mixer, db_attr, data[field])

    db.session.commit()
    return success_response(data=mixer.to_dict())

# --- DPR RECORDS ---
@store_bp.route("/dpr", methods=["GET"])
@jwt_required()
@roles_required()
def list_dpr_records():
    records = DprRecord.query.order_by(DprRecord.date.desc()).all()
    return success_response(data=[r.to_dict() for r in records])

@store_bp.route("/dpr", methods=["POST"])
@jwt_required()
@roles_required("store", "owner", "production", "dispatcher")
def create_dpr_record():
    data = request.get_json() or {}
    record_date = data.get("date", datetime.now().strftime("%Y-%m-%d"))

    record = DprRecord.query.filter_by(date=record_date).first()
    if not record:
        record = DprRecord(date=record_date)
        db.session.add(record)

    record.total_batches = int(data.get("totalBatches", 0))
    record.total_cum = float(data.get("totalCum", 0.0))
    record.cement_consumed_mt = float(data.get("cementConsumedMt", 0.0))
    record.fly_ash_consumed_mt = float(data.get("flyAshConsumedMt", 0.0))
    record.ggbs_consumed_mt = float(data.get("ggbsConsumedMt", 0.0))
    record.sand_consumed_mt = float(data.get("sandConsumedMt", 0.0))
    record.aggregate_consumed_mt = float(data.get("aggregateConsumedMt", 0.0))
    record.water_consumed_kl = float(data.get("waterConsumedKl", 0.0))
    record.admixture_consumed_kg = float(data.get("admixtureConsumedKg", 0.0))
    record.diesel_consumed_ltr = float(data.get("dieselConsumedLtr", 0.0))

    db.session.commit()
    return success_response(data=record.to_dict(), status_code=201)

# --- EXPENSES ---
@store_bp.route("/expenses", methods=["GET"])
@jwt_required()
@roles_required()
def list_expenses():
    expenses = ExpenseRecord.query.order_by(ExpenseRecord.date.desc()).all()
    return success_response(data=[e.to_dict() for e in expenses])

@store_bp.route("/expenses", methods=["POST"])
@jwt_required()
@roles_required("store", "owner", "account")
def create_expense():
    data = request.get_json() or {}
    expense = ExpenseRecord(
        category=data.get("category", "Diesel"),
        vendor=data.get("vendor", ""),
        bill_no=data.get("billNo", ""),
        date=data.get("date", datetime.now().strftime("%Y-%m-%d")),
        amount=float(data.get("amount", 0.0)),
        status=data.get("status", "PAID"),
        description=data.get("description", "")
    )
    db.session.add(expense)
    db.session.commit()
    return success_response(data=expense.to_dict(), status_code=201)

# --- ATTENDANCE ---
@store_bp.route("/attendance", methods=["GET"])
@jwt_required()
@roles_required()
def list_attendance():
    records = AttendanceRecord.query.order_by(AttendanceRecord.name.asc()).all()
    return success_response(data=[a.to_dict() for a in records])

@store_bp.route("/attendance", methods=["POST"])
@jwt_required()
@roles_required("store", "owner", "account")
def log_attendance():
    data = request.get_json() or {}
    name = data.get("name", "")
    record = AttendanceRecord.query.filter_by(name=name).first()
    if not record:
        record = AttendanceRecord(name=name, type=data.get("type", "DRIVER"), designation_or_vehicle=data.get("designationOrVehicle", ""))
        db.session.add(record)

    record.type = data.get("type", record.type)
    record.designation_or_vehicle = data.get("designationOrVehicle", record.designation_or_vehicle)
    record.shift = data.get("shift", "Day")
    record.trips_or_tasks = int(data.get("tripsOrTasks", 0))
    record.status = data.get("status", "PRESENT")
    record.sync_source = data.get("syncSource", "UBITECH")

    db.session.commit()
    return success_response(data=record.to_dict())

# --- SETTINGS ---
@store_bp.route("/settings", methods=["GET"])
@jwt_required()
@roles_required()
def get_settings():
    settings = WeighbridgeSettings.query.first()
    if not settings:
        settings = WeighbridgeSettings()
        db.session.add(settings)
        db.session.commit()
    return success_response(data=settings.to_dict())

@store_bp.route("/settings", methods=["PUT", "PATCH"])
@jwt_required()
@roles_required("store", "owner")
def update_settings():
    settings = WeighbridgeSettings.query.first()
    if not settings:
        settings = WeighbridgeSettings()
        db.session.add(settings)

    data = request.get_json() or {}
    if "plantName" in data: settings.plant_name = data["plantName"]
    if "vendorSoftwareName" in data: settings.vendor_software_name = data["vendorSoftwareName"]
    if "vendorCompanyName" in data: settings.vendor_company_name = data["vendorCompanyName"]
    if "customerCare" in data: settings.customer_care = data["customerCare"]
    if "wbName" in data: settings.wb_name = data["wbName"]
    if "comPort" in data: settings.com_port = data["comPort"]
    if "autoCapture" in data: settings.auto_capture = bool(data["autoCapture"])

    db.session.commit()
    return success_response(data=settings.to_dict())
