from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    Material, StockTransaction, WeighbridgeTicket,
    TransitMixerPayload, DprRecord, ExpenseRecord,
    AttendanceRecord, WeighbridgeSettings, TmTripLog,
    Plant, User
)
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_current_user_id

store_bp = Blueprint("store", __name__, url_prefix="/api/v1/store")

# --- INVENTORY & MATERIAL STOCKS ---
@store_bp.route("/inventory", methods=["GET"])
@jwt_required()
@roles_required()
def get_inventory():
    materials = Material.query.order_by(Material.name.asc()).all()
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

        # Dynamic Inward & Consumption from StockTransaction ledger
        total_in = db.session.query(db.func.sum(StockTransaction.quantity)).filter_by(material_id=m.id, type="IN").scalar() or 0.0
        total_out = db.session.query(db.func.sum(StockTransaction.quantity)).filter_by(material_id=m.id, type="OUT").scalar() or 0.0

        status = "HEALTHY"
        is_water = "water" in m.name.lower()
        if is_water:
            status = "HEALTHY"
        elif m.current_stock < 0:
            status = "NEEDS_RECONCILIATION"
        elif m.current_stock <= (m.reorder_level * 0.5):
            status = "CRITICAL"
        elif m.current_stock <= m.reorder_level:
            status = "LOW"

        silo_name = "Storage Tank" if cat in ["WATER", "ADMIXTURE"] else ("Aggregate Bay" if cat in ["SAND", "AGGREGATE"] else "Vertical Silo")

        items.append({
            "id": m.id,
            "material": m.name,
            "category": cat,
            "siloName": silo_name,
            "currentStock": round(m.current_stock, 1),
            "unit": m.unit,
            "capacity": capacity if getattr(m, "is_tracked", True) else None,
            "reorderLevel": round(m.reorder_level, 1),
            "density": getattr(m, "density", 1.0) or 1.0,
            "isTracked": getattr(m, "is_tracked", True),
            "isNegative": m.current_stock < 0,
            "totalInward": round(total_in, 1),
            "totalConsumed": round(total_out, 1),
            "status": status,
            "lastUpdated": m.updated_at.isoformat() if m.updated_at else datetime.now(timezone.utc).isoformat()
        })
    return success_response(data=items)

@store_bp.route("/transactions", methods=["GET"])
@jwt_required()
@roles_required()
def list_stock_transactions():
    material_id = request.args.get("materialId")
    tx_type = request.args.get("type")  # IN, OUT, ADJUST

    query = StockTransaction.query
    if material_id:
        query = query.filter_by(material_id=material_id)
    if tx_type:
        query = query.filter_by(type=tx_type.upper())

    transactions = query.order_by(StockTransaction.created_at.desc()).limit(150).all()
    return success_response(data=[{
        "id": tx.id,
        "materialId": tx.material_id,
        "materialName": tx.material.name if tx.material else "Unknown",
        "unit": tx.material.unit if tx.material else "kg",
        "type": tx.type,
        "quantity": round(tx.quantity, 1),
        "reference": tx.reference,
        "note": tx.note or "",
        "createdAt": tx.created_at.isoformat(),
        "createdBy": tx.created_by or "Plant System"
    } for tx in transactions])

