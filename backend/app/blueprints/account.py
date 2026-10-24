from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import Employee, PayrollRun
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required

account_bp = Blueprint("account", __name__, url_prefix="/api/v1/account")

# --- EMPLOYEES ---
@account_bp.route("/employees", methods=["GET"])
@jwt_required()
@roles_required()
def list_employees():
    employees = Employee.query.order_by(Employee.name.asc()).all()
    return success_response(data=[e.to_dict() for e in employees])

@account_bp.route("/employees", methods=["POST"])
@jwt_required()
@roles_required("account", "owner")
def add_employee():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return error_response(code="VALIDATION_ERROR", message="Employee name is required.")

    count = Employee.query.count() + 1
    emp_code = data.get("id") or f"EMP{count:03d}"

    emp = Employee(
        emp_code=emp_code,
        name=name,
        department=data.get("department", "Logistics"),
        role=data.get("role", "Staff"),
        join_date=data.get("joinDate", datetime.now().strftime("%Y-%m-%d")),
        status=data.get("status", "ACTIVE"),
        base_salary=float(data.get("baseSalary", 35000.0))
    )
    db.session.add(emp)
    db.session.commit()
    return success_response(data=emp.to_dict(), status_code=201)

# --- PAYROLL ---
@account_bp.route("/payroll", methods=["GET"])
@jwt_required()
@roles_required()
def list_payroll():
    runs = PayrollRun.query.order_by(PayrollRun.created_at.desc()).all()
    return success_response(data=[r.to_dict() for r in runs])

@account_bp.route("/payroll", methods=["POST"])
@jwt_required()
@roles_required("account", "owner")
def create_payroll_run():
    data = request.get_json() or {}
    period = data.get("period", datetime.now().strftime("%b %Y"))

    active_emps = Employee.query.filter_by(status="ACTIVE").all()
    total_emps = len(active_emps)
    total_amount = float(data.get("totalAmount", sum(e.base_salary for e in active_emps)))

    count = PayrollRun.query.count() + 1
    code = f"PR{datetime.now().strftime('%Y%m')}_{count:02d}"

    run = PayrollRun(
        payroll_code=code,
        period=period,
        total_employees=total_emps,
        total_amount=total_amount,
        status=data.get("status", "DRAFT"),
        processed_date=datetime.now(timezone.utc) if data.get("status") == "PAID" else None
    )
    db.session.add(run)
    db.session.commit()
    return success_response(data=run.to_dict(), status_code=201)

# --- SUMMARY ---
@account_bp.route("/summary", methods=["GET"])
@jwt_required()
@roles_required()
def get_payroll_summary():
    active_emps = Employee.query.filter_by(status="ACTIVE").all()
    monthly_payroll = sum(e.base_salary for e in active_emps)
    
    # Calculate next end of month
    now = datetime.now()
    import calendar
    last_day = calendar.monthrange(now.year, now.month)[1]
    next_payday = f"{last_day} {now.strftime('%b, %Y')}"

    return success_response(data={
        "activeEmployees": len(active_emps),
        "monthlyPayroll": round(monthly_payroll, 2),
        "nextPayday": next_payday
    })
