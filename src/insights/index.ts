import { getDb } from "@/lib/store";
import type { Role } from "@/types";
import { delay } from "@/lib/utils";

export interface Insight {
  id: string;
  type: "warning" | "success" | "info" | "action";
  title: string;
  description: string;
  metric?: string;
  roles: Role[];
}

export async function generateInsights(role: Role): Promise<Insight[]> {
  await delay(); // simulate AI processing delay
  const db = getDb();
  const insights: Insight[] = [];

  // Generate role-specific insights based on current data
  
  if (role === "owner" || role === "sales_manager") {
    // Check pending approvals
    const pendingPo = db.purchaseOrders.filter(po => po.status === "SUBMITTED").length;
    if (pendingPo > 0) {
      insights.push({
        id: "ins-sales-1",
        type: "warning",
        title: "Bottleneck in Approvals",
        description: `There are ${pendingPo} purchase orders waiting for approval. Approving them quickly can improve dispatch planning efficiency.`,
        metric: `${pendingPo} pending POs`,
        roles: ["sales_manager", "owner"]
      });
    }

    const unpaidInvoices = db.invoices.filter(i => i.status === "ISSUED" || i.status === "PARTIALLY_PAID" || i.status === "OVERDUE");
    const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount - inv.paid), 0);
    if (totalUnpaid > 1000000) {
      insights.push({
        id: "ins-owner-1",
        type: "action",
        title: "High Outstanding Receivables",
        description: `Outstanding payments have crossed ₹10L. Consider sending automated reminders to top defaulters.`,
        metric: `₹${(totalUnpaid/100000).toFixed(2)}L Outstanding`,
        roles: ["owner", "sales_manager"]
      });
    }
  }

  if (role === "dispatcher" || role === "owner") {
    const activeTrips = db.trips.filter(t => ["PLANNED", "BATCHING", "LOADED", "IN_TRANSIT"].includes(t.status));
    const tmAvailability = db.transitMixers.filter(tm => tm.status === "AVAILABLE").length;
    
    if (activeTrips.length > 5 && tmAvailability < 2) {
      insights.push({
        id: "ins-disp-1",
        type: "warning",
        title: "Transit Mixer Shortage Predicted",
        description: "High dispatch volume detected with critically low mixer availability. Consider re-routing returning mixers or staggering next batches.",
        metric: `${tmAvailability} TM available`,
        roles: ["dispatcher", "owner"]
      });
    }
  }

  if (role === "production" || role === "owner") {
    const tripsForProd = db.trips.filter(t => t.status === "SENT_TO_PRODUCTION" || t.status === "BATCHING").length;
    if (tripsForProd > 0) {
      insights.push({
        id: "ins-prod-1",
        type: "info",
        title: "Production Queue Active",
        description: `You have ${tripsForProd} batches in queue. Average batching time is currently optimal at 14 minutes per mixer.`,
        roles: ["production", "owner"]
      });
    }
  }

  if (role === "qa" || role === "owner") {
    const recentRejections = db.qcChecks.filter(q => q.decision === "REJECTED").length;
    if (recentRejections > 0) {
      insights.push({
        id: "ins-qa-1",
        type: "action",
        title: "Recent QC Failures Detected",
        description: "Multiple batches have failed QC recently due to slump issues. Recommend recalibrating the water-cement ratio for M30 and M35 grades.",
        roles: ["qa", "owner"]
      });
    }
  }

  if (role === "store" || role === "owner") {
    const inv = db.inventory ?? [];
    const lowStock = inv.filter(i => i.currentStock <= i.reorderLevel);
    if (lowStock.length > 0) {
      insights.push({
        id: "ins-store-1",
        type: "warning",
        title: "Critical Material Shortages",
        description: `${lowStock.map(l => l.material).join(", ")} are below reorder levels. Raise PO to suppliers immediately to avoid production halts.`,
        metric: `${lowStock.length} items low`,
        roles: ["store", "owner"]
      });
    }
  }

  if (role === "account" || role === "owner") {
    const payroll = db.payroll ?? [];
    const pendingPayroll = payroll.find(p => p.status === "DRAFT");
    if (pendingPayroll) {
      insights.push({
        id: "ins-acc-1",
        type: "info",
        title: "Upcoming Payroll Run",
        description: `Draft payroll for ${pendingPayroll.period} is ready. Total estimated payout is ₹${(pendingPayroll.totalAmount/100000).toFixed(2)}L.`,
        roles: ["account", "owner"]
      });
    }
  }
  
  if (role === "customer") {
    insights.push({
      id: "ins-cus-1",
      type: "success",
      title: "On-Time Delivery Performance",
      description: "92% of your orders this month have been delivered within the promised 2-hour SLA.",
      metric: "92% SLA met",
      roles: ["customer"]
    });
  }

  // Generic success insight if queue is empty and no warnings
  if (insights.length === 0) {
    insights.push({
      id: "ins-gen-1",
      type: "success",
      title: "All Systems Nominal",
      description: "Operations are running smoothly. No critical bottlenecks or warnings detected in your operational area.",
      roles: ["owner", "sales", "sales_manager", "dispatcher", "production", "qa", "store", "account", "customer"]
    });
  }

  // Filter based on the requested role
  return insights.filter(i => i.roles.includes(role));
}