@store_bp.route("/inventory/adjust", methods=["POST"])
@jwt_required()
@roles_required("store", "owner", "dispatcher", "production")
def adjust_inventory():
    data = request.get_json() or {}
    material_id = data.get("materialId")
    material_name = data.get("material")
    qty = float(data.get("quantity", 0))
    action_type = data.get("type", "ADJUST")  # IN, OUT, ADJUST
    note = (data.get("note") or data.get("reason") or "").strip()

    if not note or len(note) < 3:
        return error_response(code="REASON_REQUIRED", message="A mandatory reason is required for manual stock issue or adjustment.", status_code=400)

    material = None
    if material_id:
        material = Material.query.get(material_id)
    elif material_name:
        material = Material.query.filter(Material.name.ilike(f"%{material_name}%")).first()

    if not material:
        return error_response(code="NOT_FOUND", message="Material not found in database.", status_code=404)

    # Golden Rule 1: Only manual store issues and adjustments are blocked from going below zero
    if action_type == "OUT" and (material.current_stock - qty < 0):
        return error_response(
            code="INSUFFICIENT_STOCK",
            message=f"Manual issue cannot reduce stock below zero. Current stock of {material.name} is {material.current_stock} {material.unit}.",
            status_code=409
        )

    user_id = get_current_user_id()
    user = User.query.get(user_id) if user_id else None
    user_name = user.name if user else "Store Admin"

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
        note=note,
        created_by=user_name
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
@roles_required("store", "owner", "dispatcher", "production")
def create_weighbridge_ticket():
    data = request.get_json() or {}
    now_str = datetime.now(timezone.utc).isoformat()

    # Generate sequential ticket number if not provided
    ticket_num = data.get("ticketNumber")
    if not ticket_num:
        count = WeighbridgeTicket.query.count() + 1
        ticket_num = f"WB-2026-{count:05d}"

    # Calculate net weight or quantity
    gross_w = float(data.get("grossWeight", 0.0))
    tare_w = float(data.get("tareWeight", 0.0))
    net_w = float(data.get("netWeight", 0.0))
    ticket_type = data.get("type", "INWARD").upper()

    if ticket_type == "INWARD" and gross_w > 0 and tare_w > 0 and tare_w >= gross_w:
        return error_response(
            code="INVALID_WEIGHTS",
            message=f"Tare weight ({tare_w} kg) cannot be greater than or equal to Gross weight ({gross_w} kg) for inward material consignment.",
            status_code=400
        )

    if net_w <= 0 and gross_w > tare_w:
        net_w = gross_w - tare_w
    elif net_w <= 0 and data.get("quantity"):
        net_w = float(data.get("quantity", 0.0))

    # Convert MT to KG if specified or detected (e.g. 25-40 tons truck entered as 25.0)
    unit = str(data.get("unit", "kg")).strip().upper()
    is_mt = unit in ["MT", "TONS", "TONNE", "TONNES"] or (0 < net_w < 150 and unit not in ["L", "LTR", "LITRE", "LITRES"])
    if is_mt:
        net_w = net_w * 1000.0
        if 0 < gross_w < 150:
            gross_w = gross_w * 1000.0
        if 0 < tare_w < 150:
            tare_w = tare_w * 1000.0

    mat_name = data.get("material", "Cement (OPC 53)").strip()
    mat = None
    if data.get("materialId"):
        mat = Material.query.get(data.get("materialId"))
    if not mat and mat_name:
        # Match plant material names
        mat = Material.query.filter(Material.name.ilike(f"%{mat_name}%")).first()
        if not mat:
            # Fallback keyword match
            if "cement" in mat_name.lower():
                mat = Material.query.filter(Material.name.ilike("%cement%")).first()
            elif "sand" in mat_name.lower():
                mat = Material.query.filter(Material.name.ilike("%sand%")).first()
            elif "10" in mat_name.lower():
                mat = Material.query.filter(Material.name.ilike("%10mm%")).first()
            elif "20" in mat_name.lower():
                mat = Material.query.filter(Material.name.ilike("%20mm%")).first()
            elif "admix" in mat_name.lower():
                mat = Material.query.filter(Material.name.ilike("%admixture%")).first()

    supplier = data.get("supplierOrCustomer") or data.get("partyName") or "Plant Inward Vendor"
    vehicle = (data.get("vehicleNumber") or "").strip().upper()

    # Block duplicate open tickets for the same vehicle
    if vehicle:
        open_ticket = WeighbridgeTicket.query.filter_by(vehicle_number=vehicle, status="PENDING").first()
        if open_ticket:
            return error_response(
                code="VEHICLE_HAS_OPEN_TICKET",
                message=f"Vehicle {vehicle} already has an open ticket #{open_ticket.ticket_number}. Complete that ticket first.",
                status_code=409
            )

    gate_pass = data.get("gatePassNo") or f"GP-{datetime.now().strftime('%d%m%H%M')}"
    challan_w = float(data.get("challanWeight", net_w))
    variance_kg = round(net_w - challan_w, 2)

    ticket = WeighbridgeTicket(
        ticket_number=ticket_num,
        type=ticket_type,
        vehicle_number=vehicle or "MH-12-INWARD",
        material=mat.name if mat else mat_name,
        supplier_or_customer=supplier,
        gross_weight=gross_w,
        tare_weight=tare_w,
        net_weight=net_w,
        gross_time=data.get("grossTime", now_str),
        tare_time=data.get("tareTime", now_str),
        status="COMPLETED",
        variance=variance_kg,
        challan_weight=challan_w,
        received_rs=float(data.get("receivedRs", 0.0)),
        wb_name=data.get("wbName", "Gate Scale #1"),
        driver_name=data.get("driverName", "Inward Driver"),
        watchman_name=data.get("watchmanName", "Ganesh S (Gate Security)"),
        gate_pass_no=gate_pass
    )
    db.session.add(ticket)

    # Immediately increment live material stock in database
    if ticket.type == "INWARD" and net_w > 0 and mat:
        # If material unit is Litres (e.g. Admixture), convert kg to Litres using density
        added_qty = net_w
        density = getattr(mat, "density", 1.0) or 1.0
        if mat.unit.lower() in ["l", "ltr", "litre"] and unit not in ["L", "LTR", "LITRE", "LITRES"]:
            added_qty = round(net_w / density, 2)
            note_str = f"Inward from {supplier} (Truck {vehicle}) · {net_w} kg ({added_qty} L @ density {density}) · Gate Pass {gate_pass}"
        else:
            note_str = f"Inward from {supplier} (Truck {vehicle}) · Gate Pass {gate_pass}"

        mat.current_stock = round(mat.current_stock + added_qty, 2)
        tx = StockTransaction(
            material_id=mat.id,
            type="IN",
            quantity=added_qty,
            reference=ticket.ticket_number,
            note=note_str,
            created_by="Store Gate Console"
        )
        db.session.add(tx)

    db.session.commit()
    return success_response(data={
        "ticket": ticket.to_dict(),
        "updatedStock": mat.to_dict() if mat else None
    }, status_code=201)

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
    if "plantName" in data:
        settings.plant_name = data["plantName"]
        plant = Plant.query.first()
        if plant:
            plant.name = data["plantName"]
    if "vendorSoftwareName" in data: settings.vendor_software_name = data["vendorSoftwareName"]
    if "vendorCompanyName" in data: settings.vendor_company_name = data["vendorCompanyName"]
    if "customerCare" in data: settings.customer_care = data["customerCare"]
    if "wbName" in data: settings.wb_name = data["wbName"]
    if "comPort" in data: settings.com_port = data["comPort"]
    if "autoCapture" in data: settings.auto_capture = bool(data["autoCapture"])

    db.session.commit()
    return success_response(data=settings.to_dict())

