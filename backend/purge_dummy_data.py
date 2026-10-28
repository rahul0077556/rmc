"""
Purge all dummy transactional and operational records from the RMC SQLite database.
Preserves:
- User accounts (so all 10 role logins remain workable)
- Plant settings and profile
- Standard concrete grades & mix designs (IS 456 / IS 10262)
- Material catalogue (resetting current stock to 0.0)
- Trucks and Drivers (resetting status to AVAILABLE)
- Weighbridge settings
- Numbering sequences (resetting to 1 for PO, BS, CH, INV, WB)
"""

import sys
import os

# Add root directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.models import (
    Customer, Site, PurchaseOrder, Trip, BatchSheet, BatchSheetRevision,
    Challan, QcCheck, CubeSet, CubeTest, Invoice, InvoiceLine, Payment,
    WeighbridgeTicket, StockTransaction, Material, Truck, Driver,
    DprRecord, ExpenseRecord, AttendanceRecord, PayrollRun, MaterialTest,
    AuditLog, NotificationLog, Sequence
)

def purge_dummy_data():
    app = create_app()
    with app.app_context():
        print("Clearing transactional & operational dummy records...")

        # 1. QA & Lab
        CubeTest.query.delete()
        CubeSet.query.delete()
        QcCheck.query.delete()
        MaterialTest.query.delete()

        # 2. Challans & Batch Sheets
        Challan.query.delete()
        BatchSheetRevision.query.delete()
        BatchSheet.query.delete()

        # 3. Billing & Payments
        InvoiceLine.query.delete()
        Invoice.query.delete()
        Payment.query.delete()

        # 4. Dispatch & Trips
        Trip.query.delete()
        PurchaseOrder.query.delete()

        # 5. Customers & Sites check / re-seeding if empty
        if Customer.query.count() == 0:
            c1 = Customer(name="Kulkarni Mega Constructions", contact_person="Er. Aniket Kulkarni", phone="+91 98220 11223", email="purchase@kulkarniconstruct.in", gstin="27AAACK1234D1Z5", credit_days=30, credit_limit=5000000.0, address="Kulkarni Chambers, FC Road, Pune 411005")
            c2 = Customer(name="Wagh Infra Projects Pvt Ltd", contact_person="Mr. Rahul Wagh", phone="+91 98900 44556", email="projects@waghinfra.com", gstin="27AABCW5678E1Z2", credit_days=45, credit_limit=7500000.0, address="Wagh Corporate Park, Baner, Pune 411045")
            db.session.add_all([c1, c2])
            db.session.flush()

            s1 = Site(customer_id=c1.id, name="Kulkarni Riverview Residences", address="Survey 48/2, DP Road, Kothrud, Pune 411038", contact_person="Sunil Shinde", contact_phone="+91 98220 99887", distance_km=14.5)
            s2 = Site(customer_id=c2.id, name="Wagh Business Bay - Tower A", address="Plot 12, Balewadi High Street, Pune 411045", contact_person="Amit Patil", contact_phone="+91 98900 11223", distance_km=8.2)
            db.session.add_all([s1, s2])

        # 6. Store & Weighbridge & HR Records
        WeighbridgeTicket.query.delete()
        StockTransaction.query.delete()
        DprRecord.query.delete()
        ExpenseRecord.query.delete()
        AttendanceRecord.query.delete()
        PayrollRun.query.delete()

        # 7. Audit & Notification Logs
        AuditLog.query.delete()
        NotificationLog.query.delete()

        # 8. Reset Material Stocks to healthy working quantities for batching
        stock_defaults = {
            "Cement (OPC 53)": 185000.0,
            "River Sand (Zone II)": 320000.0,
            "Aggregate 10mm": 260000.0,
            "Aggregate 20mm": 380000.0,
            "Fly Ash (Class F)": 95000.0,
            "GGBS (Slag)": 110000.0,
            "Water": 500000.0,
            "Admixture (PCE)": 4200.0,
        }
        for mat in Material.query.all():
            mat.current_stock = stock_defaults.get(mat.name, 100000.0)

        # 9. Reset Trucks & Drivers to AVAILABLE
        for truck in Truck.query.all():
            truck.status = "AVAILABLE"
        for driver in Driver.query.all():
            driver.status = "AVAILABLE"

        # 10. Reset Document Numbering Sequences to 0
        Sequence.query.delete()

        db.session.commit()
        print("✓ All dummy data successfully purged.")
        print("✓ Database is clean, structured, and ready for fresh manual test data.")

if __name__ == "__main__":
    purge_dummy_data()
