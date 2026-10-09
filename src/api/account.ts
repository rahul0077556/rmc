import { getDb, saveDb } from "@/lib/store";
import { type ApiResponse } from "./client";
import { delay } from "@/lib/utils";

export interface Employee {
  id: string;
  name: string;
  department: string;
  role: string;
  joinDate: string;
  status: "ACTIVE" | "INACTIVE";
  baseSalary: number;
}

export interface PayrollRun {
  id: string;
  period: string; // e.g., "Oct 2023"
  totalEmployees: number;
  totalAmount: number;
  status: "DRAFT" | "PROCESSING" | "PAID";
  processedDate?: string;
}

export const accountApi = {
  employees: async (): Promise<ApiResponse<Employee[]>> => {
    await delay();
    return { data: getDb().employees ?? fallbackEmployees() };
  },

  payroll: async (): Promise<ApiResponse<PayrollRun[]>> => {
    await delay();
    return { data: getDb().payroll ?? fallbackPayroll() };
  },

  summary: async (): Promise<ApiResponse<{ activeEmployees: number; monthlyPayroll: number; nextPayday: string }>> => {
    await delay();
    const emps = getDb().employees ?? fallbackEmployees();
    const active = emps.filter((e) => e.status === "ACTIVE");
    const payroll = active.reduce((sum, e) => sum + e.baseSalary, 0);
    return {
      data: {
        activeEmployees: active.length,
        monthlyPayroll: payroll,
        nextPayday: "31 Oct, 2023", // mock
      },
    };
  }
};

function fallbackEmployees(): Employee[] {
  return [
    { id: "EMP001", name: "Rahul Wagh", department: "Management", role: "Owner", joinDate: "2020-01-15", status: "ACTIVE", baseSalary: 150000 },
    { id: "EMP002", name: "Amit Kumar", department: "Sales", role: "Sales Manager", joinDate: "2021-03-10", status: "ACTIVE", baseSalary: 85000 },
    { id: "EMP003", name: "Priya Sharma", department: "Quality", role: "QA Engineer", joinDate: "2021-06-22", status: "ACTIVE", baseSalary: 65000 },
    { id: "EMP004", name: "Vikram Singh", department: "Production", role: "Batching Operator", joinDate: "2020-11-05", status: "ACTIVE", baseSalary: 55000 },
    { id: "EMP005", name: "Suresh Patil", department: "Logistics", role: "Dispatcher", joinDate: "2022-02-14", status: "ACTIVE", baseSalary: 60000 },
    { id: "EMP006", name: "Nitin Desai", department: "Store", role: "Store Manager", joinDate: "2022-08-01", status: "ACTIVE", baseSalary: 50000 },
    { id: "EMP007", name: "Manoj Tiwari", department: "Logistics", role: "Driver", joinDate: "2023-01-10", status: "ACTIVE", baseSalary: 35000 },
    { id: "EMP008", name: "Rakesh Yadav", department: "Logistics", role: "Driver", joinDate: "2023-01-15", status: "ACTIVE", baseSalary: 35000 },
  ];
}

function fallbackPayroll(): PayrollRun[] {
  return [
    { id: "PR202309", period: "Sep 2023", totalEmployees: 8, totalAmount: 535000, status: "PAID", processedDate: "2023-09-30T10:00:00Z" },
    { id: "PR202310", period: "Oct 2023", totalEmployees: 8, totalAmount: 535000, status: "DRAFT" },
  ];
}
