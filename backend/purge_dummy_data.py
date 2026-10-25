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

        # 5. Customers & Sites
        Site.query.delete()
        Customer.query.delete()

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

        # 8. Reset Material Stocks to 0
        for mat in Material.query.all():
            mat.current_stock = 0.0

        # 9. Reset Trucks & Drivers to AVAILABLE
        for truck in Truck.query.all():
            truck.status = "AVAILABLE"
        for driver in Driver.query.all():
            driver.status = "AVAILABLE"

        # 10. Reset Document Numbering Sequences
        for seq in Sequence.query.all():
            seq.last_number = 0

        db.session.commit()
        print("✓ All dummy data successfully purged.")
        print("✓ Database is clean, structured, and ready for fresh manual test data.")

if __name__ == "__main__":
    purge_dummy_data()
