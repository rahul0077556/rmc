from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, make_response, Response
from flask_jwt_extended import jwt_required
from backend.app.services.report_service import ReportService
from backend.app.utils.responses import success_response, error_response
from backend.app.utils.decorators import roles_required, get_scoped_plant_id
from backend.app.models.models import Plant

reports_bp = Blueprint("reports", __name__, url_prefix="/api/v1/reports")

@reports_bp.route("", methods=["GET"])
@jwt_required()
@roles_required()
def list_reports_registry():
    registry = ReportService.get_registry()
    return success_response(data=registry)

@reports_bp.route("/<key>", methods=["GET"])
@jwt_required()
@roles_required()
def get_report(key):
    from_date_str = request.args.get("from")
    to_date_str = request.args.get("to")
    fmt = request.args.get("format", "json").lower()

    now = datetime.now(timezone.utc)
    if from_date_str:
        try:
            from_date = datetime.strptime(from_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            from_date = now - timedelta(days=30)
    else:
        from_date = now - timedelta(days=30)

    if to_date_str:
        try:
            to_date = datetime.strptime(to_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except Exception:
            to_date = now + timedelta(days=1)
    else:
        to_date = now + timedelta(days=1)

    scoped_plant = request.args.get("plant_id") or get_scoped_plant_id()
    plant = Plant.query.get(scoped_plant) if scoped_plant else None
    plant_name = plant.name if plant else "ROXXCON RMC NAGPUR"
    plant_city = plant.city if plant and plant.city else "Nagpur"

    cols, rows = ReportService.generate_report(
        key, from_date, to_date, plant_id=scoped_plant, plant_name=plant_name, plant_city=plant_city
    )

    if fmt == "csv":
        csv_data = ReportService.to_csv(cols, rows)
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={key}_{from_date.strftime('%Y%m%d')}_{to_date.strftime('%Y%m%d')}.csv"}
        )

    elif fmt in ["xlsx", "excel"]:
        xlsx_bytes = ReportService.to_excel(
            key.replace("_", " "), cols, rows,
            plant_name=plant_name, plant_city=plant_city,
            from_date=from_date, to_date=to_date
        )
        response = make_response(xlsx_bytes)
        response.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        response.headers["Content-Disposition"] = f"attachment; filename={key}_{from_date.strftime('%Y%m%d')}_{to_date.strftime('%Y%m%d')}.xlsx"
        return response

    elif fmt == "pdf":
        from backend.app.services.pdf_service import PdfService
        from flask_jwt_extended import get_jwt
        try:
            claims = get_jwt() or {}
            user_name = claims.get("name") or "Authorized Plant Officer"
        except Exception:
            user_name = "Authorized Plant Officer"

        pdf_bytes = PdfService.generate_report_pdf(
            key.replace("_", " "), cols, rows,
            plant_name=plant_name, plant_city=plant_city,
            from_date=from_date, to_date=to_date,
            user_name=user_name
        )
        response = make_response(pdf_bytes)
        response.headers["Content-Type"] = "application/pdf"
        response.headers["Content-Disposition"] = f"attachment; filename={key}_{from_date.strftime('%Y%m%d')}_{to_date.strftime('%Y%m%d')}.pdf"
        return response

    else:
        # Default JSON format
        return success_response(data={
            "key": key,
            "columns": cols,
            "rows": rows,
            "totalRows": len(rows),
            "from": from_date.strftime("%Y-%m-%d"),
            "to": to_date.strftime("%Y-%m-%d"),
            "plantName": plant_name,
            "plantCity": plant_city
        })
