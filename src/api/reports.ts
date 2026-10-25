import { request, apiClient } from "./client";
import type { ApiResponse } from "@/types";

export type ReportDepartment = "All" | "Store" | "Dispatch" | "HR" | "QA/QC";

export interface ReportDefinition {
  id: string;
  backendKey: string;
  title: string;
  description: string;
  department: "Store" | "Dispatch" | "HR" | "QA/QC";
  departments: ("Store" | "Dispatch" | "HR" | "QA/QC")[]; // supports multiple depts like 12 (Dispatch & QA/QC)
}

export const REPORTS: ReportDefinition[] = [
  // STORE SECTION
  {
    id: "mpr-report",
    backendKey: "mpr_report",
    title: "MPR Report (Store)",
    description: "Material Purchase & Requisition Report (Opening stock, Receipts, Plant Consumption, Closing Stock, Reorder Level)",
    department: "Store",
    departments: ["Store"],
  },
  {
    id: "hr-report-store",
    backendKey: "hr_report_store",
    title: "HR Report (Store)",
    description: "Driver & Transit Mixer monthly trip performance, diesel average, and trip incentive summary (As per MUL HR Reports)",
    department: "Store",
    departments: ["Store", "HR"],
  },
  {
    id: "tm-average-report",
    backendKey: "tm_average_report",
    title: "TM Average Report (Store)",
    description: "Vehicle running kilometers, handi rotating hours, diesel consumption & fuel mileage reconciliation (As per MUL TM Average Summary)",
    department: "Store",
    departments: ["Store"],
  },

  // DISPATCH SECTION
  {
    id: "schedule-and-production",
    backendKey: "schedule_and_production",
    title: "Schedule and Production",
    description: "Daily dispatch schedules vs plant batching performance, lead times and pour milestones",
    department: "Dispatch",
    departments: ["Dispatch"],
  },
  {
    id: "zone-02-pump",
    backendKey: "zone_02_pump",
    title: "Zone 02 Pump Report",
    description: "Concrete boom pump & stationary line pump utilization, pipeline lengths, pumping speed and revenue in Zone 02",
    department: "Dispatch",
    departments: ["Dispatch"],
  },
  {
    id: "daywise-production",
    backendKey: "daywise_production",
    title: "Day Wise Production Report",
    description: "Day-wise plant concrete production breakdown across grades M15–M40 and special mixes",
    department: "Dispatch",
    departments: ["Dispatch", "QA/QC"],
  },

  // HR SECTION
  {
    id: "staff-attendance",
    backendKey: "staff_attendance",
    title: "Staff Attendance",
    description: "Daily plant operational, management and lab staff biometric attendance roster",
    department: "HR",
    departments: ["HR"],
  },
  {
    id: "sunday-working",
    backendKey: "sunday_working",
    title: "Sunday Working",
    description: "Sunday, weekend and statutory holiday operational duty, overtime hours and comp-off ledger",
    department: "HR",
    departments: ["HR"],
  },
  {
    id: "mul-attendance",
    backendKey: "mul_attendance",
    title: "MUL Attendance",
    description: "Mulkhed Plant workforce, drivers and helpers daily muster roll & asset assignment",
    department: "HR",
    departments: ["HR"],
  },

  // QA/QC SECTION
  {
    id: "strength-data-since",
    backendKey: "strength_data_since",
    title: "Strength Data Since",
    description: "Cumulative concrete compressive strength results (3/7/28-day tests) vs IS 456 target characteristic strength",
    department: "QA/QC",
    departments: ["QA/QC"],
  },
  {
    id: "consumption-crb75",
    backendKey: "consumption_crb75",
    title: "Consumption CRB-75 Plant",
    description: "Raw material batch consumption, moisture correction and telemetry for CRB-75 Plant",
    department: "QA/QC",
    departments: ["QA/QC"],
  },
  {
    id: "consumption-sp30",
    backendKey: "consumption_sp30",
    title: "Consumption SP-30 Plant",
    description: "Raw material batch consumption and design variance reconciliation for SP-30 Batching Plant",
    department: "QA/QC",
    departments: ["QA/QC"],
  },
  {
    id: "material-rejected",
    backendKey: "material_rejected",
    title: "Material Rejected Report",
    description: "Log of non-conforming batches, rejected transit mixer slurries, and quarry raw material gate rejections",
    department: "QA/QC",
    departments: ["QA/QC", "Store"],
  },
];

export function getReportsForRole(role?: string): ReportDefinition[] {
  if (!role || role === "owner") return REPORTS;
  if (role === "store") return REPORTS.filter((r) => r.departments.includes("Store"));
  if (role === "dispatcher") return REPORTS.filter((r) => r.departments.includes("Dispatch"));
  if (role === "account") return REPORTS.filter((r) => r.departments.includes("HR"));
  if (role === "qa") return REPORTS.filter((r) => r.departments.includes("QA/QC"));
  if (role === "production") {
    return REPORTS.filter((r) =>
      ["schedule-and-production", "consumption-crb75", "consumption-sp30", "daywise-production"].includes(r.id)
    );
  }
  if (role === "sales" || role === "sales_manager") {
    return REPORTS.filter((r) =>
      ["schedule-and-production", "daywise-production", "zone-02-pump"].includes(r.id)
    );
  }
  return REPORTS;
}

export const REPORT_KEY_MAP: Record<string, string> = Object.fromEntries(
  REPORTS.map((r) => [r.id, r.backendKey])
);

export interface ReportResult {
  columns: string[];
  rows: (string | number)[][];
  totalRows?: number;
  from?: string;
  to?: string;
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
        totalRows: result?.totalRows,
        from: result?.from,
        to: result?.to,
      },
    };
  },

  async downloadExcel(id: string, from: string, to: string, filename: string): Promise<void> {
    const backendKey = REPORT_KEY_MAP[id] || id.replace(/-/g, "_");
    const response = await apiClient.get(`/reports/${backendKey}?from=${from}&to=${to}&format=xlsx`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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
