# Ready-Mix Concrete (RMC) Order-to-Delivery System

An end-to-end prototype of an **Order-to-Delivery Management System for a Single Ready-Mix Concrete (RMC) Plant**.

```mermaid
flowchart LR
    A[Sales PO] -->|Submit| B[Sales Manager Approval]
    B -->|Approve| C[Dispatch Planning]
    C -->|Assign TM + Driver| D[Production Batching]
    D -->|Simulated AJAX| E[QA / QC Check]
    E -->|QC Stamp| F[Final Release & Challan]
    F -->|In Transit| G[Delivered]
    G --> H[Billing & Invoice]
    H --> I[Payment Tracking]
```

---

## 1. Quick Start

### Option A: Local Development (Fastest)

#### Backend Setup
```sh
# 1. Activate Python 3.11+ virtual environment
cd /Users/rahulwagh/Developer/rmc
backend/.venv/bin/pip install -r backend/requirements.txt

# 2. Seed database with 30 days of realistic history
PYTHONPATH=. backend/.venv/bin/python -m flask --app backend.wsgi seed

# 3. Run Flask backend on port 5001
PYTHONPATH=. backend/.venv/bin/python backend/wsgi.py
```

Backend will be available at: `http://localhost:5001` (API endpoints at `/api/v1/`, OpenAPI docs at `/apidocs`).

#### Frontend Setup
```sh
# In the project root
npm install
npm run dev
```

Frontend will be available at: `http://localhost:5173` (requests to `/api` proxy automatically to `http://127.0.0.1:5001`).

---

### Option B: Docker Compose (Full Stack with PostgreSQL)

```sh
docker-compose up --build
```
This runs:
- `rmc-postgres`: PostgreSQL 16 on port 5432
- `rmc-backend`: Flask API + Gunicorn on port 5001 (auto-runs `flask seed`)
- `rmc-frontend`: Nginx serving production bundle on port 8080

---

## 2. Demo Credentials

All accounts use password: **`Demo@123`**

| Role | Email | Password | Primary Purpose / Home View |
|---|---|---|---|
| **Owner** | `owner@rmc.test` | `Demo@123` | Plant-wide monitor dashboard (read-only, no write permissions) |
| **Sales** | `sales@rmc.test` | `Demo@123` | Customers, sites, PO creation, draft/save/submit, PO print/PDF |
| **Sales Manager** | `salesmanager@rmc.test` | `Demo@123` | PO verification & approval queue (sends orders to Dispatch) |
| **Dispatcher** | `dispatcher@rmc.test` | `Demo@123` | Truck availability, TM trips planning, simulated WhatsApp, QC-gated release, Challans, Invoicing |
| **Production** | `production@rmc.test` | `Demo@123` | Material check, AJAX automatic batching scale, stock decrements, batch sheets |
| **QA / QC** | `qa@rmc.test` | `Demo@123` | Slump checks, QC decision (Approve/Reject), digital stamp, cube testing, 13 QA reports |
| **Customer 1** | `customer1@rmc.test` | `Demo@123` | Kirloskar Infra portal: order tracking stepper, trip status, challans |
| **Customer 2** | `customer2@rmc.test` | `Demo@123` | VTP Realty portal: customer-isolated order views |

---

## 3. End-to-End Acceptance Test Walkthrough

1. **Sales & Approval**:
   - Login as `sales@rmc.test`. Create a 24 cum M25 PO for Kirloskar Infra with 45-day credit terms. Submit it.
   - Login as `salesmanager@rmc.test`. Open the Approval queue, verify and click **Approve**.
2. **Dispatch Planning**:
   - Login as `dispatcher@rmc.test`. View the approved PO. Create three trips (8 + 8 + 8 cum). Assign available Transit Mixers and drivers. Click **Send to Production**.
3. **Production Batching**:
   - Login as `production@rmc.test`. Check material stock shortfalls. Click **Start Batching** (simulates weighed materials on AJAX scale) and **Confirm Loaded**. Batch Sheet is generated and stock is decremented.
4. **QA Verification**:
   - Login as `qa@rmc.test`. Enter slump (e.g. 135 mm) and visual checks. Click **Approve** (digital QC stamp applied). Cast cubes for 3, 7, and 28 days.
   - If a TM is rejected with "Replace", a replacement trip is auto-created for Dispatch.
5. **Release & Tracking**:
   - Login as `dispatcher@rmc.test`. Attempting to release a trip before QC approval is blocked by server validation. Release Trip 1 (generates 3-copy delivery challan: Customer, Driver, Plant copy). Mark In Transit &rarr; Delivered.
   - Login as `customer1@rmc.test`. View the live tracking stepper and download the delivery challan.
6. **Billing & Invoices**:
   - Login as `dispatcher@rmc.test`. Generate an invoice for delivered quantity. Record partial payment (balance and due date update automatically).
7. **Owner Oversight & QA Reports**:
   - Login as `owner@rmc.test`. View orders per date, payment breakdown, schedule, and percentage metrics. Direct API write attempts are refused with `403 Forbidden`.
   - Login as `qa@rmc.test`. Open Reports to view and export any of the 13 QA reports to Excel (`.xlsx`) or CSV.

---

## 4. Running Backend Tests

```sh
PYTHONPATH=. backend/.venv/bin/pytest backend/tests -v
```
Verified test suite covers:
- Owner read-only restriction (non-GET rejected with `403`)
- Customer data isolation (scoping prevents cross-tenant access)
- PO balance rules (trips cannot exceed balance)
- TM capacity limits
- Strict QC approval requirement before dispatch release
- Invoice subtotal and payment balance math
