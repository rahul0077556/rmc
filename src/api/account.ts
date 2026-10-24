import { apiClient, request, type ApiResponse } from "./client";

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
  period: string; // e.g., "Oct 2026"
  totalEmployees: number;
  totalAmount: number;
  status: "DRAFT" | "PROCESSING" | "PAID";
  processedDate?: string;
}

export interface PayrollSummary {
  activeEmployees: number;
  monthlyPayroll: number;
  nextPayday: string;
}

export const accountApi = {
  employees: async (): Promise<ApiResponse<Employee[]>> => {
    try {
      return await request<Employee[]>({ url: "/account/employees", method: "GET" });
    } catch {
      return { data: fallbackEmployees() };
    }
  },

  addEmployee: async (emp: Omit<Employee, "id"> & { id?: string }): Promise<ApiResponse<Employee>> => {
    return await request<Employee>({ url: "/account/employees", method: "POST", data: emp });
  },

  payroll: async (): Promise<ApiResponse<PayrollRun[]>> => {
    try {
      return await request<PayrollRun[]>({ url: "/account/payroll", method: "GET" });
    } catch {
      return { data: fallbackPayroll() };
    }
  },

  createPayroll: async (period?: string): Promise<ApiResponse<PayrollRun>> => {
    return await request<PayrollRun>({ url: "/account/payroll", method: "POST", data: { period } });
  },

  summary: async (): Promise<ApiResponse<PayrollSummary>> => {
    try {
      return await request<PayrollSummary>({ url: "/account/summary", method: "GET" });
    } catch {
      const emps = fallbackEmployees();
      const active = emps.filter((e) => e.status === "ACTIVE");
      return {
        data: {
          activeEmployees: active.length,
          monthlyPayroll: active.reduce((sum, e) => sum + e.baseSalary, 0),
          nextPayday: "31 Oct, 2026",
        },
      };
    }
  },
};

function fallbackEmployees(): Employee[] {
  return [
    { id: "EMP001", name: "Vikramaditya Singhania", department: "Management", role: "Owner / Managing Director", joinDate: "2020-01-15", status: "ACTIVE", baseSalary: 180000 },
    { id: "EMP002", name: "Devendra Kulkarni", department: "Sales", role: "Sales Manager", joinDate: "2021-03-10", status: "ACTIVE", baseSalary: 85000 },
    { id: "EMP003", name: "Dr. Pradeep Sawant", department: "Quality", role: "QA Lead", joinDate: "2021-06-22", status: "ACTIVE", baseSalary: 75000 },
    { id: "EMP004", name: "Siddharth Joshi", department: "Production", role: "Batching Head", joinDate: "2020-11-05", status: "ACTIVE", baseSalary: 65000 },
    { id: "EMP005", name: "Mahesh Deshpande", department: "Logistics", role: "Dispatcher Lead", joinDate: "2022-02-14", status: "ACTIVE", baseSalary: 60000 },
    { id: "EMP006", name: "Rajesh Gupta", department: "Store", role: "Store & Weighbridge Manager", joinDate: "2022-08-01", status: "ACTIVE", baseSalary: 50000 },
    { id: "EMP007", name: "Priya Nair", department: "Accounts", role: "HR & Payroll Lead", joinDate: "2022-09-15", status: "ACTIVE", baseSalary: 55000 },
    { id: "EMP008", name: "Ananya Sharma", department: "Sales", role: "Sales Officer", joinDate: "2023-01-10", status: "ACTIVE", baseSalary: 45000 },
  ];
}

function fallbackPayroll(): PayrollRun[] {
  return [
    { id: "PR202609", period: "Sep 2026", totalEmployees: 8, totalAmount: 615000, status: "PAID", processedDate: "2026-09-30T10:00:00Z" },
    { id: "PR202610", period: "Oct 2026", totalEmployees: 8, totalAmount: 615000, status: "DRAFT" },
  ];
}
