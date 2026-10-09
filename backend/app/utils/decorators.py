from functools import wraps
from flask import request
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity
from backend.app.utils.responses import error_response

def roles_required(*allowed_roles):
    """
    Decorator to enforce role permissions on API endpoints.
    - Owner role is strictly read-only (reject non-GET with 403).
    - If 'sales_manager' is in allowed_roles, users with role='sales' and is_manager=True are accepted.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role")
            is_manager = claims.get("is_manager", False)
            
            # Enforce owner read-only rule globally
            if user_role == "owner" and request.method not in ["GET", "HEAD", "OPTIONS"]:
                return error_response(
                    code="FORBIDDEN_READ_ONLY",
                    message="Owner role is strictly read-only.",
                    status_code=403
                )
                
            # If specific roles are specified, verify match
            if allowed_roles:
                matched = False
                for role in allowed_roles:
                    if role == "sales_manager":
                        if user_role == "sales_manager" or (user_role == "sales" and is_manager):
                            matched = True
                            break
                    elif role == "sales":
                        if user_role == "sales":
                            matched = True
                            break
                    elif user_role == role:
                        matched = True
                        break
                        
                if not matched:
                    return error_response(
                        code="FORBIDDEN_ROLE",
                        message=f"Access denied for role '{user_role}'. Required one of: {list(allowed_roles)}",
                        status_code=403
                    )
                    
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def get_current_user_claims():
    verify_jwt_in_request()
    return get_jwt()

def get_current_user_id():
    verify_jwt_in_request()
    return get_jwt_identity()

def get_scoped_customer_id():
    """
    Returns customer_id if current user is role 'customer', otherwise None.
    """
    verify_jwt_in_request()
    claims = get_jwt()
    if claims.get("role") == "customer":
        return claims.get("customer_id")
    return None
