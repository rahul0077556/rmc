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
    additional_claims = {
        "role": effective_role,
        "base_role": user.role,
        "is_manager": user.is_manager,
        "customer_id": user.customer_id,
        "name": user.name,
        "email": user.email,
        "plant": "Apex Ready-Mix Plant"
    }

    token = create_access_token(identity=user.id, additional_claims=additional_claims)
    return success_response(data={
        "token": token,
        "user": user.to_dict()
    })

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
