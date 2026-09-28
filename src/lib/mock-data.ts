import { addDays, format, subDays } from "date-fns";
import type {
  AppNotification,
  AuditEntry,
  BatchSheet,
  CubeTest,
  Customer,
  Driver,
  Grade,
  Invoice,
  MaterialStock,
  MaterialTest,
  Payment,
  PurchaseOrder,
  QcCheck,
  Site,
  TransitMixer,
  Trip,
  TripStatus,
} from "@/types";

/** Deterministic PRNG so the dashboard looks identical on every load. */
function makeRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const rand = makeRandom(20260928);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

export const PLANT_NAME = "ABC Ready Mix Concrete Plant";
export const GRADES: Grade[] = ["M15", "M20", "M25", "M30", "M35", "M40"];

export const GRADE_RATE: Record<Grade, number> = {
  M15: 4250,
  M20: 4600,
  M25: 4950,
  M30: 5300,
  M35: 5650,
  M40: 6050,
};

export const SLUMP_TARGET: Record<Grade, [number, number]> = {
  M15: [75, 125],
  M20: [75, 125],
  M25: [100, 150],
  M30: [100, 150],
  M35: [125, 175],
  M40: [125, 175],
};

export const MIX_DESIGN: Record<Grade, { material: string; perCum: number; unit: string }[]> = {
  M15: [
    { material: "Cement", perCum: 290, unit: "kg" },
    { material: "Sand", perCum: 420, unit: "kg" },
    { material: "Aggregate 10mm", perCum: 380, unit: "kg" },
    { material: "Aggregate 20mm", perCum: 700, unit: "kg" },
    { material: "Water", perCum: 175, unit: "ltr" },
    { material: "Admixture", perCum: 2.1, unit: "kg" },
  ],
  M20: [
    { material: "Cement", perCum: 320, unit: "kg" },
    { material: "Sand", perCum: 410, unit: "kg" },
    { material: "Aggregate 10mm", perCum: 390, unit: "kg" },
    { material: "Aggregate 20mm", perCum: 720, unit: "kg" },
    { material: "Water", perCum: 170, unit: "ltr" },
    { material: "Admixture", perCum: 2.4, unit: "kg" },
  ],
  M25: [
    { material: "Cement", perCum: 350, unit: "kg" },
    { material: "Sand", perCum: 400, unit: "kg" },
    { material: "Aggregate 10mm", perCum: 400, unit: "kg" },
    { material: "Aggregate 20mm", perCum: 740, unit: "kg" },
    { material: "Water", perCum: 165, unit: "ltr" },
    { material: "Admixture", perCum: 2.8, unit: "kg" },
  ],
  M30: [
    { material: "Cement", perCum: 380, unit: "kg" },
    { material: "Sand", perCum: 395, unit: "kg" },
    { material: "Aggregate 10mm", perCum: 405, unit: "kg" },
    { material: "Aggregate 20mm", perCum: 750, unit: "kg" },
    { material: "Water", perCum: 160, unit: "ltr" },
    { material: "Admixture", perCum: 3.2, unit: "kg" },
  ],
  M35: [
    { material: "Cement", perCum: 410, unit: "kg" },
    { material: "Sand", perCum: 385, unit: "kg" },
    { material: "Aggregate 10mm", perCum: 410, unit: "kg" },
    { material: "Aggregate 20mm", perCum: 760, unit: "kg" },
    { material: "Water", perCum: 158, unit: "ltr" },
    { material: "Admixture", perCum: 3.6, unit: "kg" },
  ],
  M40: [
    { material: "Cement", perCum: 440, unit: "kg" },
    { material: "Sand", perCum: 375, unit: "kg" },
    { material: "Aggregate 10mm", perCum: 415, unit: "kg" },
    { material: "Aggregate 20mm", perCum: 770, unit: "kg" },
    { material: "Water", perCum: 155, unit: "ltr" },
    { material: "Admixture", perCum: 4.1, unit: "kg" },
  ],
};

export const materialStock: MaterialStock[] = [
  { material: "Cement", available: 154000, unit: "kg" },
  { material: "Sand", available: 62000, unit: "kg" },
  { material: "Aggregate 10mm", available: 48000, unit: "kg" },
  { material: "Aggregate 20mm", available: 91000, unit: "kg" },
  { material: "Water", available: 42000, unit: "ltr" },
  { material: "Admixture", available: 860, unit: "kg" },
];

