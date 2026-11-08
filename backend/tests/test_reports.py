import io
from datetime import datetime, timezone, timedelta
import openpyxl
from backend.app.extensions import db
from backend.app.models.models import Plant, Material, Customer, Invoice, Payment, Grade
from backend.app.services.report_service import ReportService
from backend.tests.conftest import login

def test_reports_registry(client):
    owner_token = login(client, "owner@rmc.test")
    res = client.get("/api/v1/reports", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert len(data) >= 16
    keys = [r["key"] for r in data]
    assert "mpr_report" in keys
    assert "weighbridge_inward" in keys
    assert "customer_outstanding" in keys
    assert "concrete_margins" in keys
    assert "tm_average_report" in keys
    assert "strength_data_since" in keys

def test_mpr_report_deduplication(client):
    owner_token = login(client, "owner@rmc.test")
    from_date = datetime.now(timezone.utc) - timedelta(days=30)
    to_date = datetime.now(timezone.utc) + timedelta(days=1)

    plant = Plant.query.filter_by(name="ROXXCON RMC NAGPUR").first() or Plant.query.first()
    cols, rows = ReportService.generate_report(
        "mpr_report", from_date, to_date, plant_id=plant.id, plant_name=plant.name, plant_city=plant.city
    )
    assert len(cols) == 14
    assert cols[0] == "S.No"
    assert cols[1] == "Material Description"

    # Verify no duplicate material names in rows
    material_names = [r[1] for r in rows]
    assert len(material_names) == len(set(material_names)), f"Duplicates found in MPR: {material_names}"

    # Also test via HTTP API endpoint
    res = client.get("/api/v1/reports/mpr_report", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    json_data = res.get_json()["data"]
    assert json_data["plantName"] == (plant.name if plant else "ROXXCON RMC NAGPUR")
    assert len(json_data["rows"]) == len(set(r[1] for r in json_data["rows"]))

def test_customer_outstanding_report(client):
    owner_token = login(client, "owner@rmc.test")
    res = client.get("/api/v1/reports/customer_outstanding", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    json_data = res.get_json()["data"]
    assert "Customer Name" in json_data["columns"]
    assert "Outstanding Balance (₹)" in json_data["columns"]
    assert len(json_data["rows"]) > 0

def test_concrete_margins_report(client):
    owner_token = login(client, "owner@rmc.test")
    res = client.get("/api/v1/reports/concrete_margins", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    json_data = res.get_json()["data"]
    assert "Grade" in json_data["columns"]
    assert "Gross Margin / m³ (₹)" in json_data["columns"]
    assert len(json_data["rows"]) > 0

def test_weighbridge_inward_audit_report(client):
    owner_token = login(client, "owner@rmc.test")
    res = client.get("/api/v1/reports/weighbridge_inward", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    json_data = res.get_json()["data"]
    assert "Ticket No" in json_data["columns"]
    assert "Weight Variance (MT)" in json_data["columns"]
    assert len(json_data["rows"]) > 0

def test_excel_export_plant_dynamic_title(client):
    owner_token = login(client, "owner@rmc.test")
    res = client.get("/api/v1/reports/mpr_report?format=xlsx", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in res.headers["Content-Type"]

    # Parse exported Excel workbook
    wb = openpyxl.load_workbook(io.BytesIO(res.data))
    ws = wb.active
    banner_val = ws["A1"].value
    assert "MULKHED" not in banner_val
    plant = Plant.query.filter_by(name="ROXXCON RMC NAGPUR").first() or Plant.query.first()
    assert (plant.name.upper() in banner_val) or ("PLANT" in banner_val)
