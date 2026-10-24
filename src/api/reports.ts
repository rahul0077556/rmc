import { request } from "./client";
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

const REPORT_KEY_MAP: Record<string, string> = {
  "daily-production": "daily_production",
  "material-consumption": "material_consumption",
  "theoretical-actual": "theoretical_vs_actual",
  "batch-register": "batch_sheet_register",
  "cube-strength": "cube_strength",
  "cube-schedule": "cube_schedule",
  "tm-quality": "tm_qc_checks",
  "rejected-tm": "rejected_tms",
  "grade-summary": "gradewise_production",
  "customer-supply": "customer_supply",
  "material-stock": "material_stock",
  "admixture": "admixture_addition",
  "challan-register": "challan_register",
};

export interface ReportResult {
  columns: string[];
  rows: (string | number)[][];
}

export const reportsApi = {
  async definitions(): Promise<ApiResponse<ReportDefinition[]>> {
    return { data: REPORTS };
  },

  async run(id: string, from: string, to: string): Promise<ApiResponse<ReportResult>> {
    const backendKey = REPORT_KEY_MAP[id] || id.replace(/-/g, "_");
    const res = await request<any>({
      url: `/reports/${backendKey}?from=${from}&to=${to}`,
      method: "GET",
    });

    const result = res.data;
    return {
      data: {
        columns: result?.columns || ["Column 1", "Column 2"],
        rows: result?.rows || [],
      },
    };
  },
};

export function toCsv(result: ReportResult): string {
  const header = result.columns.join(",");
  const rows = result.rows.map((row) =>
    row
      .map((cell) => {
        const str = String(cell ?? "");
        return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(","),
  );
  return [header, ...rows].join("\n");
}

