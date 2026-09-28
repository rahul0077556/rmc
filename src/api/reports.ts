import { respond } from "./client";
import { db } from "@/lib/store";
import type { ApiResponse } from "@/types";

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  group: "Production" | "Quality" | "Materials" | "Commercial";
}

export const REPORTS: ReportDefinition[] = [
  { id: "daily-production", title: "Daily Production / Batch Report", description: "Every batch produced per day with grade and quantity.", group: "Production" },
  { id: "material-consumption", title: "Material Consumption Report", description: "Cement, sand, aggregate and admixture consumed.", group: "Materials" },
  { id: "theoretical-actual", title: "Theoretical vs Actual Consumption", description: "Batch-wise variance against mix design.", group: "Materials" },
  { id: "batch-register", title: "Batch Sheet Register", description: "Register of all generated batch sheets.", group: "Production" },
  { id: "cube-strength", title: "Cube Strength Report", description: "3 / 7 / 28 day compressive strength results.", group: "Quality" },
  { id: "cube-schedule", title: "Cube Testing Schedule", description: "Upcoming and overdue cube tests.", group: "Quality" },
  { id: "tm-quality", title: "TM Quality Check Report", description: "Slump, bleeding and inspection outcomes per TM.", group: "Quality" },
  { id: "rejected-tm", title: "Rejected / Corrected TM Report", description: "Rejections with corrective action taken.", group: "Quality" },
  { id: "grade-summary", title: "Grade-wise Production Summary", description: "Volume produced by concrete grade.", group: "Production" },
  { id: "customer-supply", title: "Customer-wise Supply Report", description: "Quantity supplied against each customer PO.", group: "Commercial" },
  { id: "material-stock", title: "Material Stock Report", description: "Closing stock of all raw materials.", group: "Materials" },
  { id: "admixture", title: "Admixture Addition Report", description: "Admixture dosage per batch.", group: "Materials" },
  { id: "challan-register", title: "Delivery Challan Register", description: "All challans issued with dispatch times.", group: "Commercial" },
];

export interface ReportResult {
  columns: string[];
  rows: (string | number)[][];
}

export const reportsApi = {
  definitions(): Promise<ApiResponse<ReportDefinition[]>> {
    return respond(REPORTS);
  },

  run(id: string, from: string, to: string): Promise<ApiResponse<ReportResult>> {
    const inRange = (d: string) => d.slice(0, 10) >= from && d.slice(0, 10) <= to;

    switch (id) {
      case "material-stock":
        return respond({
          columns: ["Material", "Available", "Unit"],
          rows: db.materialStock.map((m) => [m.material, m.available, m.unit]),
        });
      case "cube-strength":
        return respond({
          columns: ["Batch Sheet", "Grade", "Age", "Due Date", "Tested On", "Strength (MPa)", "Result"],
          rows: db.cubeTests
            .filter((c) => inRange(c.dueDate))
            .map((c) => [c.batchSheetId, c.grade, `${c.age} day`, c.dueDate, c.testedOn ?? "—", c.strength ?? "—", c.result]),
        });
      case "grade-summary": {
        const map = new Map<string, number>();
        db.purchaseOrders.forEach((p) => map.set(p.grade, (map.get(p.grade) ?? 0) + p.deliveredQuantity));
        return respond({
          columns: ["Grade", "Quantity Delivered (cum)"],
          rows: [...map.entries()].sort().map(([g, q]) => [g, q]),
        });
      }
      case "customer-supply": {
        const map = new Map<string, { ordered: number; delivered: number }>();
        db.purchaseOrders.forEach((p) => {
          const name = db.customers.find((c) => c.id === p.customerId)?.name ?? "—";
          const cur = map.get(name) ?? { ordered: 0, delivered: 0 };
          map.set(name, { ordered: cur.ordered + p.quantity, delivered: cur.delivered + p.deliveredQuantity });
        });
        return respond({
          columns: ["Customer", "Ordered (cum)", "Delivered (cum)", "Balance (cum)"],
          rows: [...map.entries()].map(([n, v]) => [n, v.ordered, v.delivered, v.ordered - v.delivered]),
        });
      }
      case "challan-register":
        return respond({
          columns: ["Challan", "Trip", "PO", "TM", "Dispatch Time", "Quantity"],
          rows: db.trips
            .filter((t) => t.challanNumber && inRange(t.dispatchTime ?? ""))
            .map((t) => [t.challanNumber!, t.tripNumber, t.poId, t.tmId ?? "—", t.dispatchTime?.slice(0, 16).replace("T", " ") ?? "—", t.quantity]),
        });
      case "rejected-tm":
        return respond({
          columns: ["Trip", "Batch Sheet", "Slump (mm)", "Action", "Remarks", "Checked By"],
          rows: db.qcChecks
            .filter((q) => q.decision === "REJECTED")
            .map((q) => [q.tripId, q.batchSheetId, q.slump, q.rejectionAction ?? "—", q.remarks, q.checkedBy]),
        });
      case "tm-quality":
        return respond({
          columns: ["Trip", "Slump (mm)", "Physical", "Bleeding", "Wrong Mix", "Decision", "Checked At"],
          rows: db.qcChecks
            .filter((q) => inRange(q.checkedAt))
            .map((q) => [q.tripId, q.slump, q.physicalInspection, q.bleeding, q.wrongMix, q.decision, q.checkedAt.slice(0, 10)]),
        });
      case "admixture":
        return respond({
          columns: ["Batch Sheet", "Admixture", "Quantity (kg)", "Checked At"],
          rows: db.qcChecks
            .filter((q) => inRange(q.checkedAt))
            .map((q) => [q.batchSheetId, q.admixtureType, q.admixtureQuantity, q.checkedAt.slice(0, 10)]),
        });
      case "theoretical-actual":
        return respond({
          columns: ["Batch Sheet", "Material", "Theoretical", "Actual", "Variance %"],
          rows: db.batchSheets
            .filter((b) => inRange(b.batchTime))
            .flatMap((b) =>
              b.materials.map((m) => [
                b.batchNumber,
                m.material,
                m.theoretical,
                m.actual,
                Math.round(((m.actual - m.theoretical) / (m.theoretical || 1)) * 1000) / 10,
              ]),
            ),
        });
      case "material-consumption": {
        const map = new Map<string, number>();
        db.batchSheets
          .filter((b) => inRange(b.batchTime))
          .forEach((b) => b.materials.forEach((m) => map.set(m.material, (map.get(m.material) ?? 0) + m.actual)));
        return respond({
          columns: ["Material", "Consumed"],
          rows: [...map.entries()].map(([m, v]) => [m, Math.round(v)]),
        });
      }
      case "cube-schedule":
        return respond({
          columns: ["Batch Sheet", "Grade", "Cast Date", "Age", "Due Date", "Status"],
          rows: db.cubeTests
            .filter((c) => c.result === "PENDING" || c.result === "OVERDUE")
            .map((c) => [c.batchSheetId, c.grade, c.castDate, `${c.age} day`, c.dueDate, c.result]),
        });
      case "batch-register":
      case "daily-production":
      default:
        return respond({
          columns: ["Batch Sheet", "Trip", "Batch Time", "Operator", "QC Status"],
          rows: db.batchSheets
            .filter((b) => inRange(b.batchTime))
            .map((b) => [b.batchNumber, b.tripId, b.batchTime.slice(0, 16).replace("T", " "), b.operator, b.qcStatus]),
        });
    }
  },
};

export function toCsv(result: ReportResult): string {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [result.columns.map(escape).join(","), ...result.rows.map((r) => r.map(escape).join(","))].join("\n");
}
