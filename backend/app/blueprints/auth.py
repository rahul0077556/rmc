from flask import Blueprint, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from backend.app.models.models import User
from backend.app.utils.responses import success_response, error_response
from backend.app.extensions import db

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return error_response(code="INVALID_CREDENTIALS", message="Email and password are required.", status_code=400)

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return error_response(code="UNAUTHORIZED", message="Invalid email or password.", status_code=401)

    if not user.is_active:
        return error_response(code="INACTIVE_USER", message="User account is deactivated.", status_code=403)

    # JWT additional claims
    effective_role = "sales_manager" if (user.role == "sales" and user.is_manager) else user.role
    from backend.app.models.models import Plant
    plant_name = "ROXXCON RMC NAGPUR"
    if user.plant_id:
        p = Plant.query.get(user.plant_id)
        if p:
            plant_name = p.name
    else:
        if user.email in ["owner@rmc.test", "sales@rmc.test", "salesmanager@rmc.test", "dispatcher@rmc.test", "production@rmc.test", "qa@rmc.test", "store@rmc.test", "account@rmc.test", "supervisor@rmc.test", "customer1@rmc.test"]:
            p = Plant.query.filter_by(name="ROXXCON RMC NAGPUR").first() or Plant.query.first()
            if p:
                plant_name = p.name
                user.plant_id = p.id
                db.session.commit()
        else:
            import uuid
            p = Plant(
                id=str(uuid.uuid4()).replace("-", ""),
                name=f"{user.name} Ready Mix",
                city="India",
                address=f"{user.name} Industrial Facility",
                gstin="27AAAPA" + str(uuid.uuid4())[:4].upper() + "1Z9",
                phone=user.phone or "+91 98765 43210",
                email=user.email,
                capacity="60 cum/hr",
                scada_type="CRB-75"
            )
            db.session.add(p)
            user.plant_id = p.id
            plant_name = p.name
            db.session.commit()

    additional_claims = {
        "role": effective_role,
        "base_role": user.role,
        "is_manager": user.is_manager,
        "customer_id": user.customer_id,
        "name": user.name,
        "email": user.email,
        "plant": plant_name,
        "plant_id": user.plant_id
    }

    token = create_access_token(identity=user.id, additional_claims=additional_claims)
    return success_response(data={
        "token": token,
        "user": user.to_dict()
    })

@auth_bp.route("/organizations", methods=["GET"])
def list_organizations():
    from backend.app.models.models import Plant
    plants = Plant.query.order_by(Plant.created_at.asc()).all()
    res = []
    for p in plants:
        res.append({
            "id": p.id,
            "name": p.name,
            "city": p.city or "India",
            "capacity": p.capacity or "60 cum/hr",
            "scada": p.scada_type or "CRB-75"
        })
    return success_response(data=res)

@auth_bp.route("/register-organization", methods=["POST"])
def register_organization():
    data = request.get_json() or {}
    org_name = data.get("organization_name", "").strip() or data.get("plant_name", "").strip()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    phone = data.get("phone", "").strip()
    city = data.get("city", "").strip()
    capacity = data.get("capacity", "60 cum/hr").strip()
    scada_type = data.get("scada_type", "CRB-75").strip()
    role = data.get("role", "owner").strip().lower()

    if not org_name:
        return error_response(code="VALIDATION_ERROR", message="Organization / Plant name is required.", status_code=400)
    if not name:
        return error_response(code="VALIDATION_ERROR", message="Administrator full name is required.", status_code=400)
    if not email or "@" not in email:
        return error_response(code="VALIDATION_ERROR", message="Valid official business email is required.", status_code=400)
    if not password or len(password) < 6:
        return error_response(code="VALIDATION_ERROR", message="Password must be at least 6 characters.", status_code=400)

    # Check if user already exists
    existing = User.query.filter_by(email=email).first()
    if existing:
        return error_response(code="EMAIL_EXISTS", message="An account with this email already exists. Please sign in.", status_code=400)

    import uuid
    from backend.app.models.models import Plant, Material, WeighbridgeSettings

    new_plant_id = str(uuid.uuid4()).replace("-", "")
    new_plant = Plant(
        id=new_plant_id,
        name=org_name,
        city=city or "Nagpur, India",
        address=f"{city}, India" if city else f"{org_name} Industrial Campus",
        gstin="27AAAPA" + str(uuid.uuid4())[:4].upper() + "1Z9",
        phone=phone or "+91 98765 43210",
        email=email,
        capacity=capacity,
        scada_type=scada_type
    )
    db.session.add(new_plant)

    new_user = User(
        name=name,
        email=email,
        phone=phone,
        role=role if role in ["owner", "sales", "dispatcher", "production", "qa", "store", "account"] else "owner",
        is_manager=True,
        plant_id=new_plant_id,
        is_active=True
    )
    new_user.set_password(password)
    db.session.add(new_user)

    # Seed isolated starter materials for this specific plant with 0 stock
    starter_materials = [
        ("Cement (OPC 53)", "kg", 50000, 3.15),
        ("Fly Ash (Class F)", "kg", 30000, 2.20),
        ("River Sand (Zone II)", "kg", 80000, 2.65),
        ("Manufactured Sand (M-Sand)", "kg", 50000, 2.60),
        ("Aggregate 10mm", "kg", 60000, 2.70),
        ("Aggregate 20mm", "kg", 90000, 2.70),
        ("Water", "l", 50000, 1.00),
        ("Admixture (PCE)", "l", 800, 1.08),
        ("Diesel", "l", 2000, 0.85),
    ]
    for m_name, unit, reorder, density in starter_materials:
        mat = Material(
            name=m_name,
            unit=unit,
            current_stock=0.0,
            reorder_level=reorder,
            density=density,
            is_tracked=True if m_name != "Water" else False,
            is_active=True,
            plant_id=new_plant_id
        )
        db.session.add(mat)

    wb_settings = WeighbridgeSettings(
        plant_id=new_plant_id,
        plant_name=org_name,
        wb_name=f"{org_name} WB-01"
    )
    db.session.add(wb_settings)
    db.session.commit()

    additional_claims = {
        "role": new_user.role,
        "base_role": new_user.role,
        "is_manager": new_user.is_manager,
        "customer_id": None,
        "name": new_user.name,
        "email": new_user.email,
        "plant": new_plant.name,
        "plant_id": new_plant.id
    }
    token = create_access_token(identity=new_user.id, additional_claims=additional_claims)

    return success_response(data={
        "token": token,
        "user": new_user.to_dict(),
        "message": f"Organization '{org_name}' successfully provisioned."
    }, status_code=201)

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response(code="NOT_FOUND", message="User not found.", status_code=404)
    return success_response(data=user.to_dict())

@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response(code="NOT_FOUND", message="User not found.", status_code=404)

    data = request.get_json() or {}
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    if not user.check_password(old_password):
        return error_response(code="INVALID_PASSWORD", message="Current password incorrect.", status_code=400)

    if len(new_password) < 6:
        return error_response(code="WEAK_PASSWORD", message="New password must be at least 6 characters.", status_code=400)

    user.set_password(new_password)
    db.session.commit()
    return success_response(data={"message": "Password changed successfully."})
