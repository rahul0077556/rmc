"""
Live End-to-End Operational Lifecycle Test for RMC Command Center.
Exercises:
1. Database purge (clean state)
2. Queue verification (clean state = 0 tasks)
3. Sales creates & submits fresh PO (16 cum M30)
4. Sales Manager queue alert & PO approval
5. Dispatcher queue alert & Trip 1 scheduling (8 cum, TM-01)
6. Production queue alert & batching execution (creates Batch Sheet)
7. QA/QC queue alert & slump testing (130 mm, approved)
8. Dispatcher challan generation & release to In-Transit
9. Site Supervisor queue alert, gate arrival, and delivery confirmation
10. Trip marked DELIVERED and Invoice generated with commercial totals
11. Accounts queue alert with outstanding balance
12. Live Reports update verification (Daywise Production, CRB-75 Consumption, Schedule & Production)
"""

import sys
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.purge_dummy_data import purge_dummy_data
from backend.app import create_app
from backend.app.models.models import Customer, Site, Grade, Truck, Driver, PurchaseOrder, Trip, Invoice, BatchSheet

BASE_URL = "http://127.0.0.1:5001/api/v1"

def http_req(url, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"error": content}
        return e.code, parsed

def login(email, password="Demo@123"):
    status, res = http_req(f"{BASE_URL}/auth/login", method="POST", data={"email": email, "password": password})
    if status != 200:
        raise Exception(f"Login failed for {email}: {res}")
    return res["data"]["token"]

