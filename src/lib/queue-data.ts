import { useState, useEffect } from "react";
import type { Role } from "@/types";

export type QueueUrgency = "urgent" | "attention" | "standard" | "scheduled";

export interface QueueItem {
  id: string;
  role: Role;
  title: string;
  subtitle: string;
  category: string;
  urgency: QueueUrgency;
  urgencyLabel: string;
  badgeText?: string;
  badgeVariant?: "destructive" | "warning" | "success" | "outline" | "default";
  metrics?: { label: string; value: string }[];
  actionLabel: string;
  actionTo: string;
  actionState?: Record<string, any>;
  waitingTime: string;
  status: "pending" | "completed";
  dueTime?: string;
}

const STORAGE_KEY = "rmc.my_queue.completed";

function getCompletedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCompletedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/**
 * Baseline Queue Items for each role per real-time plant operations
 */
export const QUEUE_CATALOG: Record<Role, QueueItem[]> = {
  sales: [
    {
      id: "sales-po-01",
      role: "sales",
      title: "Draft PO: Kirloskar Infra · 120 cum M35",
      subtitle: "Metro Line 3 Pier P14 — Customer accepted quotation ₹5,650/cum. Draft ready to submit for manager review.",
      category: "Purchase Order",
      urgency: "urgent",
      urgencyLabel: "Urgent Submission",
      badgeText: "Draft Pending",
      badgeVariant: "destructive",
      metrics: [
        { label: "Grade", value: "M35 Pumping" },
        { label: "Quantity", value: "120 cum" },
        { label: "Est. Value", value: "₹6,78,000" },
      ],
      actionLabel: "Submit PO Now →",
      actionTo: "/sales/orders/new",
      waitingTime: "25m waiting",
      status: "pending",
      dueTime: "By 14:00 today",
    },
    {
      id: "sales-po-02",
      role: "sales",
      title: "PO Draft: VTP Realty · 80 cum M25 Raft Pour",
      subtitle: "VTP Pegasus Tower C raft foundation scheduled tomorrow at 06:00 AM. Requires concrete pump + 10 TMs.",
      category: "Draft Order",
      urgency: "attention",
      urgencyLabel: "Action Needed",
      badgeText: "Scheduled Tomorrow",
      badgeVariant: "warning",
      metrics: [
        { label: "Grade", value: "M25" },
        { label: "Volume", value: "80 cum" },
        { label: "Site", value: "Kharadi, Pune" },
      ],
      actionLabel: "Finalize & Submit →",
      actionTo: "/sales/orders/new",
      waitingTime: "1h 10m ago",
      status: "pending",
      dueTime: "By 16:30 today",
    },
    {
      id: "sales-po-03",
      role: "sales",
      title: "Customer Credit Review: Nyati Builders",
      subtitle: "Nyati Builders has exceeded 85% credit exposure (₹34L / ₹40L limit). Review pending before new PO submission.",
      category: "Credit Line",
      urgency: "standard",
      urgencyLabel: "Credit Check",
      badgeText: "Commercial",
      badgeVariant: "outline",
      metrics: [
        { label: "Used Credit", value: "₹34.2 Lakhs" },
        { label: "Total Limit", value: "₹40.0 Lakhs" },
        { label: "Overdue", value: "₹0" },
      ],
      actionLabel: "Inspect Customer →",
      actionTo: "/sales/customers",
      waitingTime: "2h ago",
      status: "pending",
    },
  ],

  sales_manager: [
    {
      id: "sm-appr-01",
      role: "sales_manager",
      title: "Approve PO #PO-04: Rohan Builders (200 cum M40)",
      subtitle: "Order value ₹12,10,000. Price exception requested: ₹5,900/cum (standard ₹6,050). Margin at 22.4% (>20% min floor).",
      category: "Price Exception",
      urgency: "urgent",
      urgencyLabel: "High Value Approval",
      badgeText: "Margin Override",
      badgeVariant: "destructive",
      metrics: [
        { label: "PO Number", value: "PO-04" },
        { label: "Total Value", value: "₹12,10,000" },
        { label: "Gross Margin", value: "22.4%" },
        { label: "Credit Days", value: "45 Days" },
      ],
      actionLabel: "Review & Sign Off →",
      actionTo: "/sales/approvals",
      waitingTime: "18m waiting",
      status: "pending",
      dueTime: "Batching scheduled 15:30",
    },
    {
      id: "sm-appr-02",
      role: "sales_manager",
      title: "Approve PO #PO-07: Gera Developments (60 cum M25)",
      subtitle: "Customer requested extended slump retention admixture without surcharge. Requires commercial manager waiver.",
      category: "Commercial Waiver",
      urgency: "attention",
      urgencyLabel: "Pending Approval",
      badgeText: "Admixture Waiver",
      badgeVariant: "warning",
      metrics: [
        { label: "PO Number", value: "PO-07" },
        { label: "Volume", value: "60 cum" },
        { label: "Customer", value: "Gera Dev" },
      ],
      actionLabel: "Open Approval Drawer →",
      actionTo: "/sales/approvals",
      waitingTime: "45m ago",
      status: "pending",
    },
    {
      id: "sm-appr-03",
      role: "sales_manager",
      title: "Credit Limit Revision: Shapoorji Pallonji (₹60L)",
      subtitle: "Requesting temporary enhancement from ₹50L to ₹60L for SP Infocity Phase 2 high-volume continuous pour.",
      category: "Credit Line",
      urgency: "standard",
      urgencyLabel: "Review",
      badgeText: "Credit Enhancement",
      badgeVariant: "outline",
      metrics: [
        { label: "Current Limit", value: "₹50 Lakhs" },
        { label: "Requested", value: "₹60 Lakhs" },
        { label: "Payment History", value: "A+ (98% on time)" },
      ],
      actionLabel: "Evaluate Limits →",
      actionTo: "/sales/customers",
      waitingTime: "3h ago",
      status: "pending",
    },
  ],

  dispatcher: [
    {
      id: "disp-plan-01",
      role: "dispatcher",
      title: "Plan Trips: PO #PO-02 · Kirloskar Infra (32 cum M35)",
      subtitle: "Order approved by manager. 0 trips scheduled. 4 Transit Mixers (8 cum each) ready to assign for Hinjewadi Phase 1.",
      category: "Trip Planning",
      urgency: "urgent",
      urgencyLabel: "Unplanned Order",
      badgeText: "4 TMs Needed",
      badgeVariant: "destructive",
      metrics: [
        { label: "Remaining Qty", value: "32 cum" },
        { label: "Grade", value: "M35 Pumping" },
        { label: "Available TMs", value: "6 Mixers" },
        { label: "Distance", value: "14 km (32 min)" },
      ],
      actionLabel: "Plan & Schedule Mixers →",
      actionTo: "/dispatcher/plan/PO-02",
      waitingTime: "12m waiting",
      status: "pending",
      dueTime: "First load required 14:15",
    },
    {
      id: "disp-plan-02",
      role: "dispatcher",
      title: "Concrete Clock Alert: MH-12-RN-1002 (M35)",
      subtitle: "Trip TRIP-01 in transit to Magarpatta City. Discharge limit expires in 14 minutes! Traffic congestion on Kharadi bypass.",
      category: "Hydration Warning",
      urgency: "urgent",
      urgencyLabel: "Flash Set Risk",
      badgeText: "14m Left",
      badgeVariant: "destructive",
      metrics: [
        { label: "TM Code", value: "MH-12-RN-1002" },
        { label: "Driver", value: "Ritesh Shinde" },
        { label: "Limit", value: "110 min" },
        { label: "Action", value: "Expedite Gate Pour" },
      ],
      actionLabel: "Open Dispatch Monitor →",
      actionTo: "/dispatcher",
      waitingTime: "Expiring Now",
      status: "pending",
    },
    {
      id: "disp-plan-03",
      role: "dispatcher",
      title: "Gate Release Pending: MH-12-RN-1003 (8 cum M35)",
      subtitle: "QC inspection approved slump (135mm). Mixer weighed and waiting at security gate for challan release.",
      category: "Gate Clearance",
      urgency: "attention",
      urgencyLabel: "QC Passed",
      badgeText: "Ready at Gate",
      badgeVariant: "success",
      metrics: [
        { label: "TM Code", value: "MH-12-RN-1003" },
        { label: "Challan", value: "CH-2026-1003" },
        { label: "Slump", value: "135 mm (Pass)" },
      ],
      actionLabel: "Release Truck to Site →",
      actionTo: "/dispatcher",
      waitingTime: "6m waiting",
      status: "pending",
    },
  ],

  production: [
    {
      id: "prod-batch-01",
      role: "production",
      title: "Batch Next: Trip #TRIP-05 (8 cum M35) on Plant 1",
      subtitle: "Assigned TM MH-12-RN-1001 positioned under CRB-75 discharge chute. Mix recipe M35_PUMPING loaded.",
      category: "Batch Queue",
      urgency: "urgent",
      urgencyLabel: "Next in Queue",
      badgeText: "Plant 1 (CRB-75)",
      badgeVariant: "destructive",
      metrics: [
        { label: "Batch Volume", value: "8 cum" },
        { label: "Mix Code", value: "M35_STD_PUMP" },
        { label: "Cement Silo", value: "Silo 1 (OPC 53)" },
        { label: "W/C Ratio", value: "0.42" },
      ],
      actionLabel: "Start Batching Sequence →",
      actionTo: "/production",
      waitingTime: "4m waiting",
      status: "pending",
      dueTime: "Pour slot 14:15",
    },
    {
      id: "prod-batch-02",
      role: "production",
      title: "Sign Batch Sheet: Trip #TRIP-04 (M30 · 8 cum)",
      subtitle: "Batching completed with 0.4% aggregate variance (within ±1% tolerance). Operator verification and physical print needed.",
      category: "Batch Sheet",
      urgency: "attention",
      urgencyLabel: "Sign-off Required",
      badgeText: "Batch Done",
      badgeVariant: "warning",
      metrics: [
        { label: "Batch Sheet", value: "BS-2026-1004" },
        { label: "Moisture Comp", value: "+2.1% Sand" },
        { label: "Batch Time", value: "4m 12s" },
      ],
      actionLabel: "View & Print Batch Sheet →",
      actionTo: "/batch-sheet/BS-2026-1004",
      waitingTime: "8m ago",
      status: "pending",
    },
    {
      id: "prod-batch-03",
      role: "production",
      title: "Silo 2 Low Stock Notice (OPC 53 Cement)",
      subtitle: "Current stock is 26.4 MT (reorder threshold 30 MT). Switch Plant 2 feed to Silo 1 to prevent aeration blockage.",
      category: "Plant Maintenance",
      urgency: "standard",
      urgencyLabel: "Stock Alert",
      badgeText: "Silo Bin 2",
      badgeVariant: "outline",
      metrics: [
        { label: "Current Level", value: "26.4 Tons" },
        { label: "Capacity", value: "100 Tons" },
        { label: "Inward Bulker", value: "Reported at WB" },
      ],
      actionLabel: "Check Silo Telemetry →",
      actionTo: "/production",
      waitingTime: "30m ago",
      status: "pending",
    },
  ],

  qa: [
    {
      id: "qa-test-01",
      role: "qa",
      title: "Slump Test Due: TM #MH-12-RN-1004 (M35 Pumping)",
      subtitle: "Fresh batch discharged into transit mixer drum. Lab technician must sample from 0.5 cum mark for cone slump check.",
      category: "Slump Test",
      urgency: "urgent",
      urgencyLabel: "Truck in QC Bay",
      badgeText: "Target: 140±25mm",
      badgeVariant: "destructive",
      metrics: [
        { label: "Trip ID", value: "TRIP-04" },
        { label: "Grade", value: "M35" },
        { label: "Admixture", value: "Sika Plastiment" },
        { label: "Max Slump Time", value: "5 min remaining" },
      ],
      actionLabel: "Record Slump & Approve →",
      actionTo: "/qa",
      waitingTime: "3m waiting",
      status: "pending",
      dueTime: "Immediate gate clearance",
    },
    {
      id: "qa-test-02",
      role: "qa",
      title: "7-Day Cube Compressive Tests Due Today (3 Sets)",
      subtitle: "Set CUBE-104 (M25 Cast 19-Oct) and Set CUBE-105 (M35 Cast 19-Oct) reached 7-day curing. Perform CTM hydraulic break.",
      category: "IS 516 Lab Test",
      urgency: "attention",
      urgencyLabel: "Due Today",
      badgeText: "3 Sets in Tank",
      badgeVariant: "warning",
      metrics: [
        { label: "Standard", value: "IS 516:2021" },
        { label: "Expected 7D", value: "≥ 70% Characteristic" },
        { label: "CTM Calibrated", value: "Valid till Dec 2026" },
      ],
      actionLabel: "Open Lab Register →",
      actionTo: "/qa",
      waitingTime: "Due today 15:00",
      status: "pending",
    },
    {
      id: "qa-test-03",
      role: "qa",
      title: "Aggregate Stockpile Moisture Test (Sand & 10mm)",
      subtitle: "Afternoon temperature reached 34°C. Update rapid moisture meter readings for automated batching compensation.",
      category: "Moisture Compensation",
      urgency: "standard",
      urgencyLabel: "Quality Control",
      badgeText: "Daily Calibration",
      badgeVariant: "outline",
      metrics: [
        { label: "Current Sand Moisture", value: "3.2%" },
        { label: "Water Deduction", value: "-14 ltr/cum" },
      ],
      actionLabel: "Calibrate Moisture →",
      actionTo: "/qa",
      waitingTime: "1h 30m ago",
      status: "pending",
    },
  ],

  store: [
    {
      id: "store-wb-01",
      role: "store",
      title: "Weighbridge Tare Weight: Tipper MH-14-AZ-4412",
      subtitle: "Aggregate 20mm tipper from Maha Quarry finished unloading in Bin 3. Waiting on Weighbridge 1 for empty tare weight.",
      category: "Weighbridge",
      urgency: "urgent",
      urgencyLabel: "Truck on Platform",
      badgeText: "Pending Tare",
      badgeVariant: "destructive",
      metrics: [
        { label: "Vehicle No", value: "MH-14-AZ-4412" },
        { label: "Gross Weight", value: "42,850 kg" },
        { label: "Material", value: "Aggregate 20mm" },
        { label: "Supplier", value: "Maha Stone Crusher" },
      ],
      actionLabel: "Capture Tare Weight →",
      actionTo: "/store",
      waitingTime: "5m on platform",
      status: "pending",
      dueTime: "Clear WB 1 platform",
    },
    {
      id: "store-wb-02",
      role: "store",
      title: "Inbound Bulker at Gate: UltraTech OPC 53 (32 MT)",
      subtitle: "Vehicle MH-46-CL-8921 reported at security gate with factory invoice. Waiting for Gross Weighment and Silo 2 decanting.",
      category: "Gate Inward",
      urgency: "attention",
      urgencyLabel: "Bulker Waiting",
      badgeText: "Cement Bulker",
      badgeVariant: "warning",
      metrics: [
        { label: "Challan Qty", value: "32.40 MT" },
        { label: "Destination Silo", value: "Silo Bin 2" },
        { label: "Supplier", value: "UltraTech Cement Ltd" },
      ],
      actionLabel: "Process Inbound Gross →",
      actionTo: "/store",
      waitingTime: "14m waiting",
      status: "pending",
    },
    {
      id: "store-wb-03",
      role: "store",
      title: "Generate GRN for MPR #MPR-2026-089 (Admixture)",
      subtitle: "Consignment of 4 drums Sika Plastiment BV-40 delivered and inspected by QA. Awaiting Goods Receipt Note generation.",
      category: "Store Inward",
      urgency: "standard",
      urgencyLabel: "GRN Generation",
      badgeText: "PO #MPR-089",
      badgeVariant: "outline",
      metrics: [
        { label: "Item", value: "Sika BV-40 Retarder" },
        { label: "Delivered", value: "800 Liters (4 drums)" },
        { label: "Inspection", value: "QC Verified" },
      ],
      actionLabel: "Generate Inward GRN →",
      actionTo: "/store",
      waitingTime: "40m ago",
      status: "pending",
    },
  ],

  account: [
    {
      id: "acc-pay-01",
      role: "account",
      title: "Process Driver Payroll & Trip Incentives Step",
      subtitle: "October 2026 Transit Mixer Driver Trip Incentive Calculation. 14 Drivers · 462 completed trips · ₹69,300 trip incentives.",
      category: "Driver Payroll",
      urgency: "urgent",
      urgencyLabel: "Payroll Step",
      badgeText: "14 Drivers",
      badgeVariant: "destructive",
      metrics: [
        { label: "Active Drivers", value: "14" },
        { label: "Incentive Rate", value: "₹150 / trip" },
        { label: "Total Incentive", value: "₹69,300" },
        { label: "Pay Period", value: "Oct 2026" },
      ],
      actionLabel: "Execute Payroll Run →",
      actionTo: "/account",
      waitingTime: "Due for pay cycle",
      status: "pending",
      dueTime: "Disbursement scheduled 31st",
    },
    {
      id: "acc-pay-02",
      role: "account",
      title: "Generate GST Tax Invoices: Kirloskar & VTP",
      subtitle: "5 completed dispatches yesterday have signed customer e-Challans. Generate IRN and GST Tax Invoices (Total ₹9,82,000).",
      category: "Customer Billing",
      urgency: "attention",
      urgencyLabel: "Billing Step",
      badgeText: "5 Invoices Ready",
      badgeVariant: "warning",
      metrics: [
        { label: "Pending Value", value: "₹9,82,000" },
        { label: "GST (18%)", value: "₹1,76,760" },
        { label: "Signed Challans", value: "5 / 5 verified" },
      ],
      actionLabel: "Generate GST Invoices →",
      actionTo: "/billing",
      waitingTime: "1h ago",
      status: "pending",
    },
    {
      id: "acc-pay-03",
      role: "account",
      title: "Approve Subcontractor Pump Voucher (Putzmeister 36m)",
      subtitle: "Boom pump operational bill for Pune Metro Pier P14 (120 cum pour). Verified against plant pumping log.",
      category: "Expense Voucher",
      urgency: "standard",
      urgencyLabel: "Voucher Audit",
      badgeText: "Pumping Vendor",
      badgeVariant: "outline",
      metrics: [
        { label: "Vendor", value: "Penta Concrete Pumping" },
        { label: "Pumping Qty", value: "120 cum @ ₹250" },
        { label: "Voucher Amt", value: "₹30,000" },
      ],
      actionLabel: "Audit & Sign Voucher →",
      actionTo: "/billing",
      waitingTime: "2h 15m ago",
      status: "pending",
    },
  ],

  owner: [
    {
      id: "owner-item-01",
      role: "owner",
      title: "Commercial Approval: Rohan Builders (₹12,10,000)",
      subtitle: "200 cum M40 pour pending executive sign-off due to custom price concession. Margin 22.4%.",
      category: "Sales Approval",
      urgency: "urgent",
      urgencyLabel: "High Impact",
      badgeText: "₹12.1 Lakhs",
      badgeVariant: "destructive",
      metrics: [
        { label: "Customer", value: "Rohan Builders" },
        { label: "Margin", value: "22.4%" },
        { label: "Credit", value: "45 Days" },
      ],
      actionLabel: "Review Approval →",
      actionTo: "/sales/approvals",
      waitingTime: "18m waiting",
      status: "pending",
    },
    {
      id: "owner-item-02",
      role: "owner",
      title: "Concrete Clock Transit Alert: MH-12-RN-1002",
      subtitle: "Trip TRIP-01 in transit to Magarpatta City. 14 minutes remaining before initial setting limit per IS 4926.",
      category: "Hydration Risk",
      urgency: "urgent",
      urgencyLabel: "Expiring Batch",
      badgeText: "14m Left",
      badgeVariant: "destructive",
      metrics: [
        { label: "Truck", value: "MH-12-RN-1002" },
        { label: "Grade", value: "M35" },
        { label: "Slump Loss Risk", value: "High" },
      ],
      actionLabel: "Track Live Fleet →",
      actionTo: "/dispatcher",
      waitingTime: "Critical",
      status: "pending",
    },
    {
      id: "owner-item-03",
      role: "owner",
      title: "Plant Weighbridge Queue: 2 Inbound Trucks",
      subtitle: "Maha Stone tipper waiting on Tare platform + UltraTech cement bulker waiting for gate weighment.",
      category: "Plant Logistics",
      urgency: "attention",
      urgencyLabel: "Weighbridge Queue",
      badgeText: "2 Vehicles",
      badgeVariant: "warning",
      metrics: [
        { label: "Avg Weigh Time", value: "4.2 min" },
        { label: "Bin 3 Aggregate", value: "Unloading" },
      ],
      actionLabel: "Inspect Weighbridge →",
      actionTo: "/store",
      waitingTime: "5m waiting",
      status: "pending",
    },
    {
      id: "owner-item-04",
      role: "owner",
      title: "Approve October Driver Payroll Run (₹2.18L)",
      subtitle: "Monthly payroll step for 14 transit mixer drivers and 4 batching operators ready for final executive sign-off.",
      category: "Executive Payroll",
      urgency: "standard",
      urgencyLabel: "Payroll Review",
      badgeText: "Monthly Payroll",
      badgeVariant: "outline",
      metrics: [
        { label: "Total Payroll", value: "₹2,18,000" },
        { label: "Staff", value: "18 Employees" },
        { label: "Incentives Included", value: "Yes" },
      ],
      actionLabel: "Review Payroll Step →",
      actionTo: "/account",
      waitingTime: "Ready for sign-off",
      status: "pending",
    },
  ],

  customer: [
    {
      id: "cust-item-01",
      role: "customer",
      title: "Active Delivery: 8 cum M35 En Route (ETA 22 min)",
      subtitle: "Transit mixer MH-12-RN-1003 dispatched from plant at 13:42. Live Concrete Clock: 1h 45m safe discharge window.",
      category: "Live Delivery",
      urgency: "urgent",
      urgencyLabel: "En Route to Site",
      badgeText: "ETA 22 min",
      badgeVariant: "success",
      metrics: [
        { label: "Driver", value: "Santosh Patil" },
        { label: "Driver Phone", value: "+91 98221 44321" },
        { label: "Grade", value: "M35 Pumping" },
        { label: "Safe Discharge", value: "Before 15:42" },
      ],
      actionLabel: "Open Live GPS Tracker →",
      actionTo: "/portal",
      waitingTime: "In Transit",
      status: "pending",
    },
    {
      id: "cust-item-02",
      role: "customer",
      title: "Tax Invoice #INV-2026-088 Awaiting Payment",
      subtitle: "Invoice for 48 cum M25 pour at Pier 12. Amount: ₹3,45,000. Due in 7 days per agreed credit terms.",
      category: "Invoice",
      urgency: "attention",
      urgencyLabel: "Payment Due",
      badgeText: "₹3,45,000",
      badgeVariant: "warning",
      metrics: [
        { label: "Invoice Date", value: "24-Oct-2026" },
        { label: "Due Date", value: "31-Oct-2026" },
        { label: "Payment Mode", value: "RTGS / NEFT" },
      ],
      actionLabel: "View e-Challan & Invoice →",
      actionTo: "/portal",
      waitingTime: "Due in 5 days",
      status: "pending",
    },
  ],
};

/**
 * Hook to manage live role queue with local persistence
 */
export function useRoleQueue(role: Role) {
  const [completedIds, setCompletedIds] = useState<string[]>(getCompletedIds);
  const [items, setItems] = useState<QueueItem[]>(() => QUEUE_CATALOG[role] || []);

  useEffect(() => {
    setItems(QUEUE_CATALOG[role] || []);
  }, [role]);

  const toggleComplete = (id: string) => {
    setCompletedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      saveCompletedIds(next);
      return next;
    });
  };

  const activeItems = items.map((item) => ({
    ...item,
    status: completedIds.includes(item.id) ? ("completed" as const) : ("pending" as const),
  }));

  const pendingCount = activeItems.filter((i) => i.status === "pending").length;
  const urgentCount = activeItems.filter((i) => i.status === "pending" && i.urgency === "urgent").length;

  return {
    items: activeItems,
    pendingCount,
    urgentCount,
    completedCount: completedIds.length,
    toggleComplete,
  };
}
