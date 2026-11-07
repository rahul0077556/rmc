from datetime import datetime, timezone, timedelta
from backend.app.extensions import db
from backend.app.models.models import PurchaseOrder, Trip, BatchSheet, Truck, Driver, Customer, Site, Grade
from backend.tests.conftest import login

def test_owner_read_only_enforcement(client):
    owner_token = login(client, "owner@rmc.test")
    headers = {"Authorization": f"Bearer {owner_token}"}

    # GET is allowed
    res = client.get("/api/v1/dashboard/owner-summary", headers=headers)
    assert res.status_code == 200

    # Non-GET (POST, PUT, DELETE) is rejected with 403 Forbidden
    res = client.post("/api/v1/customers", json={"name": "Illegal"}, headers=headers)
    assert res.status_code == 403
    assert res.get_json()["error"]["code"] == "FORBIDDEN_READ_ONLY"

def test_customer_data_isolation(client):
    c1_token = login(client, "customer1@rmc.test")
    c2_token = login(client, "customer2@rmc.test")

    # Sales creates an order for Customer A
    sales_token = login(client, "sales@rmc.test")
    cust1 = Customer.query.filter_by(email="c1@test.com").first()
    site1 = Site.query.filter_by(customer_id=cust1.id).first()
    grade = Grade.query.first()

    future_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
    po_res = client.post("/api/v1/purchase-orders", json={
        "customerId": cust1.id,
        "siteId": site1.id,
        "gradeId": grade.id,
        "quantity": 16.0,
        "deliveryDate": future_date,
        "deliveryTime": "10:00",
        "purpose": "Slab"
    }, headers={"Authorization": f"Bearer {sales_token}"})
    assert po_res.status_code == 201
    po_id = po_res.get_json()["data"]["id"]

    # Customer 1 can see their own order
    res1 = client.get(f"/api/v1/my/orders/{po_id}/tracking", headers={"Authorization": f"Bearer {c1_token}"})
    assert res1.status_code == 200

    # Customer 2 attempting to view Customer 1's order is refused with 403
    res2 = client.get(f"/api/v1/my/orders/{po_id}/tracking", headers={"Authorization": f"Bearer {c2_token}"})
    assert res2.status_code == 403

def test_po_balance_and_trip_capacity_rules(client):
    sales_token = login(client, "sales@rmc.test")
    mgr_token = login(client, "salesmanager@rmc.test")
    disp_token = login(client, "dispatcher@rmc.test")

    cust = Customer.query.first()
    site = Site.query.filter_by(customer_id=cust.id).first()
    grade = Grade.query.first()

    future_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
    # Create PO of 10 cum
    po_res = client.post("/api/v1/purchase-orders", json={
        "customerId": cust.id,
        "siteId": site.id,
        "gradeId": grade.id,
        "quantity": 10.0,
        "deliveryDate": future_date,
        "deliveryTime": "10:00",
        "purpose": "Column"
    }, headers={"Authorization": f"Bearer {sales_token}"})
    po_id = po_res.get_json()["data"]["id"]

    # Submit and Approve
    client.post(f"/api/v1/purchase-orders/{po_id}/submit", headers={"Authorization": f"Bearer {sales_token}"})
    client.post(f"/api/v1/purchase-orders/{po_id}/approve", json={"remarks": "Approved"}, headers={"Authorization": f"Bearer {mgr_token}"})

    truck_8cum = Truck.query.filter_by(capacity_cum=8).first()
    truck_5cum = Truck.query.filter_by(capacity_cum=5).first()
    driver = Driver.query.first()

    # Trip quantity > TM capacity must be rejected (e.g. 7 cum in a 5 cum truck)
    res_cap = client.post("/api/v1/trips", json={
        "poId": po_id,
        "quantity": 7.0,
        "tmId": truck_5cum.id,
        "driverId": driver.id
    }, headers={"Authorization": f"Bearer {disp_token}"})
    assert res_cap.status_code == 409
    assert res_cap.get_json()["error"]["code"] == "EXCEEDS_CAPACITY"

    # Trip 1 of 8 cum in 8 cum truck is allowed
    res_t1 = client.post("/api/v1/trips", json={
        "poId": po_id,
        "quantity": 8.0,
        "tmId": truck_8cum.id,
        "driverId": driver.id
    }, headers={"Authorization": f"Bearer {disp_token}"})
    assert res_t1.status_code == 201

    # Trip 2 of 4 cum exceeds the remaining balance (10 - 8 = 2 cum balance)
    res_bal = client.post("/api/v1/trips", json={
        "poId": po_id,
        "quantity": 4.0,
        "tmId": truck_5cum.id,
        "driverId": driver.id
    }, headers={"Authorization": f"Bearer {disp_token}"})
    assert res_bal.status_code == 409
    assert res_bal.get_json()["error"]["code"] == "EXCEEDS_BALANCE"

