from typing import Any, Optional, Dict
from flask import jsonify

def success_response(data: Any, meta: Optional[Dict[str, Any]] = None, status_code: int = 200):
    payload = {"data": data}
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status_code

def error_response(code: str, message: str, fields: Optional[Dict[str, Any]] = None, status_code: int = 400):
    payload = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if fields:
        payload["error"]["fields"] = fields
    return jsonify(payload), status_code