export const customers: Customer[] = [
  {
    id: "CUS-01",
    name: "ABC Constructions",
    contactPerson: "Suresh Menon",
    phone: "+91 98220 41122",
    email: "customer1@rmc.test",
    gstin: "27AACCA1234F1ZQ",
    creditDays: 30,
    creditLimit: 4500000,
    billingAddress: "Plot 14, MIDC Phase II, Pune 411019",
  },
  {
    id: "CUS-02",
    name: "Shree Developers",
    contactPerson: "Nikhil Deshpande",
    phone: "+91 98811 33220",
    email: "customer2@rmc.test",
    gstin: "27AAFCS8821K1Z8",
    creditDays: 45,
    creditLimit: 6000000,
    billingAddress: "Shree House, Baner Road, Pune 411045",
  },
  {
    id: "CUS-03",
    name: "Metro Infra",
    contactPerson: "Arvind Kulkarni",
    phone: "+91 98905 77321",
    email: "accounts@metroinfra.test",
    gstin: "27AAGCM4410P1ZK",
    creditDays: 60,
    creditLimit: 9000000,
    billingAddress: "Metro Tower, Hinjewadi, Pune 411057",
  },
  {
    id: "CUS-04",
    name: "BuildWell Projects",
    contactPerson: "Farhan Qureshi",
    phone: "+91 99201 66450",
    email: "ops@buildwell.test",
    gstin: "27AADCB7719M1ZR",
    creditDays: 30,
    creditLimit: 3200000,
    billingAddress: "BuildWell Yard, Wagholi, Pune 412207",
  },
  {
    id: "CUS-05",
    name: "Skyline Builders",
    contactPerson: "Priya Nair",
    phone: "+91 97640 20981",
    email: "priya@skyline.test",
    gstin: "27AAECS2290L1ZV",
    creditDays: 30,
    creditLimit: 2800000,
    billingAddress: "Skyline Arcade, Kharadi, Pune 411014",
  },
  {
    id: "CUS-06",
    name: "Urban Infra",
    contactPerson: "Ramesh Patil",
    phone: "+91 98508 11276",
    email: "ramesh@urbaninfra.test",
    gstin: "27AAJCU5512H1ZD",
    creditDays: 45,
    creditLimit: 5200000,
    billingAddress: "Urban Works, Chakan MIDC, Pune 410501",
  },
];

const siteNames = [
  "Tower A Podium",
  "Sector 7 Basement",
  "Riverfront Bridge",
  "Warehouse Block C",
  "Residency Phase 3",
  "Metro Pier P-14",
];

export const sites: Site[] = customers.flatMap((c, ci) =>
  Array.from({ length: 2 }, (_, i) => ({
    id: `SITE-${ci + 1}${i + 1}`,
    customerId: c.id,
    name: siteNames[(ci + i) % siteNames.length]!,
    address: `${between(10, 90)} ${["Baner", "Wagholi", "Kharadi", "Chakan", "Hinjewadi"][(ci + i) % 5]}, Pune`,
    contactPerson: c.contactPerson,
    phone: c.phone,
    accessibilityNotes:
      i === 0
        ? "Narrow approach road, TM up to 8 cum only. Entry allowed after 9:00 AM."
        : "Wide gate, boom pump can be positioned on the north side.",
  })),
);

export const transitMixers: TransitMixer[] = Array.from({ length: 12 }, (_, i) => {
  const capacities: TransitMixer["capacity"][] = [5, 7, 8, 9, 10];
  const statuses: TransitMixer["status"][] = [
    "AVAILABLE",
    "AVAILABLE",
    "ASSIGNED",
    "LOADED",
    "IN_TRANSIT",
    "MAINTENANCE",
  ];
  return {
    id: `TM-${String(i + 1).padStart(2, "0")}`,
    code: `TM-${String(i + 1).padStart(2, "0")}`,
    capacity: capacities[i % capacities.length]!,
    status: statuses[i % statuses.length]!,
  };
});

const driverNames = [
  "Rajesh Pawar",
  "Santosh Jadhav",
  "Imran Shaikh",
  "Vijay Shinde",
  "Mahesh Gaikwad",
  "Balu Sawant",
  "Dattatray More",
  "Ganesh Bhosale",
  "Sunil Kadam",
  "Prakash Thorat",
];

export const drivers: Driver[] = driverNames.map((name, i) => ({
  id: `DRV-${String(i + 1).padStart(2, "0")}`,
  name,
  phone: `+91 9${between(1000000, 9999999)}${between(10, 99)}`,
  status: i % 5 === 4 ? "UNAVAILABLE" : i % 3 === 0 ? "ASSIGNED" : "AVAILABLE",
}));