def test_release_strictly_requires_qc_approval(client):
    sales_token = login(client, "sales@rmc.test")
    mgr_token = login(client, "salesmanager@rmc.test")
    disp_token = login(client, "dispatcher@rmc.test")

    cust = Customer.query.first()
    site = Site.query.filter_by(customer_id=cust.id).first()
    grade = Grade.query.first()

    future_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
    po_res = client.post("/api/v1/purchase-orders", json={
        "customerId": cust.id,
        "siteId": site.id,
        "gradeId": grade.id,
        "quantity": 6.0,
        "deliveryDate": future_date,
        "deliveryTime": "11:00",
        "purpose": "Footing"
    }, headers={"Authorization": f"Bearer {sales_token}"})
    po_id = po_res.get_json()["data"]["id"]

    client.post(f"/api/v1/purchase-orders/{po_id}/submit", headers={"Authorization": f"Bearer {sales_token}"})
    client.post(f"/api/v1/purchase-orders/{po_id}/approve", headers={"Authorization": f"Bearer {mgr_token}"})

    truck = Truck.query.filter_by(capacity_cum=8).first()
    driver = Driver.query.first()

    trip_res = client.post("/api/v1/trips", json={
        "poId": po_id,
        "quantity": 6.0,
        "tmId": truck.id,
        "driverId": driver.id
    }, headers={"Authorization": f"Bearer {disp_token}"})
    assert trip_res.status_code == 201, f"trip_res failed with {trip_res.status_code}: {trip_res.get_json()}"
    trip_id = trip_res.get_json()["data"]["id"]

    # Attempt to release trip while in PLANNED / before QC approval MUST FAIL with 409
    rel_res = client.post(f"/api/v1/trips/{trip_id}/release", headers={"Authorization": f"Bearer {disp_token}"})
    assert rel_res.status_code == 409
    assert "QC" in rel_res.get_json()["error"]["message"]

def test_invoice_and_payment_math(client):
    disp_token = login(client, "dispatcher@rmc.test")
    cust = Customer.query.first()
    site = Site.query.filter_by(customer_id=cust.id).first()
    grade = Grade.query.first()

    # Create a delivered PO and trip
    po = PurchaseOrder(
        po_number="PO-MATH-01",
        customer_id=cust.id,
        site_id=site.id,
        grade_id=grade.id,
        quantity_cum=8.0,
        rate_per_cum=4000.0,
        delivery_datetime=datetime.now(timezone.utc),
        purpose="Slab",
        status="IN_PROGRESS"
    )
    db.session.add(po)
    db.session.flush()

    trip = Trip(
        trip_number="TRIP-MATH-01",
        po_id=po.id,
        sequence=1,
        quantity_cum=8.0,
        planned_datetime=datetime.now(timezone.utc),
        status="DELIVERED",
        delivered_quantity=8.0
    )
    db.session.add(trip)
    db.session.commit()

    # Create invoice: 8 cum * 4000 = 32,000 subtotal, 18% GST = 5,760, total = 37,760
    inv_res = client.post("/api/v1/invoices", json={"poId": po.id, "gstPercent": 18.0}, headers={"Authorization": f"Bearer {disp_token}"})
    assert inv_res.status_code == 201
    inv_data = inv_res.get_json()["data"]
    assert inv_data["subtotal"] == 32000.0
    assert inv_data["total"] == 37760.0
    assert inv_data["outstandingAmount"] == 37760.0
    inv_id = inv_data["id"]

    # Payment exceeding outstanding balance is rejected
    pay_fail = client.post(f"/api/v1/invoices/{inv_id}/payments", json={"amount": 40000.0}, headers={"Authorization": f"Bearer {disp_token}"})
    assert pay_fail.status_code == 409
    assert pay_fail.get_json()["error"]["code"] == "EXCEEDS_OUTSTANDING"

    # Partial payment of 20,000
    pay_part = client.post(f"/api/v1/invoices/{inv_id}/payments", json={"amount": 20000.0, "mode": "NEFT", "reference": "REF1"}, headers={"Authorization": f"Bearer {disp_token}"})
    assert pay_part.status_code == 200
    assert pay_part.get_json()["data"]["status"] == "PARTIALLY_PAID"
    assert pay_part.get_json()["data"]["outstandingAmount"] == 17760.0

