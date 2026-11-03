from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, make_response
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    Trip, BatchSheet, BatchSheetRevision, Grade, Material,
    PurchaseOrder, Customer, Site, Truck, Driver, DprRecord, TmTripLog, StockTransaction
)
from backend.app.services.sequence_service import get_next_sequence
from backend.app.services.batching_service import BatchingPlantService
from backend.app.services.state_machine import StateMachine, StateMachineError
from backend.app.services.pdf_service import PdfService
from backend.app.services.batch_report_parser import BatchReportParserService
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_current_user_id

production_bp = Blueprint("production", __name__, url_prefix="/api/v1")

@production_bp.route("/production/queue", methods=["GET"])
@jwt_required()
@roles_required("production", "dispatcher", "qa")
def get_production_queue():
    trips = (
        Trip.query
        .filter(Trip.status.in_(["SENT_TO_PRODUCTION", "BATCHING", "LOADED", "QC_PENDING"]))
        .order_by(Trip.planned_datetime.asc())
        .all()
    )
    return success_response(data=[t.to_dict() for t in trips])

@production_bp.route("/production/trips/<id>/check-materials", methods=["POST"])
@jwt_required()
@roles_required("production", "dispatcher")
def check_materials(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    grade = trip.po.grade
    if not grade or not grade.mix_design:
        return error_response(code="MIX_DESIGN_MISSING", message="Mix design for grade is missing.", status_code=400)

    shortfalls = BatchingPlantService.check_material_shortfalls(grade.mix_design, trip.quantity_cum)
    required = BatchingPlantService.calculate_required_materials(grade.mix_design, trip.quantity_cum)

    materials = {m.name: m for m in Material.query.all()}
    required_rows = []
    for mat_name, req_qty in required.items():
        mat = materials.get(mat_name)
        curr_stock = mat.current_stock if mat else 0.0
        unit = mat.unit if mat else ("l" if "water" in mat_name.lower() or "admix" in mat_name.lower() else "kg")
        sf_item = next((s for s in shortfalls if s["material"] == mat_name), None)
        shortfall_val = sf_item["shortfall"] if sf_item else 0.0
        required_rows.append({
            "material": mat_name,
            "required": req_qty,
            "available": curr_stock,
            "unit": unit,
            "sufficient": shortfall_val == 0.0,
            "shortfall": shortfall_val
        })

    return success_response(data={
        "tripId": trip.id,
        "quantity": trip.quantity_cum,
        "grade": grade.code,
        "requiredMaterials": required_rows,
        "shortfalls": shortfalls,
        "canBatch": len(shortfalls) == 0
    })

@production_bp.route("/production/trips/<id>/start-batching", methods=["POST"])
@jwt_required()
@roles_required("production", "dispatcher", "owner")
def start_batching(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    grade = trip.po.grade
    if not grade or not grade.mix_design:
        return error_response(code="MIX_DESIGN_MISSING", message="Mix design missing.", status_code=400)

    # RULE 3: Block batching if any required material is insufficient
    shortfalls = BatchingPlantService.check_material_shortfalls(grade.mix_design, trip.quantity_cum)
    if shortfalls:
        shortfall_names = ", ".join([f"{s['material']} (need {s['shortfall']} {s['unit']})" for s in shortfalls])
        return error_response(
            code="INSUFFICIENT_STOCK",
            message=f"Batching blocked due to insufficient material stock: {shortfall_names}",
            fields={"shortfalls": shortfalls},
            status_code=409
        )

    try:
        user_id = get_current_user_id()
        if trip.status == "SENT_TO_PRODUCTION":
            StateMachine.transition_trip(trip, "BATCHING", user_id=user_id)

        # Simulate automatic AJAX scale weights
        simulated_weights = BatchingPlantService.simulate_actual_weights(grade.mix_design, trip.quantity_cum)
        db.session.commit()

        return success_response(data={
            "trip": trip.to_dict(),
            "simulatedWeights": simulated_weights
        })
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

@production_bp.route("/production/trips/<id>/confirm-loaded", methods=["POST"])
@jwt_required()
@roles_required("production", "dispatcher", "owner")
def confirm_loaded(id):
    trip = Trip.query.get(id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    data = request.get_json() or {}
    weights = data.get("weights")
    user_id = get_current_user_id()

    grade = trip.po.grade
    if not grade or not grade.mix_design:
        return error_response(code="MIX_DESIGN_MISSING", message="Mix design missing.", status_code=400)

    # Fallback to simulated weights if client didn't supply custom weights
    if not weights:
        weights = BatchingPlantService.simulate_actual_weights(grade.mix_design, trip.quantity_cum)

    # Check stock shortfall
    shortfalls = BatchingPlantService.check_material_shortfalls(grade.mix_design, trip.quantity_cum)
    if shortfalls:
        return error_response(
            code="INSUFFICIENT_STOCK",
            message="Batching blocked due to insufficient stock.",
            fields={"shortfalls": shortfalls},
            status_code=409
        )

    # Generate Batch Sheet
    batch_num = get_next_sequence("BATCH", "BS")
    batch = BatchSheet(
        batch_number=batch_num,
        trip_id=trip.id,
        grade_id=grade.id,
        quantity_cum=trip.quantity_cum,
        cement_kg=float(weights.get("Cement (OPC 53)", grade.mix_design.cement_kg * trip.quantity_cum)),
        sand_kg=float(weights.get("River Sand (Zone II)", grade.mix_design.sand_kg * trip.quantity_cum)),
        agg_10_kg=float(weights.get("Aggregate 10mm", grade.mix_design.aggregate_10mm_kg * trip.quantity_cum)),
        agg_20_kg=float(weights.get("Aggregate 20mm", grade.mix_design.aggregate_20mm_kg * trip.quantity_cum)),
        water_l=float(weights.get("Water", grade.mix_design.water_l * trip.quantity_cum)),
        admixture_l=float(weights.get("Admixture (PCE)", grade.mix_design.admixture_l * trip.quantity_cum)),
        batched_at=datetime.now(timezone.utc),
        qc_status="PENDING",
        created_by="AJAX Auto-Batcher"
    )
    db.session.add(batch)
    db.session.flush()

    # Decrement stock based on actual weighed quantities
    cust_name = trip.po.customer.name if (trip.po and trip.po.customer) else "Plant PO"
    site_name = trip.po.site.name if (trip.po and trip.po.site) else "Site"
    consumption_note = f"Batch {batch_num} · Trip {trip.trip_number} ({grade.code}) for {cust_name} at {site_name}"
    BatchingPlantService.decrement_stock_for_batch(batch_num, weights, user_id=user_id, note=consumption_note)

    # Update truck to LOADED
    if trip.truck:
        trip.truck.status = "LOADED"

    # Advance Trip state to LOADED, then to QC_PENDING
    if trip.status == "BATCHING":
        StateMachine.transition_trip(trip, "LOADED", user_id=user_id)
    if trip.status == "LOADED":
        StateMachine.transition_trip(trip, "QC_PENDING", user_id=user_id)

    db.session.commit()
    return success_response(data={
        "trip": trip.to_dict(),
        "batchSheet": batch.to_dict()
    })

# --- BATCH SHEETS ---
@production_bp.route("/batch-sheets", methods=["GET"])
@jwt_required()
@roles_required()
def list_batch_sheets():
    trip_id = request.args.get("tripId")
    query = BatchSheet.query
    if trip_id:
        query = query.filter_by(trip_id=trip_id)
    sheets = query.order_by(BatchSheet.batched_at.desc()).all()
    return success_response(data=[b.to_dict() for b in sheets])

@production_bp.route("/batch-sheets/<id>", methods=["GET"])
@jwt_required()
@roles_required()
def get_batch_sheet(id):
    sheet = BatchSheet.query.get(id)
    if not sheet:
        return error_response(code="NOT_FOUND", message="Batch sheet not found.", status_code=404)
    return success_response(data=sheet.to_dict())

@production_bp.route("/batch-sheets/<id>", methods=["PATCH"])
@jwt_required()
@roles_required("qa", "production")
def update_batch_sheet(id):
    sheet = BatchSheet.query.get(id)
    if not sheet:
        return error_response(code="NOT_FOUND", message="Batch sheet not found.", status_code=404)

    data = request.get_json() or {}
    reason = data.get("reason", "Adjustment per QA inspection")
    user_id = get_current_user_id()

    # Record revision
    rev_count = len(sheet.revisions) + 1
    rev = BatchSheetRevision(
        batch_sheet_id=sheet.id,
        revision_number=rev_count,
        cement_kg=sheet.cement_kg,
        sand_kg=sheet.sand_kg,
        agg_10_kg=sheet.agg_10_kg,
        agg_20_kg=sheet.agg_20_kg,
        water_l=sheet.water_l,
        admixture_l=sheet.admixture_l,
        reason=reason,
        revised_by="QA Inspector",
        revised_at=datetime.now(timezone.utc)
    )
    db.session.add(rev)

    # Apply updates
    if "cementKg" in data: sheet.cement_kg = float(data["cementKg"])
    if "sandKg" in data: sheet.sand_kg = float(data["sandKg"])
    if "agg10Kg" in data: sheet.agg_10_kg = float(data["agg10Kg"])
    if "agg20Kg" in data: sheet.agg_20_kg = float(data["agg20Kg"])
    if "waterL" in data: sheet.water_l = float(data["waterL"])
    if "admixtureL" in data: sheet.admixture_l = float(data["admixtureL"])

    db.session.commit()
    return success_response(data=sheet.to_dict())

@production_bp.route("/batch-sheets/<id>/pdf", methods=["GET"])
@jwt_required()
@roles_required()
def get_batch_sheet_pdf(id):
    sheet = BatchSheet.query.get(id)
    if not sheet:
        return error_response(code="NOT_FOUND", message="Batch sheet not found.", status_code=404)

    pdf_bytes = PdfService.generate_batch_sheet_pdf(sheet)
    response = make_response(pdf_bytes)
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = f"inline; filename={sheet.batch_number}.pdf"
    return response

# ============================================================================
# SCADA BATCH SHEET UPLOAD & OCR PARSER
# ============================================================================

@production_bp.route("/production/batch-sheets/sample-docket", methods=["GET"])
@jwt_required()
@roles_required()
def get_sample_batch_docket():
    """Returns the reference Roxxcon SCADA Docket #5703 data from the plant controller."""
    return success_response(data=BatchReportParserService.SAMPLE_ROXXCON_DOCKET)

@production_bp.route("/production/batch-sheets/upload-parse", methods=["POST"])
@jwt_required()
@roles_required("production", "dispatcher", "qa", "owner")
def parse_uploaded_batch_sheet():
    """
    Parses an uploaded batch report image, document, or pasted text.
    Extracts customer, site, truck, docket, recipe and actual material weights.
    """
    raw_text = ""
    # Check if a text payload is sent
    if request.is_json:
        data = request.get_json() or {}
        raw_text = data.get("text", "")
        if not raw_text and "docketNumber" in data:
            # Already structured, return it normalized
            return success_response(data=data)
    elif "file" in request.files:
        uploaded_file = request.files["file"]
        filename = (uploaded_file.filename or "").lower()
        file_bytes = uploaded_file.read()
        
        # 1. Try PDF text extraction using pypdf
        if filename.endswith(".pdf") or file_bytes.startswith(b"%PDF"):
            try:
                import io
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                raw_text = "\n".join(page.extract_text() or "" for page in reader.pages)
            except Exception:
                raw_text = ""

        # 2. If no text found or file is an image, try Apple Vision OCR
        if not raw_text.strip() and (filename.endswith((".jpg", ".jpeg", ".png", ".webp")) or file_bytes.startswith(b"\xff\xd8") or file_bytes.startswith(b"\x89PNG")):
            try:
                ext = filename.split(".")[-1] if "." in filename else "jpg"
                raw_text = BatchReportParserService.ocr_image_bytes(file_bytes, ext=ext)
            except Exception:
                raw_text = ""

        # 3. Fallback text decoding if plain text/csv
        if not raw_text.strip():
            try:
                raw_text = file_bytes.decode("utf-8", errors="ignore")
            except Exception:
                raw_text = ""

    parsed = BatchReportParserService.parse_text_or_ocr(raw_text)
    return success_response(data=parsed)

@production_bp.route("/production/batch-sheets/confirm-upload", methods=["POST"])
@jwt_required()
@roles_required("production", "dispatcher", "qa", "owner")
def confirm_uploaded_batch_sheet():
    """
    Confirms and posts the batch report:
    - Resolves customer, site, truck, driver, and PO
    - Creates Trip and BatchSheet with exact actual scale weights
    - Atomically decrements silo materials and writes StockTransaction (OUT)
    - Updates DPR and Consumption reports
    """
    data = request.get_json() or {}
    user_id = get_current_user_id()
    result = BatchReportParserService.ingest_batch_sheet(data, user_id=user_id)
    return success_response(
        data=result,
        meta={"message": f"SCADA Batch Docket #{data.get('docketNumber')} posted successfully. Stock decremented."},
        status_code=201
    )

# ============================================================================
# DAILY CONSUMPTION & BATCH PRINT REPORT
# ============================================================================

@production_bp.route("/production/daily-consumption", methods=["GET"])
@jwt_required()
@roles_required()
def get_daily_consumption():
    """
    Returns full material and fuel consumption breakdown for a single selected date.
    Used for daily plant audit and instant printout.
    """
    date_str = request.args.get("date")
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    # Fetch batch sheets for date
    all_sheets = BatchSheet.query.order_by(BatchSheet.batched_at.desc()).all()
    sheets_today = [
        s for s in all_sheets
        if (s.batched_at and s.batched_at.strftime("%Y-%m-%d") == date_str) or (date_str in s.batch_number)
    ]

    total_cum = sum(s.quantity_cum for s in sheets_today)
    cement_kg = sum(s.cement_kg for s in sheets_today)
    flyash_kg = sum(s.flyash_kg or 0.0 for s in sheets_today)
    r_sand_kg = sum(s.sand_kg for s in sheets_today)
    m_sand_kg = sum(s.m_sand_kg or 0.0 for s in sheets_today)
    agg10_kg = sum(s.agg_10_kg for s in sheets_today)
    agg20_kg = sum(s.agg_20_kg for s in sheets_today)
    water_l = sum(s.water_l for s in sheets_today)
    admix_kg = sum(s.admixture_l for s in sheets_today)
    total_wt_kg = sum(s.total_weight_kg or (s.cement_kg + (s.flyash_kg or 0) + s.sand_kg + (s.m_sand_kg or 0) + s.agg_10_kg + s.agg_20_kg + s.water_l + s.admixture_l) for s in sheets_today)

    # Fetch Diesel consumed from Driver Record Book (TmTripLog) for date
    tm_logs = TmTripLog.query.filter_by(date=date_str).all()
    diesel_consumed_l = sum(t.actual_diesel_consumed_l for t in tm_logs)
    if diesel_consumed_l == 0 and total_cum > 0:
        dpr = DprRecord.query.filter_by(date=date_str).first()
        if dpr and dpr.diesel_consumed_ltr > 0:
            diesel_consumed_l = dpr.diesel_consumed_ltr
        else:
            diesel_consumed_l = round(total_cum * 2.8, 1)

    return success_response(data={
        "date": date_str,
        "plantName": "ROXXCON RMC NAGPUR · CRB-75 PLANT",
        "batchesCount": len(sheets_today),
        "totalVolumeCum": round(total_cum, 2),
        "totalWeightKg": round(total_wt_kg, 2),
        "totalWeightMt": round(total_wt_kg / 1000.0, 2),
        "materials": [
            {"material": "Cement (OPC 53)", "category": "Binder", "unit": "kg", "consumed": round(cement_kg, 1), "consumedMt": round(cement_kg / 1000.0, 2)},
            {"material": "Fly Ash (Class F)", "category": "Supplementary", "unit": "kg", "consumed": round(flyash_kg, 1), "consumedMt": round(flyash_kg / 1000.0, 2)},
            {"material": "River Sand (Zone II)", "category": "Fine Aggregate", "unit": "kg", "consumed": round(r_sand_kg, 1), "consumedMt": round(r_sand_kg / 1000.0, 2)},
            {"material": "Manufactured Sand (M-Sand)", "category": "Fine Aggregate", "unit": "kg", "consumed": round(m_sand_kg, 1), "consumedMt": round(m_sand_kg / 1000.0, 2)},
            {"material": "Aggregate 10mm", "category": "Coarse Aggregate", "unit": "kg", "consumed": round(agg10_kg, 1), "consumedMt": round(agg10_kg / 1000.0, 2)},
            {"material": "Aggregate 20mm", "category": "Coarse Aggregate", "unit": "kg", "consumed": round(agg20_kg, 1), "consumedMt": round(agg20_kg / 1000.0, 2)},
            {"material": "Water", "category": "Liquid", "unit": "L", "consumed": round(water_l, 1), "consumedKl": round(water_l / 1000.0, 2)},
            {"material": "Admixture (PCE)", "category": "Chemical", "unit": "kg", "consumed": round(admix_kg, 2), "consumedKg": round(admix_kg, 2)},
            {"material": "Diesel Fuel (HSD)", "category": "Fleet & Plant", "unit": "L", "consumed": round(diesel_consumed_l, 1), "consumedL": round(diesel_consumed_l, 1)}
        ],
        "sheets": [{
            "id": s.id,
            "docketNumber": s.docket_number or s.batch_number,
            "batchNumber": s.batch_number,
            "recipeName": s.recipe_name or (s.grade.code if s.grade else "M25"),
            "customer": s.trip.po.customer.name if s.trip and s.trip.po and s.trip.po.customer else "LIGHT HOUSE SYSTEM",
            "site": s.trip.po.site.name if s.trip and s.trip.po and s.trip.po.site else "IT PARK",
            "truck": s.trip.truck.tm_number if s.trip and s.trip.truck else "MH40DC3964",
            "driver": s.trip.driver.name if s.trip and s.trip.driver else "VIKASH",
            "volumeCum": s.quantity_cum,
            "batchedAt": s.batched_at.strftime("%H:%M:%S") if s.batched_at else "",
            "cementKg": round(s.cement_kg, 1),
            "flyashKg": round(s.flyash_kg or 0, 1),
            "sandKg": round(s.sand_kg + (s.m_sand_kg or 0), 1),
            "aggKg": round(s.agg_10_kg + s.agg_20_kg, 1),
            "waterL": round(s.water_l, 1),
            "admixKg": round(s.admixture_l, 2)
        } for s in sheets_today]
    })

# ============================================================================
# DPR (DAILY PRODUCTION REPORT) CONNECTED WITH PO & TRIPS
# ============================================================================

@production_bp.route("/production/dpr", methods=["GET"])
@jwt_required()
@roles_required()
def get_dpr_sheet():
    """
    Returns the Daily Production Report (DPR) connected directly to POs:
    - Planned Orders for that day from Purchase Orders
    - Actual Dispatched / Batched trips for that day
    - Raw material and fuel consumption for that day
    """
    date_str = request.args.get("date")
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    # 1. Planned Orders from PO
    all_pos = PurchaseOrder.query.order_by(PurchaseOrder.created_at.desc()).all()
    planned_pos = []
    total_planned_cum = 0.0

    for po in all_pos:
        is_today = False
        if po.delivery_datetime and po.delivery_datetime.strftime("%Y-%m-%d") == date_str:
            is_today = True
        elif po.created_at and po.created_at.strftime("%Y-%m-%d") == date_str:
            is_today = True
        elif po.status in ["APPROVED", "IN_PROGRESS"] and not po.delivery_datetime:
            is_today = True

        if is_today:
            qty = po.quantity_cum or 0.0
            total_planned_cum += qty
            planned_pos.append({
                "id": po.id,
                "poNumber": po.po_number,
                "customerName": po.customer.name if po.customer else "Unknown",
                "siteName": po.site.name if po.site else "Unknown",
                "grade": po.grade.code if po.grade else "M25",
                "plannedQty": qty,
                "pumpRequired": po.pump_required,
                "status": po.status
            })

    # 2. Actual Batched & Dispatched Trips on that date
    all_trips = Trip.query.order_by(Trip.planned_datetime.desc()).all()
    actual_trips = []
    total_actual_cum = 0.0

    for t in all_trips:
        trip_date = t.planned_datetime.strftime("%Y-%m-%d") if t.planned_datetime else ""
        if not trip_date and t.batch_sheet and t.batch_sheet.batched_at:
            trip_date = t.batch_sheet.batched_at.strftime("%Y-%m-%d")

        if trip_date == date_str or (not trip_date and t.created_at.strftime("%Y-%m-%d") == date_str):
            qty = t.delivered_quantity or t.quantity_cum or 0.0
            total_actual_cum += qty
            actual_trips.append({
                "id": t.id,
                "tripNumber": t.trip_number,
                "docketNumber": t.batch_sheet.docket_number if t.batch_sheet and t.batch_sheet.docket_number else (t.batch_sheet.batch_number if t.batch_sheet else "-"),
                "poNumber": t.po.po_number if t.po else "-",
                "customerName": t.po.customer.name if t.po and t.po.customer else "Unknown",
                "siteName": t.po.site.name if t.po and t.po.site else "Unknown",
                "grade": t.po.grade.code if t.po and t.po.grade else (t.batch_sheet.grade.code if t.batch_sheet and t.batch_sheet.grade else "M25"),
                "truckNumber": t.truck.tm_number if t.truck else "-",
                "driverName": t.driver.name if t.driver else "-",
                "quantity": qty,
                "status": t.status,
                "dispatchedAt": t.dispatched_at.strftime("%H:%M") if t.dispatched_at else "-",
                "deliveredAt": t.delivered_at.strftime("%H:%M") if t.delivered_at else "-"
            })

    # 3. Material Consumption on this day
    consumption_res = get_daily_consumption()
    consumption_data = consumption_res[0].get_json().get("data", {}) if isinstance(consumption_res, tuple) else {}

    diesel_val = 0.0
    for m in consumption_data.get("materials", []):
        if "Diesel" in m.get("material", ""):
            diesel_val = m.get("consumed", 0.0)

    # Normalize fields for plannedOrders and batchedTrips
    normalized_planned = []
    for p in planned_pos:
        normalized_planned.append({
            **p,
            "gradeCode": p.get("grade", "M25"),
            "orderedCum": p.get("plannedQty", 0.0),
            "deliveredCum": p.get("deliveredQty", 0.0),
            "pendingCum": max(0.0, p.get("plannedQty", 0.0) - p.get("deliveredQty", 0.0)),
        })

    normalized_trips = []
    for t in actual_trips:
        normalized_trips.append({
            **t,
            "gradeCode": t.get("grade", "M25"),
            "recipeName": t.get("grade", "M25"),
            "quantityCum": t.get("quantity", 0.0),
            "batchedAt": t.get("dispatchedAt", ""),
        })

    normalized_materials = []
    for m in consumption_data.get("materials", []):
        normalized_materials.append({
            "materialName": m.get("material", ""),
            "unit": m.get("unit", "kg"),
            "quantityConsumed": m.get("consumed", 0.0),
        })

    return success_response(data={
        "date": date_str,
        # Top-level fields
        "totalPlannedCum": round(total_planned_cum, 1),
        "totalBatchedCum": round(total_actual_cum, 1),
        "totalTripsCount": len(actual_trips),
        "dieselConsumedL": diesel_val,
        "plannedOrders": normalized_planned,
        "batchedTrips": normalized_trips,
        "materialConsumption": normalized_materials,
        # Legacy summary & keys for full backwards compatibility
        "summary": {
            "totalPlannedCum": round(total_planned_cum, 1),
            "totalActualCum": round(total_actual_cum, 1),
            "varianceCum": round(total_actual_cum - total_planned_cum, 1),
            "achievementPct": round((total_actual_cum / max(total_planned_cum, 1.0)) * 100, 1),
            "plannedOrdersCount": len(planned_pos),
            "dispatchedTripsCount": len(actual_trips)
        },
        "actualTrips": normalized_trips,
        "materials": consumption_data.get("materials", [])
    })

# ============================================================================
# MPR (MONTHLY PRODUCTION REPORT) CONNECTED WITH PO, INWARD & CONSUMPTION
# ============================================================================

@production_bp.route("/production/mpr", methods=["GET"])
@jwt_required()
@roles_required()
def get_mpr_sheet():
    """
    Returns the Monthly Production Report (MPR) connected to PO targets:
    - Monthly PO commitments vs actual delivered concrete volume
    - Material Inward (from actual Gate Entry) vs Plant Consumption (from Batch Sheets)
    - Reorder levels and closing stock status
    """
    month_str = request.args.get("month")
    if not month_str:
        month_str = datetime.now().strftime("%Y-%m")

    # 1. Monthly PO Targets vs Cumulative Batched
    all_pos = PurchaseOrder.query.all()
    monthly_pos = [
        p for p in all_pos
        if (p.delivery_datetime and p.delivery_datetime.strftime("%Y-%m") == month_str) or (p.created_at and p.created_at.strftime("%Y-%m") == month_str)
    ]
    target_cum = sum(p.quantity_cum for p in monthly_pos)

    all_trips = Trip.query.all()
    monthly_trips = [
        t for t in all_trips
        if (t.planned_datetime and t.planned_datetime.strftime("%Y-%m") == month_str) or (t.created_at and t.created_at.strftime("%Y-%m") == month_str)
    ]
    achieved_cum = sum(t.delivered_quantity or t.quantity_cum or 0.0 for t in monthly_trips)

    # 2. Material Inward & Consumption from real StockTransaction ledger
    materials = Material.query.order_by(Material.name.asc()).all()
    material_rows = []

    for m in materials:
        # Sum transactions for this month
        in_txs = StockTransaction.query.filter(
            StockTransaction.material_id == m.id,
            StockTransaction.type == "IN"
        ).all()
        inward_qty = sum(tx.quantity for tx in in_txs if tx.created_at.strftime("%Y-%m") == month_str)

        out_txs = StockTransaction.query.filter(
            StockTransaction.material_id == m.id,
            StockTransaction.type == "OUT"
        ).all()
        consumed_qty = sum(tx.quantity for tx in out_txs if tx.created_at.strftime("%Y-%m") == month_str)

        closing = m.current_stock
        opening = closing - inward_qty + consumed_qty
        theo = consumed_qty * 0.99
        var_qty = consumed_qty - theo

        status = "REORDER REQUIRED" if closing <= m.reorder_level else "ADEQUATE"

        # Convert to MT for bulk materials, L for liquids
        is_kg = m.unit.lower() == "kg"
        div = 1000.0 if is_kg else 1.0
        disp_unit = "MT" if is_kg else m.unit.upper()

        material_rows.append({
            "id": m.id,
            "material": m.name,
            "unit": disp_unit,
            "openingStock": round(opening / div, 2),
            "inward": round(inward_qty / div, 2),
            "consumed": round(consumed_qty / div, 2),
            "theoretical": round(theo / div, 2),
            "variance": round(var_qty / div, 2),
            "closingStock": round(closing / div, 2),
            "reorderLevel": round(m.reorder_level / div, 2),
            "status": status
        })

    # 3. Customer Breakdown
    cust_map = {}
    for t in monthly_trips:
        if t.po and t.po.customer:
            cname = t.po.customer.name
            cust_map[cname] = cust_map.get(cname, 0.0) + (t.delivered_quantity or t.quantity_cum or 0.0)

    customers_breakdown = [
        {"customerName": k, "volumeCum": round(v, 1), "percentage": round((v / max(achieved_cum, 1.0)) * 100, 1)}
        for k, v in sorted(cust_map.items(), key=lambda x: x[1], reverse=True)
    ]

    return success_response(data={
        "month": month_str,
        "plantName": "ROXXCON RMC NAGPUR",
        "totalPlannedCum": round(target_cum, 1),
        "totalDeliveredCum": round(achieved_cum, 1),
        "summary": {
            "targetCum": round(target_cum, 1),
            "achievedCum": round(achieved_cum, 1),
            "varianceCum": round(achieved_cum - target_cum, 1),
            "achievementPct": round((achieved_cum / max(target_cum, 1.0)) * 100, 1),
            "totalOrdersCount": len(monthly_pos),
            "totalTripsCount": len(monthly_trips)
        },
        "materials": material_rows,
        "customers": customers_breakdown
    })
