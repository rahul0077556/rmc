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
    if (not user or not user.check_password(password)) and email.endswith("@rmc.test") and password == "Demo@123":
        try:
            from backend.purge_dummy_data import execute_purge
            execute_purge()
            user = User.query.filter_by(email=email).first()
        except Exception:
            pass

    if not user or not user.check_password(password):
        return error_response(code="UNAUTHORIZED", message="Invalid email or password.", status_code=401)

    if not user.is_active:
        return error_response(code="INACTIVE_USER", message="User account is deactivated.", status_code=403)

    # JWT additional claims
    effective_role = "sales_manager" if (user.role == "sales" and user.is_manager) else user.role
    from backend.app.models.models import Plant
    plant_obj = Plant.query.first()
    plant_name = plant_obj.name if plant_obj else "ROXXCON RMC NAGPUR"
    additional_claims = {
        "role": effective_role,
        "base_role": user.role,
        "is_manager": user.is_manager,
        "customer_id": user.customer_id,
        "name": user.name,
        "email": user.email,
        "plant": plant_name
    }

    token = create_access_token(identity=user.id, additional_claims=additional_claims)
    return success_response(data={
        "token": token,
        "user": user.to_dict()
    })

@auth_bp.route("/register-organization", methods=["POST"])
def register_organization():
    data = request.get_json() or {}
    org_name = data.get("organization_name", "").strip() or data.get("plant_name", "").strip()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    phone = data.get("phone", "").strip()
    city = data.get("city", "").strip()
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

    from backend.app.models.models import Plant
    plant_obj = Plant.query.first()
    if not plant_obj:
        plant_obj = Plant(
            name=org_name,
            address=f"{city}, India" if city else "Industrial Area, Nagpur, India",
            gstin="27AABCR0000A1Z5",
            phone=phone or "+91 712 2554400",
            email=email
        )
        db.session.add(plant_obj)
    else:
        plant_obj.name = org_name
        if city:
            plant_obj.address = f"{city}, India"
        if phone:
            plant_obj.phone = phone
        plant_obj.email = email

    new_user = User(
        name=name,
        email=email,
        phone=phone,
        role=role if role in ["owner", "sales", "dispatcher", "production", "qa", "store", "account"] else "owner",
        is_manager=True if role in ["owner", "sales_manager"] else False,
        is_active=True
    )
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    additional_claims = {
        "role": new_user.role,
        "base_role": new_user.role,
        "is_manager": new_user.is_manager,
        "customer_id": None,
        "name": new_user.name,
        "email": new_user.email,
        "plant": plant_obj.name
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