def test_site_supervisor_flow_and_trip_retrieval(client):
    sup_token = login(client, "supervisor@rmc.test")
    headers = {"Authorization": f"Bearer {sup_token}"}

    cust = Customer.query.first()
    site = Site.query.filter_by(customer_id=cust.id).first()
    grade = Grade.query.first()

    po = PurchaseOrder(
        po_number="PO-SUP-01",
        customer_id=cust.id,
        site_id=site.id,
        grade_id=grade.id,
        quantity_cum=6.0,
        rate_per_cum=4500.0,
        delivery_datetime=datetime.now(timezone.utc),
        purpose="Column",
        status="IN_PROGRESS"
    )
    db.session.add(po)
    db.session.flush()

    trip = Trip(
        trip_number="TRIP-SUP-01",
        po_id=po.id,
        sequence=1,
        quantity_cum=6.0,
        planned_datetime=datetime.now(timezone.utc),
        status="IN_TRANSIT"
    )
    db.session.add(trip)
    db.session.commit()

    # GET /trips/<id> works cleanly
    res_get = client.get(f"/api/v1/trips/{trip.id}", headers=headers)
    assert res_get.status_code == 200
    data = res_get.get_json()["data"]
    assert data["tripNumber"] == "TRIP-SUP-01"

    # TM Arrival
    res_arr = client.post(f"/api/v1/trips/{trip.id}/arrive", json={"notes": "Reached site Gate 2"}, headers=headers)
    assert res_arr.status_code == 200
    assert "Reached site Gate 2" in res_arr.get_json()["data"]["notes"]

    # Issue Reporting
    res_issue = client.post(f"/api/v1/trips/{trip.id}/report-issue", json={"issueType": "PUMP_PROBLEM", "details": "Pipe choked near 3rd floor"}, headers=headers)
    assert res_issue.status_code == 200
    assert "Pipe choked near 3rd floor" in res_issue.get_json()["data"]["notes"]

    # Unload and deliver
    res_deliv = client.post(f"/api/v1/trips/{trip.id}/deliver", json={"deliveredQuantity": 6.0, "receiverName": "Site Eng. Sharma", "notes": "Cube casted"}, headers=headers)
    assert res_deliv.status_code == 200
    assert res_deliv.get_json()["data"]["status"] == "DELIVERED"

def test_register_organization_and_plant_accounts(client):
    # 1. Register a brand-new plant organization
    reg_payload = {
        "organization_name": "Shree Sai ReadyMix Infra",
        "city": "Nashik, Maharashtra",
        "name": "Narendra Patil",
        "email": "patil@shreesai.test",
        "password": "Password@123",
        "phone": "+91 94220 55667",
        "capacity": "90 cum/hr",
        "scada_type": "Schwing Stetter"
    }
    reg_res = client.post("/api/v1/auth/register-organization", json=reg_payload)
    assert reg_res.status_code == 201
    res_json = reg_res.get_json()["data"]
    new_plant_id = res_json["user"]["plant_id"]
    assert new_plant_id is not None
    assert res_json["user"]["email"] == "patil@shreesai.test"

    # 2. Check plant accounts endpoint returns isolated sub-logins for this plant
    acc_res = client.get(f"/api/v1/auth/plant-accounts?plant_id={new_plant_id}")
    assert acc_res.status_code == 200
    accounts = acc_res.get_json()["data"]
    assert len(accounts) == 10
    roles = [a["role"] for a in accounts]
    assert "owner" in roles
    assert "sales" in roles
    assert "dispatcher" in roles
    assert "production" in roles
    assert "qa" in roles
    assert "store" in roles
    assert "account" in roles

    # 3. Verify 4 dedicated customers and materials with inwarded stock were provisioned
    from backend.app.models.models import Customer, Material, Truck, Driver
    plant_customers = Customer.query.filter_by(plant_id=new_plant_id).all()
    assert len(plant_customers) == 4

    plant_materials = Material.query.filter_by(plant_id=new_plant_id).all()
    assert len(plant_materials) >= 8
    opc = [m for m in plant_materials if "Cement" in m.name][0]
    assert opc.current_stock > 0

    plant_trucks = Truck.query.filter_by(plant_id=new_plant_id).all()
    assert len(plant_trucks) >= 4


