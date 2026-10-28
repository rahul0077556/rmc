from datetime import datetime, timezone
from flask import Blueprint, request, make_response
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    Trip, BatchSheet, BatchSheetRevision, Grade, Material
)
from backend.app.services.sequence_service import get_next_sequence
from backend.app.services.batching_service import BatchingPlantService
from backend.app.services.state_machine import StateMachine, StateMachineError
from backend.app.services.pdf_service import PdfService
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
    BatchingPlantService.decrement_stock_for_batch(batch_num, weights, user_id=user_id)

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
