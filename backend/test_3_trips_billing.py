import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timezone, timedelta
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.models import (
    Customer, Site, Grade, PurchaseOrder, Trip, Truck, Driver,
    BatchSheet, QcCheck, Challan, Invoice, InvoiceLine, Payment, User
)
from backend.app.services.sequence_service import get_next_sequence
from backend.app.services.state_machine import StateMachine
from backend.app.services.billing_service import BillingService

def run_e2e_3trips_test():
    app = create_app()
    with app.app_context():
        print("=== STARTING E2E 3-TRIP FRESH WORKFLOW TEST ===")

        # 1. Fetch Master Data
        cust = Customer.query.first()
        site = Site.query.filter_by(customer_id=cust.id).first()
        grade = Grade.query.filter_by(code="M25").first() or Grade.query.first()
        trucks = Truck.query.filter_by(status="AVAILABLE").limit(3).all()
        drivers = Driver.query.filter_by(status="AVAILABLE").limit(3).all()
        user = User.query.first()

        assert cust is not None, "Customer not found"
        assert site is not None, "Site not found"
        assert grade is not None, "Grade not found"
        assert len(trucks) >= 3, "Not enough trucks"
        assert len(drivers) >= 3, "Not enough drivers"

        rate = grade.default_rate or 4500.0
        total_po_qty = 24.0

        # 2. Create Fresh Purchase Order (24 cum)
        po_num = get_next_sequence("PO", "PO")
        po = PurchaseOrder(
            po_number=po_num,
            customer_id=cust.id,
            site_id=site.id,
            grade_id=grade.id,
            quantity_cum=total_po_qty,
            rate_per_cum=rate,
            delivery_datetime=datetime.now(timezone.utc) + timedelta(hours=2),
            purpose="Slab Concrete",
            pump_required=True,
            payment_terms_days=30,
            status="DRAFT",
            created_by=user.id
        )
        db.session.add(po)
        db.session.commit()
        print(f"1. Created Fresh PO: {po.po_number} for {cust.name} ({total_po_qty} cum of {grade.code} @ ₹{rate}/cum)")

        # Submit & Approve PO
        StateMachine.transition_po(po, "SUBMITTED", user_id=user.id)
        StateMachine.transition_po(po, "APPROVED", user_id=user.id, remarks="Credit verified. Approved for dispatch.")
        db.session.commit()
        print(f"2. PO Approved! Status = {po.status}")

        # 3. Plan 3 Trips of 8 cum each
        trips = []
        for i in range(3):
            trip_num = get_next_sequence("TRIP", "TRIP")
            trip = Trip(
                trip_number=trip_num,
                po_id=po.id,
                truck_id=trucks[i].id,
                driver_id=drivers[i].id,
                sequence=i + 1,
                quantity_cum=8.0,
                planned_datetime=datetime.now(timezone.utc) + timedelta(minutes=30 * (i + 1)),
                status="PLANNED"
            )
            db.session.add(trip)
            trips.append(trip)
        db.session.commit()
        print(f"3. Planned 3 Trips: {[t.trip_number for t in trips]} (8.0 cum each)")

        # 4. Execute Full Cycle for each of the 3 trips
        for i, trip in enumerate(trips):
            # A. Send to Production
            StateMachine.transition_trip(trip, "SENT_TO_PRODUCTION", user_id=user.id)
            StateMachine.transition_trip(trip, "BATCHING", user_id=user.id)
            
            # Create Batch Sheet
            bs_num = get_next_sequence("BATCH_SHEET", "BS")
            bs = BatchSheet(
                batch_number=bs_num,
                trip_id=trip.id,
                grade_id=grade.id,
                quantity_cum=trip.quantity_cum,
                cement_kg=2640.0,
                sand_kg=5680.0,
                agg_10_kg=3840.0,
                agg_20_kg=5840.0,
                water_l=1320.0,
                admixture_l=14.4,
                qc_status="APPROVED",
                qc_signed_by="QC Engineer",
                qc_signed_at=datetime.now(timezone.utc)
            )
            db.session.add(bs)
            StateMachine.transition_trip(trip, "LOADED", user_id=user.id)
            StateMachine.transition_trip(trip, "QC_PENDING", user_id=user.id)

            # QC Check
            qc = QcCheck(
                trip_id=trip.id,
                batch_sheet_id=bs.id,
                physical_inspection_ok=True,
                slump_mm=135,
                bleeding_ok=True,
                wrong_mix_ok=True,
                decision="APPROVE",
                checked_by="QC Engineer"
            )
            db.session.add(qc)
            StateMachine.transition_trip(trip, "QC_APPROVED", user_id=user.id)

            # B. Release with Challan
            ch_num = get_next_sequence("CHALLAN", "CH")
            ch = Challan(
                challan_number=ch_num,
                trip_id=trip.id,
                released_by="Dispatcher"
            )
            db.session.add(ch)
            StateMachine.transition_trip(trip, "DISPATCHED", user_id=user.id)
            StateMachine.transition_trip(trip, "IN_TRANSIT", user_id=user.id)

            # C. Site Arrival & Delivery Sign-off
            trip.notes = "[Site Arrival: 10:15 - Reached site pump line]"
            StateMachine.transition_trip(
                trip,
                "DELIVERED",
                user_id=user.id,
                extra_data={"delivered_quantity": 8.0, "receiver_name": "Er. Rahul Wagh"}
            )
            
            # Auto-sync invoice
            inv = BillingService.sync_invoice_for_po(po.id, user_id=user.id)
            db.session.commit()

            # Verify Trip to_dict billing info
            trip_dict = trip.to_dict()
            assert trip_dict["ratePerCum"] == rate, f"Rate mismatch: {trip_dict['ratePerCum']} vs {rate}"
            assert trip_dict["baseAmount"] == 8.0 * rate, f"Base mismatch: {trip_dict['baseAmount']}"
            assert trip_dict["totalAmount"] == round(8.0 * rate * 1.18, 2), f"Total mismatch"

            print(f"   ✓ Trip {i+1} ({trip.trip_number}, Challan {ch.challan_number}):")
            print(f"     - Dispatched & Delivered 8.0 cum")
            print(f"     - Trip Amount: Base ₹{trip_dict['baseAmount']:,.2f} + 18% GST (₹{trip_dict['gstAmount']:,.2f}) = ₹{trip_dict['totalAmount']:,.2f}")
            print(f"     - Cumulative PO Invoice Total so far: ₹{inv.total:,.2f} ({len(inv.lines)} trips)")

        # 5. Final Invoice Verification
        db.session.refresh(po)
        final_inv = Invoice.query.filter_by(po_id=po.id).first()
        assert final_inv is not None, "Invoice was not generated!"
        assert len(final_inv.lines) == 3, f"Expected 3 lines, got {len(final_inv.lines)}"

        expected_subtotal = 24.0 * rate  # 24 * 4500 = 108,000
        expected_gst = round(expected_subtotal * 0.18, 2)  # 19,440
        expected_grand_total = round(expected_subtotal + expected_gst, 2)  # 127,440

        inv_dict = final_inv.to_dict()
        assert final_inv.subtotal == expected_subtotal, f"Subtotal expected {expected_subtotal}, got {final_inv.subtotal}"
        assert final_inv.total == expected_grand_total, f"Grand total expected {expected_grand_total}, got {final_inv.total}"
        assert inv_dict["tripCount"] == 3, f"Expected tripCount 3, got {inv_dict['tripCount']}"
        assert inv_dict["totalQuantity"] == 24.0, f"Expected totalQuantity 24.0, got {inv_dict['totalQuantity']}"

        print("\n=== FINAL BILLING VALIDATION ===")
        print(f"✓ Invoice Number: {final_inv.invoice_number}")
        print(f"✓ Total Delivered Trips: {len(final_inv.lines)} trips (Total Volume: {inv_dict['totalQuantity']} cum)")
        print(f"✓ Subtotal: ₹{final_inv.subtotal:,.2f}")
        print(f"✓ GST (18%): ₹{(final_inv.total - final_inv.subtotal):,.2f}")
        print(f"✓ Grand Total Bill Amount: ₹{final_inv.total:,.2f}")
        print(f"✓ PO Status: {po.status} (Delivered: {po.delivered_quantity}/{po.quantity_cum} cum)")

        # 6. Record Payment
        payment = Payment(
            invoice_id=final_inv.id,
            amount=final_inv.total,
            paid_on=datetime.now(timezone.utc).date(),
            mode="Bank Transfer",
            reference="RTGS-HDFC-998811",
            recorded_by="Accountant",
            created_by=user.id
        )
        db.session.add(payment)
        db.session.flush()
        db.session.refresh(final_inv)

        if final_inv.outstanding_amount <= 0.01:
            StateMachine.transition_invoice(final_inv, "PAID", user_id=user.id)
        db.session.commit()

        assert final_inv.status == "PAID", f"Expected PAID, got {final_inv.status}"
        assert final_inv.outstanding_amount == 0.0, f"Expected 0.0 outstanding, got {final_inv.outstanding_amount}"

        print(f"✓ Payment of ₹{final_inv.total:,.2f} recorded! Invoice Status = {final_inv.status}, Outstanding = ₹{final_inv.outstanding_amount:,.2f}")
        print("\n🏆 TEST PASSED WITH 100% SUCCESS! ALL 3 TRIPS ARE PROPERLY SUMMED IN BILLING AND EACH TRIP CHALLAN HAS ACCURATE AMOUNTS!")

if __name__ == "__main__":
    run_e2e_3trips_test()