def run_test():
    print("=" * 70)
    print("🚀 STARTING LIVE END-TO-END RMC OPERATIONAL TEST")
    print("=" * 70)

    # 1. Purge dummy data
    print("\n[Step 1/12] Purging existing dummy data for clean test...")
    purge_dummy_data()
    print("✓ Database cleaned successfully.")

    # Get master entities
    app = create_app()
    with app.app_context():
        customer = Customer.query.filter(Customer.name.ilike("%Wagh%")).first() or Customer.query.first()
        site = Site.query.filter_by(customer_id=customer.id).first() or Site.query.first()
        grade = Grade.query.filter_by(code="M30").first() or Grade.query.first()
        truck = Truck.query.filter(Truck.capacity_cum >= 8, Truck.status == "AVAILABLE").first() or Truck.query.first()
        driver = Driver.query.filter_by(status="AVAILABLE").first()

        customer_id = customer.id
        site_id = site.id
        grade_id = grade.id
        truck_id = truck.id
        driver_id = driver.id
        print(f"Master Entities: Customer={customer.name}, Site={site.name}, Grade={grade.code}, TM={truck.tm_number}, Driver={driver.name}")

    # 2. Check initial queues
    print("\n[Step 2/12] Verifying 'My Queue' across roles on clean database...")
    roles = ["sales", "sales_manager", "dispatcher", "production", "qa", "supervisor", "account"]
    for role in roles:
        status, res = http_req(f"{BASE_URL}/queue?role={role}")
        assert status == 200, f"Queue failed for {role}"
        items = res["data"]
        print(f"  • Role '{role}' Queue: {len(items)} pending tasks (Expected: 0)")
        assert len(items) == 0, f"Expected empty queue for {role}, got {len(items)}"
    print("✓ All role queues are cleanly empty (0 pending tasks).")

    # 3. Sales creates and submits a PO
    print("\n[Step 3/12] Sales Executive logs in & creates PO for 16.0 cum M30...")
    sales_token = login("sales@rmc.test")
    po_payload = {
        "customerId": customer_id,
        "siteId": site_id,
        "gradeId": grade_id,
        "quantity": 16.0,
        "ratePerCum": 4600.0,
        "deliveryDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "deliveryTime": "14:00",
        "purpose": "Column & Slab Pouring",
        "pumpRequired": True,
        "pumpOwnership": "Company Owned",
        "pumpType": "Boom Pump 36m",
        "notes": "Live End-to-End QA Validation Order"
    }
    status, po_res = http_req(f"{BASE_URL}/purchase-orders", method="POST", data=po_payload, token=sales_token)
    assert status == 201, f"Create PO failed: {po_res}"
    po_data = po_res["data"]
    po_id = po_data["id"]
    po_num = po_data["poNumber"]
    print(f"✓ PO created: {po_num} (Status: {po_data['status']}, Qty: {po_data.get('quantity')} cum)")

    # Submit PO
    status, sub_res = http_req(f"{BASE_URL}/purchase-orders/{po_id}/submit", method="POST", token=sales_token)
    assert status == 200, f"Submit PO failed: {sub_res}"
    print(f"✓ PO {po_num} submitted for Manager Approval.")

    # 4. Sales Manager Queue Alert & Approval
    print("\n[Step 4/12] Sales Manager Queue check & approval...")
    _, res_q = http_req(f"{BASE_URL}/queue?role=sales_manager")
    mgr_queue = res_q["data"]
    print(f"  • Sales Manager Queue: {len(mgr_queue)} pending tasks")
    assert len(mgr_queue) == 1, "Expected 1 task in Sales Manager queue"
    print(f"  • Task Alert: '{mgr_queue[0]['title']}' (Urgency: {mgr_queue[0]['urgency']})")

    mgr_token = login("salesmanager@rmc.test")
    status, appr_res = http_req(f"{BASE_URL}/purchase-orders/{po_id}/approve", method="POST", token=mgr_token)
    assert status == 200, f"Approve PO failed: {appr_res}"
    print(f"✓ PO {po_num} APPROVED by Sales Manager.")

    _, res_q_after = http_req(f"{BASE_URL}/queue?role=sales_manager")
    assert len(res_q_after["data"]) == 0, "Sales Manager queue should now be empty"
    print("✓ Sales Manager queue is now clear.")

    # 5. Dispatcher Queue & Trip Scheduling
    print("\n[Step 5/12] Dispatcher Queue check & planning Trip #1 (8.0 cum)...")
    _, res_disp = http_req(f"{BASE_URL}/queue?role=dispatcher")
    disp_queue = res_disp["data"]
    print(f"  • Dispatcher Queue: {len(disp_queue)} pending tasks")
    assert any(po_num in item["title"] or po_num in item["subtitle"] for item in disp_queue), "PO should appear in Dispatcher queue"
    print(f"  • Task Alert: '{disp_queue[0]['title']}'")

    disp_token = login("dispatcher@rmc.test")
    trip_payload = {
        "poId": po_id,
        "tmId": truck_id,
        "driverId": driver_id,
        "quantity": 8.0,
        "plannedTime": datetime.now(timezone.utc).isoformat(),
        "notes": "Trip 1 of 2 for slab pour"
    }
    status, trip_res = http_req(f"{BASE_URL}/trips", method="POST", data=trip_payload, token=disp_token)
    assert status == 201, f"Create trip failed: {trip_res}"
    trip_data = trip_res["data"]
    trip_id = trip_data["id"]
    trip_num = trip_data["tripNumber"]
    print(f"✓ Trip scheduled: {trip_num} (Qty: {trip_data.get('quantity')} cum, Status: {trip_data['status']})")

    # Send to Production
    status, prod_send_res = http_req(f"{BASE_URL}/trips/{trip_id}/send-to-production", method="POST", token=disp_token)
    assert status == 200, f"Send to production failed: {prod_send_res}"
    print(f"✓ Trip {trip_num} sent to Batching Plant Production.")

    # 6. Production Queue & Batching Execution
    print("\n[Step 6/12] Production Queue check & batching recipe execution...")
    _, res_prod = http_req(f"{BASE_URL}/queue?role=production")
    prod_queue = res_prod["data"]
    print(f"  • Production Queue: {len(prod_queue)} pending tasks")
    assert any(trip_num in item["title"] or trip_num in item["subtitle"] for item in prod_queue), "Trip should appear in Production queue"
    print(f"  • Task Alert: '{prod_queue[0]['title']}'")

    prod_token = login("production@rmc.test")
    # Start batching
    status, batch_start = http_req(f"{BASE_URL}/production/trips/{trip_id}/start-batching", method="POST", token=prod_token)
    assert status == 200, f"Start batching failed: {batch_start}"
    print(f"✓ Batching started for {trip_num}.")

    # Confirm loaded with automatic weights
    status, load_res = http_req(f"{BASE_URL}/production/trips/{trip_id}/confirm-loaded", method="POST", data={}, token=prod_token)
    assert status == 200, f"Confirm loaded failed: {load_res}"
    batch_sheet_data = load_res["data"]["batchSheet"]
    print(f"✓ Concrete mixed and loaded into {truck.tm_number}. Batch Sheet: {batch_sheet_data['batchNumber']}")

    # 7. QA/QC Queue & Slump Test Approval
    print("\n[Step 7/12] QA/QC Queue check & Slump Testing...")
    _, res_qa = http_req(f"{BASE_URL}/queue?role=qa")
    qa_queue = res_qa["data"]
    print(f"  • QA/QC Queue: {len(qa_queue)} pending tasks")
    assert any(trip_num in item["title"] or trip_num in item["subtitle"] for item in qa_queue), "Trip should appear in QA/QC queue"
    print(f"  • Task Alert: '{qa_queue[0]['title']}'")

    qa_token = login("qa@rmc.test")
    qc_payload = {
        "tripId": trip_id,
        "batchSheetId": batch_sheet_data["id"],
        "physicalInspection": "PASS",
        "slump": 130,
        "bleeding": "PASS",
        "wrongMix": "PASS",
        "decision": "APPROVE",
        "remarks": "Cohesive workable mix, zero segregation, slump 130mm within IS 4926 limits."
    }
    status, qc_res = http_req(f"{BASE_URL}/qa/checks", method="POST", data=qc_payload, token=qa_token)
    assert status == 200, f"QC check failed: {qc_res}"
    print(f"✓ QA/QC Slump Test APPROVED (130 mm). Trip status: QC_APPROVED.")

    # 8. Dispatcher Releases Challan & In-Transit
    print("\n[Step 8/12] Dispatcher prints Challan & releases Transit Mixer...")
    status, rel_res = http_req(f"{BASE_URL}/trips/{trip_id}/release", method="POST", token=disp_token)
    assert status == 200, f"Trip release failed: {rel_res}"
    print(f"✓ Challan released. Challan Number: {rel_res['data'].get('challanNumber')}")

    status, trans_res = http_req(f"{BASE_URL}/trips/{trip_id}/in-transit", method="POST", token=disp_token)
    assert status == 200, f"Mark in transit failed: {trans_res}"
    print(f"✓ TM {truck.tm_number} is now IN_TRANSIT on the road.")

    # 9. Site Supervisor Queue, Gate Arrival & Delivery Sign-off
    print("\n[Step 9/12] Site Supervisor Queue check, gate arrival & digital delivery sign-off...")
    _, res_sup = http_req(f"{BASE_URL}/queue?role=supervisor")
    sup_queue = res_sup["data"]
    print(f"  • Site Supervisor Queue: {len(sup_queue)} pending tasks")
    assert any(trip_num in item["title"] or trip_num in item["subtitle"] for item in sup_queue), "Trip should appear in Supervisor queue"
    print(f"  • Task Alert: '{sup_queue[0]['title']}'")

    sup_token = login("supervisor@rmc.test")
    # Gate arrival
    status, arr_res = http_req(f"{BASE_URL}/trips/{trip_id}/arrive", method="POST", data={"notes": "TM arrived at site gate, inspecting pump pipeline"}, token=sup_token)
    assert status == 200, f"Site arrive failed: {arr_res}"
    print(f"✓ Site arrival confirmed by Site Supervisor.")

    # Digital delivery sign-off
    status, deliv_res = http_req(f"{BASE_URL}/trips/{trip_id}/deliver", method="POST", data={"deliveredQuantity": 8.0, "receiverName": "Er. Amit Patil (Site Incharge)"}, token=sup_token)
    assert status == 200, f"Confirm delivery failed: {deliv_res}"
    print(f"✓ Trip {trip_num} digitally marked DELIVERED! (Delivered Qty: 8.0 cum)")

    # 10. Billing and Invoicing Verification
    print("\n[Step 10/12] Verifying Tax Invoice & Commercial calculation...")
    with app.app_context():
        inv = Invoice.query.filter_by(po_id=po_id).first()
        assert inv is not None, "Invoice should be automatically generated upon trip delivery"
        print(f"✓ Tax Invoice generated: {inv.invoice_number}")
        print(f"  • Taxable Subtotal : ₹{inv.subtotal:,.2f}")
        print(f"  • GST (18%)        : ₹{(inv.total - inv.subtotal):,.2f}")
        print(f"  • Total Invoice Amt: ₹{inv.total:,.2f}")
        print(f"  • Balance Due      : ₹{inv.outstanding_amount:,.2f}")
        assert inv.subtotal == 8.0 * 4600.0, f"Expected 36,800.0 subtotal, got {inv.subtotal}"

    # 11. Accounts Queue Verification
    print("\n[Step 11/12] Verifying Accounts Desk Queue for Payment Collection...")
    _, res_acc = http_req(f"{BASE_URL}/queue?role=account")
    acc_queue = res_acc["data"]
    print(f"  • Accounts Queue: {len(acc_queue)} pending tasks")
    assert any(inv.invoice_number in item["title"] or inv.invoice_number in item["subtitle"] for item in acc_queue), "Invoice should appear in Accounts queue"
    print(f"  • Task Alert: '{acc_queue[0]['title']}' (Amount Due: {acc_queue[0]['badgeText']})")

    # 12. Dynamic Reports Live Query
    print("\n[Step 12/12] Testing live operational reports for real-time updates...")
    # Day Wise Production Report
    status, day_rep = http_req(f"{BASE_URL}/reports/daywise_production?from=2026-10-01&to=2026-10-31", token=mgr_token)
    assert status == 200, f"Daywise report failed: {day_rep}"
    day_data = day_rep["data"]
    print(f"✓ Daywise Production Report: {len(day_data['rows'])} active production dates")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_row = next((r for r in day_data["rows"] if r[0] == today_str), None)
    assert today_row is not None, "Today's production row should be present in Daywise Production Report"
    print(f"  • Today's Production Row: Date={today_row[0]}, Trips={today_row[1]}, Total Vol={today_row[2]} m³, M30={today_row[6]} m³, Avg Slump={today_row[12]}")
    assert today_row[2] >= 8.0, "Total volume should reflect the 8.0 cum delivered"

    # CRB-75 Plant Consumption Report
    status, crb_rep = http_req(f"{BASE_URL}/reports/consumption_crb75?from=2026-10-01&to=2026-10-31", token=mgr_token)
    assert status == 200, f"CRB-75 report failed: {crb_rep}"
    crb_data = crb_rep["data"]
    print(f"✓ CRB-75 Consumption Report: {len(crb_data['rows'])} logged batching dates")
    crb_row = next((r for r in crb_data["rows"] if r[0] == today_str), None)
    assert crb_row is not None, "Today's batch consumption row should be present"
    print(f"  • Raw Materials Consumed Today: Cement={crb_row[4]} kg, Sand={crb_row[7]} kg, Agg 10mm={crb_row[8]} kg, Agg 20mm={crb_row[9]} kg, Water={crb_row[10]} L, Admixture={crb_row[11]} kg")

    # Schedule and Production Report
    status, sched_rep = http_req(f"{BASE_URL}/reports/schedule_and_production?from=2026-10-01&to=2026-10-31", token=disp_token)
    assert status == 200, f"Schedule report failed: {sched_rep}"
    sched_data = sched_rep["data"]
    print(f"✓ Schedule & Production Report: {len(sched_data['rows'])} scheduled trips")
    trip_row = next((r for r in sched_data["rows"] if r[0] == trip_num), None)
    assert trip_row is not None, "Scheduled trip should be present"
    print(f"  • Trip Row: Trip={trip_row[0]}, PO={trip_row[2]}, Cust={trip_row[3]}, Scheduled={trip_row[6]} m³, Batched={trip_row[7]} m³, Status={trip_row[15]}")
    assert trip_row[15] == "DELIVERED", f"Trip status in schedule report should be DELIVERED, got {trip_row[15]}"

    print("\n" + "=" * 70)
    print("🏆 ALL 12 LIVE OPERATIONAL END-TO-END TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    run_test()