const today = new Date();
const iso = (d: Date) => d.toISOString();
const dateOnly = (d: Date) => format(d, "yyyy-MM-dd");

export const purchaseOrders: PurchaseOrder[] = [];
export const trips: Trip[] = [];
export const batchSheets: BatchSheet[] = [];
export const qcChecks: QcCheck[] = [];
export const cubeTests: CubeTest[] = [];
export const invoices: Invoice[] = [];
export const payments: Payment[] = [];
export const auditLog: AuditEntry[] = [];

let poSeq = 0;
let tripSeq = 0;
let bsSeq = 0;
let chSeq = 0;
let invSeq = 0;

function buildMaterials(grade: Grade, qty: number, withActual: boolean) {
  return MIX_DESIGN[grade].map((m) => {
    const theoretical = Math.round(m.perCum * qty * 10) / 10;
    const variance = 1 + (rand() * 0.016 - 0.007);
    return {
      material: m.material,
      unit: m.unit,
      theoretical,
      actual: withActual ? Math.round(theoretical * variance * 10) / 10 : 0,
    };
  });
}

const purposes: PurchaseOrder["purpose"][] = ["Slab", "Column", "Beam", "Footing", "Other"];

for (let day = 30; day >= 0; day--) {
  const date = subDays(today, day);
  const ordersToday = day === 0 ? 4 : between(2, 5);

  for (let o = 0; o < ordersToday; o++) {
    poSeq += 1;
    const customer = pick(customers);
    const site = pick(sites.filter((s) => s.customerId === customer.id));
    const grade = pick(GRADES);
    const quantity = between(2, 6) * 8;
    const pumpRequired = rand() > 0.55;
    const isPast = day > 1;
    const poId = `PO-2026-${String(poSeq).padStart(4, "0")}`;

    let status: PurchaseOrder["status"] = "COMPLETED";
    if (!isPast) status = pick(["SUBMITTED", "APPROVED", "IN_PROGRESS", "DRAFT"]);
    else if (rand() > 0.9) status = "CANCELLED";
    else if (day <= 4 && rand() > 0.5) status = "IN_PROGRESS";

    const po: PurchaseOrder = {
      id: poId,
      poNumber: poId,
      customerId: customer.id,
      siteId: site!.id,
      grade,
      quantity,
      deliveredQuantity: 0,
      ratePerCum: GRADE_RATE[grade],
      deliveryDate: dateOnly(date),
      deliveryTime: `${String(between(7, 16)).padStart(2, "0")}:${pick(["00", "30"])}`,
      purpose: pick(purposes),
      pumpRequired,
      pumpOwnership: pumpRequired ? pick(["Customer Pump", "Company Pump"]) : undefined,
      pumpType: pumpRequired ? pick(["Horizontal", "Vertical"]) : undefined,
      pipelineLength: pumpRequired ? between(20, 120) : undefined,
      workersRequired: pumpRequired ? between(2, 6) : undefined,
      paymentTerms: `${customer.creditDays} days credit`,
      reference: `UBITECH/${format(date, "yyyyMM")}/${String(poSeq).padStart(3, "0")}`,
      notes: pumpRequired ? "Pump to be positioned before 8:30 AM." : "Direct pour from chute.",
      status,
      createdBy: "Anita Rao (Sales)",
      createdAt: iso(date),
      submittedAt: status === "DRAFT" ? undefined : iso(date),
      approvedAt:
        status === "DRAFT" || status === "SUBMITTED" ? undefined : iso(addDays(date, 0)),
      approvedBy:
        status === "DRAFT" || status === "SUBMITTED" ? undefined : "Vikram Joshi (Sales Manager)",
    };

    purchaseOrders.push(po);

    if (status === "DRAFT" || status === "SUBMITTED" || status === "CANCELLED") continue;

    // Split into trips of max 8 cum
    const tripCount = Math.ceil(quantity / 8);
    for (let t = 0; t < tripCount; t++) {
      tripSeq += 1;
      const qty = t === tripCount - 1 ? quantity - 8 * (tripCount - 1) : 8;
      const tm = transitMixers[(tripSeq + t) % transitMixers.length]!;
      const driver = drivers[(tripSeq + t) % drivers.length]!;
      const plannedHour = 7 + ((t * 2 + o) % 10);
      const plannedTime = new Date(date);
      plannedTime.setHours(plannedHour, (t % 2) * 30, 0, 0);

      let tripStatus: TripStatus = "DELIVERED";
      if (status === "APPROVED") tripStatus = "PLANNED";
      else if (status === "IN_PROGRESS") {
        tripStatus = pick([
          "SENT_TO_PRODUCTION",
          "BATCHING",
          "LOADED",
          "QC_PENDING",
          "QC_APPROVED",
          "DISPATCHED",
          "IN_TRANSIT",
          "DELIVERED",
        ]);
      } else if (rand() > 0.94) tripStatus = "QC_REJECTED";

      const tripId = `TRIP-2026-${String(tripSeq).padStart(5, "0")}`;
      const trip: Trip = {
        id: tripId,
        tripNumber: tripId,
        poId,
        sequence: t + 1,
        quantity: qty,
        tmId: tripStatus === "PLANNED" && rand() > 0.6 ? undefined : tm.id,
        driverId: tripStatus === "PLANNED" && rand() > 0.6 ? undefined : driver.id,
        plannedTime: iso(plannedTime),
        status: tripStatus,
        lastUpdate: iso(plannedTime),
      };

      const batchedStates: TripStatus[] = [
        "LOADED",
        "QC_PENDING",
        "QC_APPROVED",
        "QC_REJECTED",
        "DISPATCHED",
        "IN_TRANSIT",
        "DELIVERED",
      ];

      if (batchedStates.includes(tripStatus)) {
        bsSeq += 1;
        const bsId = `BS-2026-${String(bsSeq).padStart(5, "0")}`;
        batchSheets.push({
          id: bsId,
          batchNumber: bsId,
          tripId,
          materials: buildMaterials(grade, qty, true),
          batchTime: iso(plannedTime),
          operator: "Sandeep Kale (Production)",
          qcStatus:
            tripStatus === "QC_PENDING"
              ? "PENDING"
              : tripStatus === "QC_REJECTED"
                ? "REJECTED"
                : "APPROVED",
        });
        trip.batchSheetId = bsId;

        if (tripStatus !== "QC_PENDING") {
          const [lo, hi] = SLUMP_TARGET[grade];
          const approved = tripStatus !== "QC_REJECTED";
          qcChecks.push({
            id: `QC-${bsId}`,
            batchSheetId: bsId,
            tripId,
            physicalInspection: approved ? "PASS" : "FAIL",
            slump: approved ? between(lo + 5, hi - 5) : hi + between(10, 35),
            bleeding: approved ? "PASS" : "FAIL",
            wrongMix: "PASS",
            admixtureType: "Poly-carboxylate ether",
            admixtureQuantity: Math.round(qty * 2.8 * 10) / 10,
            remarks: approved
              ? "Consistency and workability within specification."
              : "Slump beyond permissible limit — load not acceptable at site.",
            decision: approved ? "APPROVED" : "REJECTED",
            rejectionAction: approved ? undefined : pick(["CORRECT", "REPLACE"]),
            checkedBy: "Meera Iyer (QA)",
            checkedAt: iso(plannedTime),
          });

          if (approved && rand() > 0.55) {
            const castDate = plannedTime;
            ([3, 7, 28] as const).forEach((age) => {
              const due = addDays(castDate, age);
              const tested = due < today;
              cubeTests.push({
                id: `CT-${bsId}-${age}`,
                batchSheetId: bsId,
                grade,
                castDate: dateOnly(castDate),
                cubeCount: 9,
                age,
                dueDate: dateOnly(due),
                testedOn: tested ? dateOnly(due) : undefined,
                strength: tested
                  ? Math.round((Number(grade.slice(1)) * (age === 3 ? 0.5 : age === 7 ? 0.7 : 1.08) + rand() * 3) * 10) / 10
                  : undefined,
                result: tested ? (rand() > 0.08 ? "PASS" : "FAIL") : due < today ? "OVERDUE" : "PENDING",
              });
            });
          }
        }
      }

      if (["DISPATCHED", "IN_TRANSIT", "DELIVERED"].includes(tripStatus)) {
        chSeq += 1;
        trip.challanNumber = `CH-2026-${String(chSeq).padStart(5, "0")}`;
        trip.dispatchTime = iso(plannedTime);
      }
      if (tripStatus === "DELIVERED") {
        trip.deliveredAt = iso(addDays(plannedTime, 0));
        trip.deliveredQuantity = qty;
        trip.receiverName = site!.contactPerson;
        po.deliveredQuantity += qty;
      }

      trips.push(trip);
    }

    if (po.deliveredQuantity >= po.quantity) po.status = "COMPLETED";
    else if (po.status === "COMPLETED" && po.deliveredQuantity > 0) po.status = "IN_PROGRESS";

    if (po.deliveredQuantity > 0 && day > 3) {
      invSeq += 1;
      const amount = Math.round(po.deliveredQuantity * po.ratePerCum * 1.18);
      const issue = addDays(date, 1);
      const due = addDays(issue, customer.creditDays);
      const roll = rand();
      let paid = 0;
      let status2: Invoice["status"] = "ISSUED";
      if (roll > 0.62) {
        paid = amount;
        status2 = "PAID";
      } else if (roll > 0.35) {
        paid = Math.round(amount * 0.45);
        status2 = "PARTIALLY_PAID";
      } else if (due < today) {
        status2 = "OVERDUE";
      }
      const invId = `INV-2026-${String(invSeq).padStart(4, "0")}`;
      invoices.push({
        id: invId,
        invoiceNumber: invId,
        poId,
        customerId: customer.id,
        issueDate: dateOnly(issue),
        dueDate: dateOnly(due),
        amount,
        paid,
        status: status2,
        tripIds: trips.filter((t) => t.poId === poId && t.status === "DELIVERED").map((t) => t.id),
      });
      if (paid > 0) {
        payments.push({
          id: `PAY-${invId}`,
          invoiceId: invId,
          amount: paid,
          paidDate: dateOnly(addDays(issue, between(2, 20))),
          mode: pick(["Bank Transfer", "Cheque", "UPI"]),
          reference: `TXN${between(100000, 999999)}`,
        });
      }
    }
  }
}