# --- DRIVER RECORD BOOK & TM AVERAGE ---
@store_bp.route("/tm-logs", methods=["GET"])
@jwt_required()
@roles_required()
def list_tm_logs():
    date_filter = request.args.get("date")
    month_filter = request.args.get("month")

    query = TmTripLog.query
    if date_filter:
        query = query.filter_by(date=date_filter)
    elif month_filter:
        query = query.filter(TmTripLog.date.startswith(month_filter))

    logs = query.order_by(TmTripLog.created_at.desc()).all()
    return success_response(data=[l.to_dict() for l in logs])

@store_bp.route("/tm-logs", methods=["POST"])
@jwt_required()
@roles_required("store", "dispatcher", "owner", "production")
def create_tm_log():
    data = request.get_json() or {}
    date_str = str(data.get("date") or datetime.now().strftime("%Y-%m-%d")).strip()
    driver_name = str(data.get("driverName", "")).strip()
    truck_no = str(data.get("truckNumber", "")).strip().upper()

    if not driver_name or not truck_no:
        return error_response(code="VALIDATION_ERROR", message="Driver name and TM vehicle number are required.")

    start_km = float(data.get("startKm", 0.0))
    end_km = float(data.get("endKm", 0.0))
    running_km = max(0.0, end_km - start_km) if end_km >= start_km else float(data.get("runningKm", 0.0))

    start_hr = float(data.get("handiStartHr", 0.0))
    close_hr = float(data.get("handiClosingHr", 0.0))
    running_hr = max(0.0, close_hr - start_hr) if close_hr >= start_hr else float(data.get("handiRunningHr", 0.0))
    extra_hr = float(data.get("extraHandiHr", 0.0))

    opening_diesel = float(data.get("openingDiesel", 0.0))
    issued_diesel = float(data.get("issuedDiesel", 0.0))
    closing_diesel = float(data.get("closingDiesel", 0.0))

    actual_diesel = (opening_diesel + issued_diesel) - closing_diesel
    if actual_diesel <= 0:
        actual_diesel = issued_diesel if issued_diesel > 0 else (round(running_km / 1.8, 1) if running_km > 0 else 25.0)

    km_per_l = round(running_km / max(actual_diesel, 0.1), 2) if actual_diesel > 0 else 1.80

    log = TmTripLog(
        date=date_str,
        driver_name=driver_name,
        truck_number=truck_no,
        truck_capacity_cum=float(data.get("truckCapacity", 8.0)),
        start_km=start_km,
        end_km=end_km,
        running_km=running_km,
        handi_start_hr=start_hr,
        handi_closing_hr=close_hr,
        handi_running_hr=running_hr,
        extra_handi_hr=extra_hr,
        opening_diesel_l=opening_diesel,
        issued_diesel_l=issued_diesel,
        closing_diesel_l=closing_diesel,
        actual_diesel_consumed_l=actual_diesel,
        km_per_liter=km_per_l,
        trips_count=int(data.get("tripsCount", 1)),
        concrete_volume_cum=float(data.get("concreteVolume", 0.0)),
        remarks=data.get("remarks") or ("Within Fuel Norms" if km_per_l >= 1.8 else "Low Avg: Short Lead / Traffic")
    )
    db.session.add(log)

    # Deduct fuel from Material inventory if Diesel (HSD) exists
    diesel_mat = Material.query.filter(Material.name.ilike("%diesel%")).first()
    if diesel_mat:
        diesel_mat.current_stock = max(0.0, diesel_mat.current_stock - actual_diesel)
        tx = StockTransaction(
            material_id=diesel_mat.id,
            type="OUT",
            quantity=actual_diesel,
            reference=f"FUEL-{truck_no}",
            note=f"Diesel issued to TM {truck_no} ({driver_name}) · {running_km:.1f} KM run · Avg {km_per_l} KM/L",
            created_by="Fleet Fuel Console"
        )
        db.session.add(tx)

    # Pass fuel consumption into Daily Production Report (DPR) record
    dpr = DprRecord.query.filter_by(date=date_str).first()
    if not dpr:
        dpr = DprRecord(date=date_str, diesel_consumed_ltr=actual_diesel)
        db.session.add(dpr)
    else:
        dpr.diesel_consumed_ltr += actual_diesel

    db.session.commit()
    return success_response(data=log.to_dict(), meta={"message": "TM driver fuel log recorded and consumption updated successfully."}, status_code=201)
