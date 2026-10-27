import { apiClient, respond, fail, TOKEN_STORAGE_KEY } from "./client";
import { PLANT_NAME, customers } from "@/lib/mock-data";
import type { ApiResponse, Role, User } from "@/types";

export interface DemoAccount {
  role: Role;
  label: string;
  email: string;
  password: string;
  name: string;
  customerId?: string;
  home: string;
}

export const DEMO_PASSWORD = "Demo@123";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "owner",
    label: "Owner",
    email: "owner@rmc.test",
    password: DEMO_PASSWORD,
    name: "Vikramaditya Singhania",
    home: "/queue",
  },
  {
    role: "sales",
    label: "Sales",
    email: "sales@rmc.test",
    password: DEMO_PASSWORD,
    name: "Ananya Sharma",
    home: "/queue",
  },
  {
    role: "sales_manager",
    label: "Sales Manager",
    email: "salesmanager@rmc.test",
    password: DEMO_PASSWORD,
    name: "Devendra Kulkarni",
    home: "/queue",
  },
  {
    role: "dispatcher",
    label: "Dispatcher",
    email: "dispatcher@rmc.test",
    password: DEMO_PASSWORD,
    name: "Mahesh Deshpande",
    home: "/queue",
  },
  {
    role: "production",
    label: "Production",
    email: "production@rmc.test",
    password: DEMO_PASSWORD,
    name: "Siddharth Joshi",
    home: "/queue",
  },
  {
    role: "qa",
    label: "QA / QC",
    email: "qa@rmc.test",
    password: DEMO_PASSWORD,
    name: "Dr. Pradeep Sawant",
    home: "/queue",
  },
  {
    role: "store",
    label: "Store & Weighbridge",
    email: "store@rmc.test",
    password: DEMO_PASSWORD,
    name: "Rajesh Gupta",
    home: "/queue",
  },
  {
    role: "account",
    label: "Account (HR/Payroll)",
    email: "account@rmc.test",
    password: DEMO_PASSWORD,
    name: "Priya Nair",
    home: "/queue",
  },
  {
    role: "supervisor",
    label: "Site Supervisor",
    email: "supervisor@rmc.test",
    password: DEMO_PASSWORD,
    name: "Santosh Shinde",
    home: "/queue",
  },
  {
    role: "customer",
    label: "Customer (Kirloskar Infra)",
    email: "customer1@rmc.test",
    password: DEMO_PASSWORD,
    name: "Rajiv Deshmukh",
    customerId: "CUS-01",
    home: "/queue",
  },
  {
    role: "customer",
    label: "Customer (VTP Realty)",
    email: "customer2@rmc.test",
    password: DEMO_PASSWORD,
    name: "Sanjay Chordiya",
    customerId: "CUS-02",
    home: "/queue",
  },
];

export function accountToUser(account: DemoAccount): User {
  return {
    id: account.email,
    name: account.name,
    email: account.email,
    role: account.role,
    customerId: account.customerId,
    plant: PLANT_NAME,
  };
}

export function homeForRole(role: Role): string {
  return "/queue";
}

export function customerName(customerId?: string): string {
  return customers.find((c) => c.id === customerId)?.name ?? "";
}

export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<User>> {
    try {
      // Call Flask Backend
      const res = await apiClient.post("/auth/login", { email, password });
      const { token, user } = res.data.data;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
      return {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          customerId: user.customer_id,
          plant: user.plant || PLANT_NAME,
        },
        message: "Signed in successfully",
      };
    } catch {
      // Graceful fallback for mock mode if backend server is not running
      const account = DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
      if (!account || password !== account.password) {
        return fail<User>(401, "Invalid email or password. Use a demo account below.");
      }
      return respond(accountToUser(account), "Signed in (demo)");
    }
  },

  async logout(): Promise<ApiResponse<null>> {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem("rmc.session");
    }
    return respond(null, "Signed out");
  },

  async me(): Promise<ApiResponse<User | null>> {
    try {
      const res = await apiClient.get("/auth/me");
      const user = res.data.data;
      return {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          customerId: user.customer_id,
          plant: user.plant || PLANT_NAME,
        },
      };
    } catch {
      return respond(null);
    }
  },
};
