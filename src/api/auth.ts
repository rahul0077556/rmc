import { respond, fail } from "./client";
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
    name: "Rahul Wagh",
    home: "/owner",
  },
  {
    role: "sales",
    label: "Sales",
    email: "sales@rmc.test",
    password: DEMO_PASSWORD,
    name: "Anita Rao",
    home: "/sales",
  },
  {
    role: "sales_manager",
    label: "Sales Manager",
    email: "salesmanager@rmc.test",
    password: DEMO_PASSWORD,
    name: "Vikram Joshi",
    home: "/sales/approvals",
  },
  {
    role: "dispatcher",
    label: "Dispatcher",
    email: "dispatcher@rmc.test",
    password: DEMO_PASSWORD,
    name: "Kiran Salvi",
    home: "/dispatcher",
  },
  {
    role: "production",
    label: "Production",
    email: "production@rmc.test",
    password: DEMO_PASSWORD,
    name: "Sandeep Kale",
    home: "/production",
  },
  {
    role: "qa",
    label: "QA / QC",
    email: "qa@rmc.test",
    password: DEMO_PASSWORD,
    name: "Meera Iyer",
    home: "/qa",
  },
  {
    role: "customer",
    label: "Customer",
    email: "customer1@rmc.test",
    password: DEMO_PASSWORD,
    name: "Suresh Menon",
    customerId: "CUS-01",
    home: "/portal",
  },
  {
    role: "customer",
    label: "Customer (Shree Developers)",
    email: "customer2@rmc.test",
    password: DEMO_PASSWORD,
    name: "Nikhil Deshpande",
    customerId: "CUS-02",
    home: "/portal",
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
  return DEMO_ACCOUNTS.find((a) => a.role === role)?.home ?? "/owner";
}

export function customerName(customerId?: string): string {
  return customers.find((c) => c.id === customerId)?.name ?? "";
}

export const authApi = {
  login(email: string, password: string): Promise<ApiResponse<User>> {
    const account = DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
    if (!account || password !== account.password) {
      return fail<User>(401, "Invalid email or password. Use a demo account below.");
    }
    return respond(accountToUser(account), "Signed in");
  },
  logout(): Promise<ApiResponse<null>> {
    return respond(null, "Signed out");
  },
};