export const materialTests: MaterialTest[] = [
  {
    id: "MT-001",
    material: "Cement",
    test: "Fineness",
    result: "3.2% retained",
    testDate: dateOnly(subDays(today, 1)),
    remarks: "Within IS 269 limits",
  },
  {
    id: "MT-002",
    material: "Sand",
    test: "Moisture",
    result: "4.1%",
    testDate: dateOnly(subDays(today, 1)),
    remarks: "Batch water corrected by 16 ltr/cum",
  },
  {
    id: "MT-003",
    material: "Aggregate 20mm",
    test: "Oven Test",
    result: "0.6% absorption",
    testDate: dateOnly(subDays(today, 2)),
    remarks: "Acceptable",
  },
  {
    id: "MT-004",
    material: "Aggregate 10mm",
    test: "Sieve Analysis",
    result: "Zone II conforming",
    testDate: dateOnly(subDays(today, 3)),
    remarks: "No correction required",
  },
  {
    id: "MT-005",
    material: "Admixture",
    test: "Specific Gravity",
    result: "1.08",
    testDate: dateOnly(subDays(today, 5)),
    remarks: "As per supplier datasheet",
  },
];

const recentTrips = trips.slice(-6).reverse();
recentTrips.forEach((t, i) => {
  auditLog.push({
    id: `AUD-${i}`,
    at: iso(subDays(today, 0)),
    actor: ["QA", "Production", "Dispatcher", "Sales Manager", "Dispatcher", "Sales"][i % 6]!,
    message: [
      `approved Trip ${t.tripNumber}`,
      `generated Batch Sheet for ${t.tripNumber}`,
      `assigned ${t.tmId ?? "TM-08"} to ${t.tripNumber}`,
      `approved ${t.poId}`,
      `released ${t.tripNumber} for dispatch`,
      `created ${t.poId}`,
    ][i % 6]!,
    entity: t.tripNumber,
  });
});

