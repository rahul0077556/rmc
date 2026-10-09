import pytest
from datetime import datetime, timezone, timedelta
from backend.app import create_app
from backend.app.config import TestingConfig
from backend.app.extensions import db
from backend.app.models.models import (
    Plant, User, Customer, Site, Grade, MixDesign, Material,
    Truck, Driver, PurchaseOrder, Trip, BatchSheet, QcCheck,
    Invoice, InvoiceLine, Payment
)

@pytest.fixture
def app():
    app = create_app(TestingConfig)
    with app.app_context():
        db.create_all()
        # Seed basic lookup fixtures
        plant = Plant(name="Test Plant", address="Test Address", gstin="27AABCA1234F1Z9")
        db.session.add(plant)

        grade = Grade(code="M25", characteristic_strength_mpa=25.0, slump_min_mm=120, slump_max_mm=160, default_rate=4500.0)
        db.session.add(grade)
        db.session.flush()

        mix = MixDesign(grade_id=grade.id, cement_kg=330, sand_kg=710, aggregate_10mm_kg=480, aggregate_20mm_kg=730, water_l=165, admixture_l=1.8)
        db.session.add(mix)

        cust1 = Customer(name="Customer A", contact_person="P1", phone="123", email="c1@test.com", gstin="GST1", address="Add 1", credit_days=30, credit_limit=1000000.0)
        cust2 = Customer(name="Customer B", contact_person="P2", phone="456", email="c2@test.com", gstin="GST2", address="Add 2", credit_days=45, credit_limit=1000000.0)
        db.session.add_all([cust1, cust2])
        db.session.flush()

        site1 = Site(customer_id=cust1.id, name="Site A1", address="Addr A1", contact_person="CP1", phone="111")
        site2 = Site(customer_id=cust2.id, name="Site B1", address="Addr B1", contact_person="CP2", phone="222")
        db.session.add_all([site1, site2])

        truck1 = Truck(tm_number="MH-12-TEST-01", capacity_cum=8, status="AVAILABLE")
        truck2 = Truck(tm_number="MH-12-TEST-02", capacity_cum=5, status="AVAILABLE")
        driver1 = Driver(name="Driver 1", phone="999", license_no="LIC1", status="AVAILABLE")
        db.session.add_all([truck1, truck2, driver1])

        # Users
        u_owner = User(name="Owner", email="owner@rmc.test", role="owner", is_active=True)
        u_owner.set_password("Demo@123")
        u_sales = User(name="Sales", email="sales@rmc.test", role="sales", is_active=True)
        u_sales.set_password("Demo@123")
        u_mgr = User(name="Sales Mgr", email="salesmanager@rmc.test", role="sales", is_manager=True, is_active=True)
        u_mgr.set_password("Demo@123")
        u_disp = User(name="Dispatcher", email="dispatcher@rmc.test", role="dispatcher", is_active=True)
        u_disp.set_password("Demo@123")
        u_prod = User(name="Production", email="production@rmc.test", role="production", is_active=True)
        u_prod.set_password("Demo@123")
        u_qa = User(name="QA", email="qa@rmc.test", role="qa", is_active=True)
        u_qa.set_password("Demo@123")
        u_c1 = User(name="Cust1 User", email="customer1@rmc.test", role="customer", customer_id=cust1.id, is_active=True)
        u_c1.set_password("Demo@123")
        u_c2 = User(name="Cust2 User", email="customer2@rmc.test", role="customer", customer_id=cust2.id, is_active=True)
        u_c2.set_password("Demo@123")

        db.session.add_all([u_owner, u_sales, u_mgr, u_disp, u_prod, u_qa, u_c1, u_c2])
        db.session.commit()

        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def login(client, email):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Demo@123"})
    return res.get_json()["data"]["token"]
