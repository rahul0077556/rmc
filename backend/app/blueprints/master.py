from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.app.extensions import db
from backend.app.models.models import (
    Customer, Site, Grade, MixDesign, Material, StockTransaction, Truck, Driver
)
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_scoped_customer_id, get_current_user_id

master_bp = Blueprint("master", __name__, url_prefix="/api/v1")

# --- CUSTOMERS ---
@master_bp.route("/customers", methods=["GET"])
@jwt_required()
@roles_required()
def list_customers():
    scoped_cust = get_scoped_customer_id()
    query = Customer.query
    if scoped_cust:
        query = query.filter_by(id=scoped_cust)
    
    search = request.args.get("search", "").strip()
    if search:
        query = query.filter(Customer.name.ilike(f"%{search}%"))

    customers = query.order_by(Customer.name.asc()).all()
    return success_response(data=[c.to_dict() for c in customers])

@master_bp.route("/customers", methods=["POST"])
@jwt_required()
@roles_required("sales", "sales_manager")
def create_customer():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    contact_person = data.get("contactPerson", "").strip()
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip()
    gstin = data.get("gstin", "").strip()
    address = data.get("billingAddress", "").strip() or data.get("address", "").strip()
    credit_days = int(data.get("creditDays", 30))
    credit_limit = float(data.get("creditLimit", 0.0))

    if not name or not contact_person or not phone or not gstin:
        return error_response(code="VALIDATION_ERROR", message="Customer name, contact, phone and GSTIN are required.")

    user_id = get_current_user_id()
    cust = Customer(
        name=name,
        contact_person=contact_person,
        phone=phone,
        email=email,
        gstin=gstin,
        address=address,
        credit_days=credit_days,
        credit_limit=credit_limit,
        created_by=user_id
    )
    db.session.add(cust)
    db.session.commit()
    return success_response(data=cust.to_dict(), status_code=201)

@master_bp.route("/customers/<id>", methods=["GET"])
@jwt_required()
@roles_required()
def get_customer(id):
    scoped_cust = get_scoped_customer_id()
    if scoped_cust and scoped_cust != id:
        return error_response(code="FORBIDDEN", message="Cannot access another customer's data.", status_code=403)

    cust = Customer.query.get(id)
    if not cust:
        return error_response(code="NOT_FOUND", message="Customer not found.", status_code=404)
    return success_response(data=cust.to_dict())

@master_bp.route("/customers/<id>", methods=["PUT", "PATCH"])
@jwt_required()
@roles_required("sales", "sales_manager")
def update_customer(id):
    cust = Customer.query.get(id)
    if not cust:
        return error_response(code="NOT_FOUND", message="Customer not found.", status_code=404)

    data = request.get_json() or {}
    if "name" in data: cust.name = data["name"]
    if "contactPerson" in data: cust.contact_person = data["contactPerson"]
    if "phone" in data: cust.phone = data["phone"]
    if "email" in data: cust.email = data["email"]
    if "gstin" in data: cust.gstin = data["gstin"]
    if "billingAddress" in data: cust.address = data["billingAddress"]
    if "creditDays" in data: cust.credit_days = int(data["creditDays"])
    if "creditLimit" in data: cust.credit_limit = float(data["creditLimit"])

    db.session.commit()
    return success_response(data=cust.to_dict())

# --- SITES ---
@master_bp.route("/sites", methods=["GET"])
@jwt_required()
@roles_required()
def list_sites():
    scoped_cust = get_scoped_customer_id()
    customer_id = request.args.get("customerId") or scoped_cust
    query = Site.query
    if customer_id:
        query = query.filter_by(customer_id=customer_id)
    sites = query.all()
    return success_response(data=[s.to_dict() for s in sites])

@master_bp.route("/sites", methods=["POST"])
@jwt_required()
@roles_required("sales", "sales_manager")
def create_site():
    data = request.get_json() or {}
    customer_id = data.get("customerId")
    name = data.get("name")
    address = data.get("address")
    contact_person = data.get("contactPerson")
    phone = data.get("phone")
    accessibility = data.get("accessibilityNotes", "")

    if not customer_id or not name or not address:
        return error_response(code="VALIDATION_ERROR", message="Customer, site name and address are required.")

    site = Site(
        customer_id=customer_id,
        name=name,
        address=address,
        contact_person=contact_person or "",
        phone=phone or "",
        accessibility_notes=accessibility,
        created_by=get_current_user_id()
    )
    db.session.add(site)
    db.session.commit()
    return success_response(data=site.to_dict(), status_code=201)

# --- GRADES & MIX DESIGNS ---
@master_bp.route("/grades", methods=["GET"])
@jwt_required()
@roles_required()
def list_grades():
    grades = Grade.query.order_by(Grade.code.asc()).all()
    return success_response(data=[g.to_dict() for g in grades])

@master_bp.route("/mix-designs/<grade_id>", methods=["GET"])
@jwt_required()
@roles_required()
def get_mix_design(grade_id):
    mix = MixDesign.query.filter_by(grade_id=grade_id).first()
    if not mix:
        return error_response(code="NOT_FOUND", message="Mix design not found.", status_code=404)
    return success_response(data=mix.to_dict())

# --- MATERIALS ---
@master_bp.route("/materials", methods=["GET"])
@jwt_required()
@roles_required()
def list_materials():
    materials = Material.query.all()
    return success_response(data=[m.to_dict() for m in materials])

@master_bp.route("/materials/adjust", methods=["POST"])
@jwt_required()
@roles_required("production", "dispatcher")
def adjust_stock():
    data = request.get_json() or {}
    material_id = data.get("materialId")
    quantity = float(data.get("quantity", 0.0))
    action_type = data.get("type", "IN")  # IN, OUT, ADJUST
    note = data.get("note", "Goods receipt / stock adjustment")

    mat = Material.query.get(material_id)
    if not mat:
        return error_response(code="NOT_FOUND", message="Material not found.", status_code=404)

    if action_type == "IN":
        mat.current_stock += quantity
    elif action_type == "OUT":
        mat.current_stock = max(0.0, mat.current_stock - quantity)
    elif action_type == "ADJUST":
        mat.current_stock = quantity

    user_id = get_current_user_id()
    tx = StockTransaction(
        material_id=mat.id,
        type=action_type,
        quantity=quantity,
        note=note,
        reference="Manual Adjustment",
        created_by=user_id
    )
    db.session.add(tx)
    db.session.commit()
    return success_response(data=mat.to_dict())

# --- TRUCKS & DRIVERS ---
@master_bp.route("/trucks", methods=["GET"])
@jwt_required()
@roles_required()
def list_trucks():
    trucks = Truck.query.all()
    return success_response(data=[t.to_dict() for t in trucks])

@master_bp.route("/drivers", methods=["GET"])
@jwt_required()
@roles_required()
def list_drivers():
    drivers = Driver.query.all()
    return success_response(data=[d.to_dict() for d in drivers])