export const notifications: AppNotification[] = [
  {
    id: "N1",
    at: iso(today),
    title: "QC rejected",
    description: "Slump out of range on TRIP-2026-00231 — replacement trip required.",
    kind: "error",
    read: false,
    roles: ["owner", "dispatcher", "qa", "production"],
  },
  {
    id: "N2",
    at: iso(today),
    title: "Batch ready for QC",
    description: "Batch sheet generated for TRIP-2026-00233.",
    kind: "info",
    read: false,
    roles: ["qa", "production", "dispatcher", "owner"],
  },
  {
    id: "N3",
    at: iso(today),
    title: "PO approved",
    description: "PO-2026-0102 approved and sent to Dispatch.",
    kind: "success",
    read: false,
    roles: ["sales", "sales_manager", "dispatcher", "owner"],
  },
  {
    id: "N4",
    at: iso(subDays(today, 1)),
    title: "Invoice overdue",
    description: "INV-2026-0018 crossed its due date.",
    kind: "warning",
    read: true,
    roles: ["owner", "sales", "sales_manager", "customer"],
  },
  {
    id: "N5",
    at: iso(subDays(today, 1)),
    title: "Trip delivered",
    description: "TRIP-2026-00228 delivered — 8 cum received at site.",
    kind: "success",
    read: true,
    roles: ["owner", "dispatcher", "customer", "sales"],
  },
];
