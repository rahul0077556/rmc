from datetime import datetime, timezone, timedelta
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    Trip, BatchSheet, QcCheck, CubeSet, CubeTest, MaterialTest, User
)
from backend.app.services.sequence_service import get_next_sequence
from backend.app.services.state_machine import StateMachine, StateMachineError
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_current_user_id

qa_bp = Blueprint("qa", __name__, url_prefix="/api/v1/qa")

@qa_bp.route("/queue", methods=["GET"])
@jwt_required()
@roles_required("qa", "dispatcher")
def get_qa_queue():
    trips = (
        Trip.query
        .filter(Trip.status.in_(["QC_PENDING", "CORRECTING", "QC_REJECTED"]))
        .order_by(Trip.planned_datetime.asc())
        .all()
    )
    return success_response(data=[t.to_dict() for t in trips])

@qa_bp.route("/checks", methods=["POST"])
@jwt_required()
@roles_required("qa")
def submit_qc_check():
    data = request.get_json() or {}
    trip_id = data.get("tripId")
    batch_sheet_id = data.get("batchSheetId")
    physical_ok = bool(data.get("physicalInspection", "PASS") == "PASS")
    slump_mm = int(data.get("slump", 120))
    bleeding_ok = bool(data.get("bleeding", "PASS") == "PASS")
    wrong_mix_ok = bool(data.get("wrongMix", "PASS") == "PASS")
    admixture_type = data.get("admixtureType")
    admixture_qty = float(data.get("admixtureQty", 0.0))
    decision = data.get("decision", "APPROVE").upper()  # APPROVE, REJECT
    reject_action = data.get("rejectAction")  # CORRECT, REPLACE
    remarks = data.get("remarks", "")

    trip = Trip.query.get(trip_id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    batch_sheet = BatchSheet.query.get(batch_sheet_id) if batch_sheet_id else trip.batch_sheet
    if not batch_sheet:
        return error_response(code="NOT_FOUND", message="Batch sheet not found for this trip.", status_code=404)

    grade = trip.po.grade
    user_id = get_current_user_id()
    user = User.query.get(user_id)
    inspector_name = user.name if user else "QC Engineer"

    # RULE 6: Slump outside grade's allowed range cannot be approved without documented admixture correction
    if decision == "APPROVE" and grade:
        if (slump_mm < grade.slump_min_mm or slump_mm > grade.slump_max_mm) and admixture_qty <= 0:
            return error_response(
                code="SLUMP_OUT_OF_RANGE",
                message=f"Slump {slump_mm} mm is outside grade {grade.code} allowed range ({grade.slump_min_mm}-{grade.slump_max_mm} mm). Cannot approve without documented admixture addition correction.",
                status_code=409
            )

    qc = QcCheck(
        trip_id=trip.id,
        batch_sheet_id=batch_sheet.id,
        physical_inspection_ok=physical_ok,
        slump_mm=slump_mm,
        bleeding_ok=bleeding_ok,
        wrong_mix_ok=wrong_mix_ok,
        admixture_type=admixture_type,
        admixture_qty=admixture_qty,
        decision=decision,
        reject_action=reject_action if decision == "REJECT" else None,
        remarks=remarks,
        checked_by=inspector_name,
        checked_at=datetime.now(timezone.utc),
        created_by=user_id
    )
    db.session.add(qc)

    try:
        if decision == "APPROVE":
            batch_sheet.qc_status = "APPROVED"
            batch_sheet.qc_signed_by = inspector_name
            batch_sheet.qc_signed_at = datetime.now(timezone.utc)
            StateMachine.transition_trip(trip, "QC_APPROVED", user_id=user_id)

        elif decision == "REJECT":
            batch_sheet.qc_status = "REJECTED"
            StateMachine.transition_trip(trip, "QC_REJECTED", user_id=user_id)

            if reject_action == "CORRECT":
                StateMachine.transition_trip(trip, "CORRECTING", user_id=user_id)
                # After correcting, loop back to QC_PENDING for re-check
                StateMachine.transition_trip(trip, "QC_PENDING", user_id=user_id)

            elif reject_action == "REPLACE":
                StateMachine.transition_trip(trip, "REPLACED", user_id=user_id)
                
                # BUSINESS RULE 5: Auto-create replacement trip for Dispatch
                rep_trip_num = get_next_sequence("TRIP", "TRIP")
                replacement_trip = Trip(
                    trip_number=rep_trip_num,
                    po_id=trip.po_id,
                    quantity_cum=trip.quantity_cum,
                    planned_datetime=datetime.now(timezone.utc) + timedelta(minutes=30),
                    status="PLANNED",
                    replaced_trip_id=trip.id,
                    notes=f"Auto-replacement for rejected Trip {trip.trip_number}. Reason: {remarks}",
                    created_by=user_id
                )
                db.session.add(replacement_trip)

        db.session.commit()
        return success_response(data={
            "qcCheck": qc.to_dict(),
            "trip": trip.to_dict(),
            "batchSheet": batch_sheet.to_dict()
        })
    except StateMachineError as e:
        return error_response(code="INVALID_STATE", message=e.message, status_code=e.status_code)

# --- CUBE CASTING & TESTING ---
@qa_bp.route("/cube-sets", methods=["GET"])
@jwt_required()
@roles_required()
def list_cube_sets():
    sets = CubeSet.query.order_by(CubeSet.cast_date.desc()).all()
    return success_response(data=[s.to_dict() for s in sets])

@qa_bp.route("/cube-sets", methods=["POST"])
@jwt_required()
@roles_required("qa")
def create_cube_set():
    data = request.get_json() or {}
    trip_id = data.get("tripId")
    batch_sheet_id = data.get("batchSheetId")
    cube_count = int(data.get("cubeCount", 6))
    cast_date_str = data.get("castDate")

    trip = Trip.query.get(trip_id)
    if not trip:
        return error_response(code="NOT_FOUND", message="Trip not found.", status_code=404)

    if not batch_sheet_id and trip.batch_sheet:
        batch_sheet_id = trip.batch_sheet.id

    if not batch_sheet_id:
        return error_response(code="NOT_FOUND", message="Batch sheet not found.", status_code=404)

    cast_date = datetime.strptime(cast_date_str, "%Y-%m-%d").date() if cast_date_str else datetime.now(timezone.utc).date()
    user_id = get_current_user_id()

    cube_set = CubeSet(
        batch_sheet_id=batch_sheet_id,
        trip_id=trip.id,
        cast_date=cast_date,
        cube_count=cube_count,
        created_by=user_id
    )
    db.session.add(cube_set)
    db.session.flush()

    # Auto-create 3-day, 7-day, and 28-day tests (Section 5.6 & 8)
    for age in [3, 7, 28]:
        test = CubeTest(
            cube_set_id=cube_set.id,
            age_days=age,
            due_date=cast_date + timedelta(days=age),
            result="PENDING",
            created_by=user_id
        )
        db.session.add(test)

    db.session.commit()
    return success_response(data=cube_set.to_dict(), status_code=201)

@qa_bp.route("/cube-tests/<id>/result", methods=["POST"])
@jwt_required()
@roles_required("qa")
def record_cube_test_result(id):
    test = CubeTest.query.get(id)
    if not test:
        return error_response(code="NOT_FOUND", message="Cube test not found.", status_code=404)

    data = request.get_json() or {}
    strength_mpa = float(data.get("strengthMpa", 0.0))
    tested_on_str = data.get("testedOn")
    user_id = get_current_user_id()
    user = User.query.get(user_id)

    test.tested_on = datetime.strptime(tested_on_str, "%Y-%m-%d").date() if tested_on_str else datetime.now(timezone.utc).date()
    test.strength_mpa = strength_mpa
    test.tested_by = user.name if user else "QA Engineer"

    # BUSINESS RULE 9: Cube pass criteria:
    # 28-day strength >= grade characteristic strength
    # 7-day >= 65% of characteristic strength
    # 3-day >= 40% of characteristic strength
    grade = test.cube_set.trip.po.grade if (test.cube_set and test.cube_set.trip and test.cube_set.trip.po) else None
    char_strength = grade.characteristic_strength_mpa if grade else 25.0

    if test.age_days == 28:
        threshold = char_strength
    elif test.age_days == 7:
        threshold = char_strength * 0.65
    else:  # 3 days
        threshold = char_strength * 0.40

    test.result = "PASS" if strength_mpa >= threshold else "FAIL"

    db.session.commit()
    return success_response(data=test.to_dict())

# --- MATERIAL TESTS ---
@qa_bp.route("/material-tests", methods=["GET"])
@jwt_required()
@roles_required()
def list_material_tests():
    tests = MaterialTest.query.order_by(MaterialTest.tested_on.desc()).all()
    return success_response(data=[m.to_dict() for m in tests])

@qa_bp.route("/material-tests", methods=["POST"])
@jwt_required()
@roles_required("qa")
def create_material_test():
    data = request.get_json() or {}
    material = data.get("material", "Cement")
    test_name = data.get("testName", "Fineness Test")
    result = data.get("result", "PASS (2.4% residue)")
    tested_on_str = data.get("testedOn")
    remarks = data.get("remarks", "")

    user_id = get_current_user_id()
    user = User.query.get(user_id)
    tested_on = datetime.strptime(tested_on_str, "%Y-%m-%d").date() if tested_on_str else datetime.now(timezone.utc).date()

    test = MaterialTest(
        material=material,
        test_name=test_name,
        result=result,
        tested_on=tested_on,
        remarks=remarks,
        tested_by=user.name if user else "QA Chemist",
        created_by=user_id
    )
    db.session.add(test)
    db.session.commit()
    return success_response(data=test.to_dict(), status_code=201)
