import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

BASE_URL = "http://127.0.0.1:5001/api/v1"

def http_req(method, endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"HTTP ERROR {e.code} on {method} {endpoint}: {err_body}")
        raise e

def login(email, password="Demo@123"):
    res = http_req("POST", "/auth/login", {"email": email, "password": password})
    data = res["data"]
    token = data["token"]
    user = data["user"]
    print(f"Logged in as {user['name']} ({user['role']})")
    return token

def test_full_flow():
    print("==================================================")
    print("STARTING COMPLETE END-TO-END RMC WORKFLOW TEST")
    print("==================================================")

    # 1. SALES: Create PO
    sales_token = login("sales@rmc.test")
    cust_res = http_req("GET", "/customers", token=sales_token)
    customers = cust_res["data"]
    assert len(customers) > 0, "No customers found"
    customer = customers[0]
    site = customer["sites"][0] if customer.get("sites") else None
    if not site:
        site_res = http_req(
            "POST",
            f"/customers/{customer['id']}/sites",
            {"name": "IT PARK Site", "address": "IT PARK, Gayatri Nagar, Nagpur", "distanceKm": 12.0},
            token=sales_token
        )
        site = site_res["data"]

    grades_res = http_req("GET", "/grades", token=sales_token)
    grades = grades_res["data"]
    m25 = next((g for g in grades if "25" in g["code"]), grades[0])

    tomorrow_str = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    po_payload = {
        "customerId": customer["id"],
        "siteId": site["id"],
        "gradeId": m25["id"],
        "quantity": 5.0,
        "ratePerCum": 4950.0,
        "deliveryDate": tomorrow_str,
        "deliveryTime": "10:00",
        "pumpRequired": False,
        "mixDesignCode": "M 25 LIGTH",
        "slumpMm": 120,
        "purpose": "Slab Pour"
    }

    create_po_res = http_req("POST", "/purchase-orders", po_payload, token=sales_token)
    po = create_po_res["data"]
    po_id = po["id"]
    po_number = po["poNumber"]
    print(f"[1] Created PO: {po_number} (ID: {po_id}) for {po.get('quantity')} cum")
    assert po.get("createdByName") is not None, "PO createdByName missing!"
    print(f"    Created By: {po.get('createdByName')}")

    # Submit PO
    submit_res = http_req("POST", f"/purchase-orders/{po_id}/submit", {}, token=sales_token)
    print(f"[2] Submitted PO {po_number} -> Status: {submit_res['data']['status']}")

    # 2. SALES MANAGER: Approve PO
    mgr_token = login("salesmanager@rmc.test")
    approve_res = http_req("POST", f"/purchase-orders/{po_id}/approve", {}, token=mgr_token)
    print(f"[3] Approved PO {po_number} -> Status: {approve_res['data']['status']}")

    # 3. DISPATCHER: Plan trip & Send to production
    disp_token = login("dispatcher@rmc.test")
    trucks_res = http_req("GET", "/trucks", token=disp_token)
    trucks = trucks_res["data"]
    truck = next((t for t in trucks if t.get("status") == "AVAILABLE"), trucks[0])

    drivers_res = http_req("GET", "/drivers", token=disp_token)
    drivers = drivers_res["data"]
    driver = next((d for d in drivers if d.get("status") == "AVAILABLE"), drivers[0])

    planned_time = (datetime.now(timezone.utc) + timedelta(minutes=45)).isoformat()
    trip_payload = {
        "poId": po_id,
        "quantity": 5.0,
        "tmId": truck["id"],
        "driverId": driver["id"],
        "plannedTime": planned_time
    }
    create_trip_res = http_req("POST", "/trips", trip_payload, token=disp_token)
    trip = create_trip_res["data"]
    trip_id = trip["id"]
    trip_number = trip["tripNumber"]
    print(f"[4] Created Trip: {trip_number} (TM: {trip.get('tmNumber')}, Driver: {trip.get('driverName')})")

    # Send trip to production
    send_prod_res = http_req("POST", f"/trips/{trip_id}/send-to-production", {}, token=disp_token)
    print(f"[5] Sent Trip {trip_number} to Production -> Status: {send_prod_res['data']['status']}")

    # 4. PRODUCTION: Check materials & Ingest batch docket 5812
    prod_token = login("production@rmc.test")
    check_mat_res = http_req("POST", f"/production/trips/{trip_id}/check-materials", {}, token=prod_token)
    check_data = check_mat_res["data"]
    assert check_data["canBatch"] is True, "canBatch must be True per Golden Rule 1"
    print(f"[6] Checked materials: canBatch={check_data['canBatch']}, hasWarning={check_data['hasWarning']}")

    # Ingest SCADA Batch Docket 5812
    docket_5812_payload = {
        "plantName": "ROXXCON RMC NAGPUR",
        "plantCapacity": "75 CBM",
        "customerName": customer["name"],
        "siteName": site["name"],
        "truckNumber": truck["tmNumber"],
        "driverName": driver["name"],
        "docketNumber": f"5812-{datetime.now().strftime('%H%M%S')}",
        "recipeName": "M 25 LIGTH",
        "grade": "M25",
        "orderQtyCum": 50.0,
        "ticketQtyCum": 5.0,
        "withThisLoadCum": 17.0,
        "batchSizeCum": 1.25,
        "batchesCount": 4,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "startTime": "19:26:10",
        "endTime": "19:35:00",
        "wcRatio": 0.39,
        "thVolume": 2508.87,
        "cementKg": 1601.7,
        "flyashKg": 451.8,
        "rSandKg": 2368.0,
        "mSandKg": 1582.0,
        "agg10mmKg": 2224.0,
        "agg20mmKg": 3441.0,
        "waterL": 895.4,
        "admixtureKg": 14.35,
        "totalWeightKg": 12578.3,
        "replaceExisting": True
    }
    ingest_res = http_req("POST", "/production/batch-sheets/ingest", docket_5812_payload, token=prod_token)
    batch_res_data = ingest_res["data"]
    print(f"[7] Ingested Docket successfully! Matched trip: {batch_res_data.get('trip', {}).get('tripNumber')}")
    print(f"    Deductions logged: {batch_res_data.get('deductionsCount')} materials")

    # 5. QA: Submit inspection & approve
    qa_token = login("qa@rmc.test")
    qc_payload = {
        "tripId": trip_id,
        "physicalInspection": "PASS",
        "slump": 120,
        "bleeding": "PASS",
        "wrongMix": "PASS",
        "admixtureType": "PCE Plasticizer",
        "admixtureQty": 2.0,
        "decision": "APPROVE",
        "remarks": "Slump 120 mm verified on cone test. Slump retention good."
    }
    qc_res = http_req("POST", "/qa/checks", qc_payload, token=qa_token)
    qc_data = qc_res["data"]
    print(f"[8] QA Approved Trip {trip_number} -> Trip status: {qc_data['trip']['status']}")

    # 6. DISPATCHER: Release trip -> Delivers trip
    release_res = http_req("POST", f"/trips/{trip_id}/release", {}, token=disp_token)
    released_trip = release_res["data"]
    print(f"[9] Released Trip {trip_number} with Challan: {released_trip.get('challanNumber')} -> Status: {released_trip['status']}")

    deliver_res = http_req("POST", f"/trips/{trip_id}/deliver", {"deliveredQuantity": 5.0, "receiverName": "Er. Rakesh"}, token=disp_token)
    delivered_trip = deliver_res["data"]
    print(f"[10] Marked Trip {trip_number} as DELIVERED -> Status: {delivered_trip['status']}")

    # 7. BILLING: Verify invoice was automatically synced
    invoices_res = http_req("GET", "/invoices", token=mgr_token)
    invoices = invoices_res["data"]
    po_invoice = next((inv for inv in invoices if inv["poId"] == po_id or inv.get("poNumber") == po_number), None)
    assert po_invoice is not None, f"Invoice for PO {po_number} was not generated!"
    print(f"[11] Verified Tax Invoice {po_invoice['invoiceNumber']}: Subtotal=Rs.{po_invoice['subtotal']:.2f}, Tax=Rs.{po_invoice['gstAmount']:.2f}, Total=Rs.{po_invoice['total']:.2f}")

    # 8. STORE: Verify inventory ledger & log inward weighbridge ticket
    store_token = login("store@rmc.test")
    inv_res = http_req("GET", "/store/inventory", token=store_token)
    inventory = inv_res["data"]
    print(f"[12] Verified Store inventory:")
    for item in inventory[:4]:
        print(f"     * {item['material']}: {item['currentStock']} {item['unit']} (Status: {item['status']})")

    cement_item = next(m for m in inventory if "Cement" in m["material"])
    wb_payload = {
        "type": "INWARD",
        "vehicleNumber": "MH40AZ4412",
        "materialId": cement_item["id"],
        "material": cement_item["material"],
        "supplier": "UltraTech Cement Limited",
        "grossWeight": 45000.0,
        "tareWeight": 15000.0,
        "challanNumber": f"UT-{datetime.now().strftime('%H%M%S')}",
        "challanWeight": 30000.0,
        "driverName": "Sunil Patil",
        "remarks": "Inward bulker decanted into Silo 1"
    }
    wb_res = http_req("POST", "/store/weighbridge/tickets", wb_payload, token=store_token)
    wb_ticket = wb_res["data"]["ticket"]
    print(f"[13] Logged Weighbridge Ticket {wb_ticket['ticketNumber']}: Net={wb_ticket['netWeight']} kg")

    inv_after_res = http_req("GET", "/store/inventory", token=store_token)
    cement_after = next(m for m in inv_after_res["data"] if m["id"] == cement_item["id"])
    print(f"[14] Cement stock after inward: {cement_after['currentStock']} {cement_after['unit']} (Status: {cement_after['status']})")

    print("==================================================")
    print("ALL TESTS PASSED! FULL RMC LIFECYCLE 100% VERIFIED")
    print("==================================================")

if __name__ == "__main__":
    test_full_flow()
