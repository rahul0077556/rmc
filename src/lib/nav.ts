import {
  BarChart3,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  Users,
  Warehouse,
  Landmark,
  Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  group: "Operations" | "Commercial" | "Insights";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Plant Overview", to: "/owner", icon: LayoutDashboard, roles: ["owner"], group: "Operations" },
  { label: "Sales Desk", to: "/sales", icon: Gauge, roles: ["sales", "sales_manager"], group: "Operations" },
  { label: "Purchase Orders", to: "/sales/orders", icon: FileText, roles: ["sales", "sales_manager", "owner"], group: "Commercial" },
  { label: "Customers", to: "/sales/customers", icon: Users, roles: ["sales", "sales_manager", "owner"], group: "Commercial" },
  { label: "Approvals", to: "/sales/approvals", icon: ClipboardCheck, roles: ["sales_manager"], group: "Operations" },
  { label: "Dispatch Control", to: "/dispatcher", icon: Truck, roles: ["dispatcher", "owner"], group: "Operations" },
  { label: "Production Queue", to: "/production", icon: Package, roles: ["production", "owner"], group: "Operations" },
  { label: "QA / QC", to: "/qa", icon: FlaskConical, roles: ["qa", "owner"], group: "Operations" },
  { label: "Store & Weighbridge", to: "/store", icon: Warehouse, roles: ["store", "owner"], group: "Operations" },
  { label: "My Orders", to: "/portal", icon: LayoutDashboard, roles: ["customer"], group: "Operations" },
  { label: "Billing", to: "/billing", icon: Receipt, roles: ["owner", "sales", "sales_manager", "dispatcher"], group: "Commercial" },
  { label: "Account (HR/Payroll)", to: "/account", icon: Landmark, roles: ["account", "owner"], group: "Commercial" },
  { label: "Reports", to: "/reports", icon: BarChart3, roles: ["sales_manager", "production", "qa", "dispatcher"], group: "Insights" },
  { label: "AI Insights", to: "/insights", icon: Sparkles, roles: ["owner", "customer", "sales", "sales_manager", "dispatcher", "production", "qa", "store", "account"], group: "Insights" },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  customer: "Customer",
  sales: "Sales",
  sales_manager: "Sales Manager",
  dispatcher: "Dispatcher",
  production: "Production",
  qa: "QA / QC",
  store: "Store Manager",
  account: "Accountant"
};
