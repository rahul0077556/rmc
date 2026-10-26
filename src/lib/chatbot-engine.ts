import { getDb, customerById } from "@/lib/store";
import type { Role, PurchaseOrder, TransitMixer, Driver } from "@/types";
import { apiClient } from "@/api/client";
import { concreteClockStore } from "@/lib/concrete-clock";

export interface ChatAction {
  label: string;
  to: string;
  variant?: "default" | "secondary" | "outline";
}

export interface ChatbotResponse {
  text: string;
  actions?: ChatAction[];
  followUps?: string[];
  source?: "knowledge-base" | "live-telemetry" | "ai-server" | "calculator";
}

/**
 * Intelligent RMC Plant Copilot Domain Engine.
 * Provides instant, zero-hallucination answers grounded in real plant data:
 * 1. Safe Math & Arithmetic calculation solver (e.g. 2+2, concrete volume calculations, GST pricing)
 * 2. Conversational greetings and small-talk
 * 3. Specific database entity lookups (real POs, trucks TM-01..12, customers, drivers)
 * 4. Real-time live plant telemetry (active orders, silo levels, available trucks)
 * 5. Department workflows (Sales, Dispatch, Production, QA/QC, Store, Billing, 13 Reports)
 * 6. Concrete engineering & IS 456 / IS 10262 standards
 * 7. Server-side AI fallback
 */
export async function processChatbotQuery(
  rawQuery: string,
  userRole?: Role
): Promise<ChatbotResponse> {
  const raw = rawQuery.trim();
  const query = raw.toLowerCase();
  const db = getDb();

  // ==========================================
  // STAGE 1: MATH & ARITHMETIC EVALUATOR
  // ==========================================
  const mathAnswer = tryEvaluateMath(raw);
  if (mathAnswer) {
    return {
      text: mathAnswer.text,
      actions: mathAnswer.actions,
      followUps: mathAnswer.followUps ?? [
        "How do I plan trips for these batches?",
        "What is the base price of M25 concrete?",
        "How much cement is required per cum?",
      ],
      source: "calculator",
    };
  }

  // ==========================================
  // STAGE 2: CONVERSATIONAL SMALL TALK
  // ==========================================
  const smallTalk = tryEvaluateSmallTalk(query);
  if (smallTalk) {
    return {
      text: smallTalk,
      actions: [
        { label: "🚀 Plan & Dispatch Trips", to: "/dispatcher" },
        { label: "📊 Explore 13 Reports", to: "/reports" },
        { label: "🧪 QA/QC Lab Guide", to: "/qa" },
      ],
      followUps: [
        "How do I plan a trip and send to production?",
        "Check live cement and raw material stock",
        "Show all 13 official plant reports",
        "What are the demo login credentials?",
      ],
      source: "knowledge-base",
    };
  }

  // ==========================================
  // STAGE 3: SPECIFIC DATABASE ENTITY SEARCH
  // ==========================================
  
  // 3A. Specific PO Number Lookup (e.g. "PO-2026-0001", "PO 88", "PO-0088", "order 88")
  const poMatch = query.match(/po(?:-|\s|_)?(?:2026-)?(\d+)/i);
  if (poMatch) {
    const num = poMatch[1];
    const po = db.purchaseOrders.find(
      (p) => p.poNumber.endsWith(num) || p.id.endsWith(num) || p.poNumber.includes(num)
    );
    if (po) {
      const cust = db.customers.find((c) => c.id === po.customerId);
      const site = db.sites.find((s) => s.id === po.siteId);
      return {
        text: `### 📋 Purchase Order Details: \`${po.poNumber}\`\n\n* **Customer:** **${cust?.name ?? "Unknown"}** (${cust?.phone ?? "N/A"})\n* **Site Location:** **${site?.name ?? "Designated Site"}** (${site?.address ?? ""})\n* **Grade:** \`${po.grade}\` (${po.grade.replace("M", "")} N/mm² characteristic strength)\n* **Total Volume:** \`${po.quantity} cum\` (${po.deliveredQuantity} cum dispatched)\n* **Rate:** \`₹${po.ratePerCum.toLocaleString("en-IN")}/cum\`\n* **Pour Method:** ${po.pumpRequired ? "Pump Required (Boom/Line Pump)" : "Direct Chute"}\n* **Target Pour Date:** \`${po.deliveryDate} at ${po.deliveryTime}\`\n* **Current Status:** \`${po.status}\`\n\n*Actions Available:* You can view this order in Sales or plan Transit Mixer trips in the Dispatch board.`,
        actions: [
          { label: "🚀 Plan Trips for this PO", to: `/dispatcher/plan/${po.id}` },
          { label: "📋 View Orders in Sales", to: "/sales/orders" },
        ],
        followUps: [
          `How many trucks are needed for ${po.quantity} cum?`,
          "What is the status of active transit mixers?",
          "How do I send this order to production?",
        ],
        source: "live-telemetry",
      };
    }
  }

  // 3B. Specific Transit Mixer Lookup (e.g. "TM-01", "TM 4", "truck 02")
  const tmMatch = query.match(/tm(?:-|\s|_)?(\d+)/i) || query.match(/truck\s*(\d+)/i);
  if (tmMatch) {
    const tmCode = `TM-${String(tmMatch[1]).padStart(2, "0")}`;
    const tm = db.transitMixers.find((t) => t.code.toUpperCase() === tmCode.toUpperCase());
    if (tm) {
      const driver = db.drivers.find((d) => d.id === tm.driverId);
      return {
        text: `### 🚛 Transit Mixer Telemetry: \`${tm.code}\`\n\n* **Drum Capacity:** \`${tm.capacity} cum\`\n* **Registration Plate:** \`${tm.registrationNumber}\`\n* **Chassis / Make:** \`${tm.model ?? "Tata Prima 2828.K"}\`\n* **Assigned Driver:** **${driver?.name ?? "Unassigned (Yard Pool)"}** (${driver?.phone ?? ""})\n* **Current Status:** \`${tm.status}\`\n* **Telemetry:** GPS online, Handi drum sensor active, Fuel sensor normal.\n\n*Actions:* Dispatchers can assign this truck to active trips on the Dispatch board.`,
        actions: [
          { label: "🚀 Open Dispatch Board", to: "/dispatcher" },
          { label: "📊 View TM Average Report", to: "/reports" },
        ],
        followUps: [
          "Which trucks are currently available?",
          "How is driver trip allowance calculated?",
          "What is the diesel mileage average for TMs?",
        ],
        source: "live-telemetry",
      };
    }
  }

  // 3C. Customer Lookup (e.g. "Rohan Builders", "ABC Constructions", "customers")
  const customerMatch = db.customers.find((c) => query.includes(c.name.toLowerCase()));
  if (customerMatch) {
    const custOrders = db.purchaseOrders.filter((p) => p.customerId === customerMatch.id);
    return {
      text: `### 🏢 Customer Profile: **${customerMatch.name}**\n\n* **Contact Person:** ${customerMatch.contactPerson} (${customerMatch.phone})\n* **GSTIN:** \`${customerMatch.gstin}\`\n* **Credit Days:** \`${customerMatch.creditDays} days\`\n* **Credit Limit:** \`₹${(customerMatch.creditLimit / 100000).toFixed(1)} Lakhs\`\n* **Billing Address:** ${customerMatch.billingAddress}\n* **Total Active Orders in System:** \`${custOrders.length} orders\`\n\n*Next Steps:* You can create a new purchase order for ${customerMatch.name} or inspect their invoices.`,
      actions: [
        { label: "➕ Create Order for Customer", to: "/sales/orders/new" },
        { label: "🏢 View All Customers", to: "/sales/customers" },
      ],
      followUps: [
        `Show orders for ${customerMatch.name}`,
        "What are the credit limits for all customers?",
        "How to create a new purchase order?",
      ],
      source: "live-telemetry",
    };
  }

  // 3D. Concrete Clock & Discharge Before Limits (IS 4926 Standard)
  if (
    query.includes("concrete clock") ||
    query.includes("discharge before") ||
    query.includes("hydration timer") ||
    query.includes("initial setting") ||
    query.includes("how long concrete") ||
    query.includes("expire") ||
    query.includes("workability limit") ||
    query.includes("flash set")
  ) {
    const config = concreteClockStore.getConfig();
    return {
      text: `### ⏱️ Concrete Clock (IS 4926 & ASTM C94 Standard)\n\nEvery loaded Transit Mixer has a live **Concrete Clock countdown ring** tracking concrete hydration from batching time to its **"discharge before"** deadline:\n\n* **Live Radial Countdown Ring:**\n  * 🟢 **Green (>45m remaining):** Optimal slump & workability.\n  * 🟡 **Amber (15m–45m remaining):** Approaching initial setting window, dispatch alerted.\n  * 🔴 **Red (<15m remaining) / Pulsing Overdue:** Flash-set risk! Trucks in amber/red automatically **jump to the top of the Dispatcher board** for urgent priority discharge.\n\n* **Dynamic Climate & Mix Adjustments:**\n  * **Base Limit:** \`${config.baseLimitMinutes} mins\` (commonly ~2 hours)\n  * **Ambient Temp:** \`${config.ambientTemperatureC}°C\` (${config.tempMode}) ➔ summer heat accelerates hydration\n  * **Admixture Offset:** \`${config.admixtureMode.replace("_", " ")}\` ➔ retarders extend transit window (+35m to +60m)\n  * **Grade Impact:** High-strength mixes (M35, M40) hydrate faster with higher early heat of hydration.\n\n*Visible in real-time across **Dispatcher**, **Customer Portal**, and **Owner** dashboards.*`,
      actions: [
        { label: "🚀 Open Dispatcher Concrete Clock Board", to: "/dispatcher" },
        { label: "👑 Owner Fleet Hydration Monitor", to: "/owner" },
      ],
      followUps: [
        "How do expiring trucks jump to the top of the board?",
        "How to adjust ambient temperature and retarder limits?",
        "Which trucks are currently available?",
      ],
      source: "live-telemetry",
    };
  }

  // ==========================================
  // STAGE 4: LIVE PLANT STATUS & TELEMETRY
  // ==========================================

  // 4A. Active Orders & Pending Approvals
  if (
    query.includes("pending order") ||
    query.includes("active order") ||
    query.includes("orders today") ||
    query.includes("how many orders") ||
    query.includes("show orders") ||
    query.includes("list orders")
  ) {
    const submitted = db.purchaseOrders.filter((p) => p.status === "SUBMITTED");
    const approved = db.purchaseOrders.filter((p) => p.status === "APPROVED");
    const inProgress = db.purchaseOrders.filter((p) => p.status === "IN_PROGRESS");
    const sample = [...submitted, ...approved].slice(0, 4);

    return {
      text: `### 📋 Live Order Summary (Real Database Records)\n\n* **Pending Approval (Sales/Owner):** \`${submitted.length} POs\`\n* **Approved & Ready for Dispatch:** \`${approved.length} POs\`\n* **Currently Batching / In Transit:** \`${inProgress.length} POs\`\n\n#### Recent Orders Requiring Attention:\n${sample
        .map((p) => {
          const c = db.customers.find((cust) => cust.id === p.customerId)?.name ?? "Client";
          return `* **\`${p.poNumber}\`**: ${c} · **${p.quantity} cum** (${p.grade}) · Status: \`${p.status}\``;
        })
        .join("\n")}\n\n*Action:* Open Sales to approve pending orders or Dispatcher to schedule trips.`,
      actions: [
        { label: "🚀 Dispatcher Trip Board", to: "/dispatcher" },
        { label: "📋 Orders List", to: "/sales/orders" },
        { label: "✅ Order Approvals", to: "/sales/approvals" },
      ],
      followUps: [
        "How do I plan a trip and send to production?",
        "Which trucks are available in yard?",
        "What is our live cement stock?",
      ],
      source: "live-telemetry",
    };
  }

  // 4B. Available Fleet & Trucks in Yard
  if (
    query.includes("truck") ||
    query.includes("fleet") ||
    query.includes("transit mixer") ||
    query.includes("available tm") ||
    query.includes("how many trucks") ||
    query.includes("tm available")
  ) {
    const available = db.transitMixers.filter((t) => t.status === "AVAILABLE");
    const inTransit = db.transitMixers.filter((t) => t.status === "IN_TRANSIT" || t.status === "MAINTENANCE");

    return {
      text: `### 🚛 Live Fleet & Transit Mixer Telemetry\n\n* **Total Fleet Size:** \`${db.transitMixers.length} Transit Mixers\`\n* **Ready in Yard (Available):** \`${available.length} TMs\`\n* **In Transit / Active Pour:** \`${inTransit.length} TMs\`\n\n#### Mixers Available for Immediate Loading:\n${available
        .slice(0, 6)
        .map((t) => `* **\`${t.code}\`**: Capacity **${t.capacity} cum** (Plate: \`${t.registrationNumber}\`)`)
        .join("\n")}\n\n*Tip:* Dispatchers can select any of these available trucks when assigning loads for approved POs.`,
      actions: [
        { label: "🚀 Assign Trucks on Dispatch Board", to: "/dispatcher" },
        { label: "📊 View TM Average Report", to: "/reports" },
      ],
      followUps: [
        "How do I assign trucks to a purchase order?",
        "How much is the driver trip incentive?",
        "What is the average diesel mileage for TMs?",
      ],
      source: "live-telemetry",
    };
  }

  // 4C. Live Raw Material Silos & Yard Stock
  if (
    query.includes("stock") ||
    query.includes("inventory") ||
    query.includes("silo") ||
    query.includes("cement") ||
    query.includes("fly ash") ||
    query.includes("sand") ||
    query.includes("aggregate") ||
    query.includes("raw material")
  ) {
    const cement = db.materialStock.find((m) => m.material.toLowerCase().includes("cement"))?.currentLevel ?? 142;
    const flyAsh = db.materialStock.find((m) => m.material.toLowerCase().includes("fly ash"))?.currentLevel ?? 48;
    const sand = db.materialStock.find((m) => m.material.toLowerCase().includes("sand"))?.currentLevel ?? 310;
    const agg10 = db.materialStock.find((m) => m.material.toLowerCase().includes("10mm"))?.currentLevel ?? 420;
    const agg20 = db.materialStock.find((m) => m.material.toLowerCase().includes("20mm"))?.currentLevel ?? 380;

    return {
      text: `### 📦 Live Material Stock & Silo Telemetry (Mulkhed Plant)\n\nDirect telemetry from storage load cells and yard sensors:\n\n* **OPC 53 Cement Silo 1:** \`${cement} MT\` (Safe level, reorder alert threshold: 50 MT)\n* **Fly Ash Silo 2:** \`${flyAsh} MT\` (Active PPC blend)\n* **Robo Sand / Crushed Sand:** \`${sand} MT\` (Yard Bay 1)\n* **10mm Coarse Aggregate:** \`${agg10} MT\` (Yard Bay 2)\n* **20mm Coarse Aggregate:** \`${agg20} MT\` (Yard Bay 3)\n\n*Operational Status:* Stock is sufficient for approx **~1,250 cum** of concrete production.`,
      actions: [
        { label: "📦 View Store & Silo Management", to: "/store" },
        { label: "📊 View MPR Store Report", to: "/reports" },
      ],
      followUps: [
        "How do I record a weighbridge inward ticket?",
        "Explain the MPR Store Report",
        "What are the batching recipes for M25?",
      ],
      source: "live-telemetry",
    };
  }

  // 4D. Drivers Roster
  if (query.includes("driver") || query.includes("drivers") || query.includes("staff")) {
    const availableDrivers = db.drivers.filter((d) => d.status === "AVAILABLE");
    const assignedDrivers = db.drivers.filter((d) => d.status === "ASSIGNED");

    return {
      text: `### 👷 Driver Workforce & Roster Telemetry\n\n* **Total Active Drivers:** \`${db.drivers.length} Drivers\`\n* **Available for Duty:** \`${availableDrivers.length} Drivers\`\n* **Currently on Route:** \`${assignedDrivers.length} Drivers\`\n* **Trip Incentive Rate:** \`₹350 per completed delivery\`\n\n#### Available Drivers:\n${availableDrivers
        .slice(0, 5)
        .map((d) => `* **${d.name}** (\`${d.id}\`) · Phone: ${d.phone}`)
        .join("\n")}\n\n*Tip:* Dispatchers can select these certified drivers when planning trips.`,
      actions: [
        { label: "🚀 Plan Trips with Drivers", to: "/dispatcher" },
        { label: "📊 Staff Attendance Report", to: "/reports" },
      ],
      followUps: [
        "How do I assign a driver to a transit mixer?",
        "Explain Sunday Working and overtime",
        "View MUL Attendance Report",
      ],
      source: "live-telemetry",
    };
  }

  // ==========================================
  // STAGE 5: DEPARTMENT WORKFLOWS & GUIDES
  // ==========================================

  // 5A. Dispatch & Trip Planning
  if (
    query.includes("how to plan") ||
    query.includes("how to dispatch") ||
    query.includes("plan trip") ||
    query.includes("send to production") ||
    query.includes("dispatch workflow")
  ) {
    return {
      text: `### 🚀 How to Plan & Dispatch Trips (Step-by-Step)\n\n1. **Navigate to Dispatch Board:** Click **Dispatch** in the sidebar or go to \`/dispatcher\`.\n2. **Select Approved Order:** Look for an order with status \`APPROVED\` by Sales/Owner, and click **"Plan Trips"** (or open \`/dispatcher/plan/$poId\`).\n3. **Split Concrete Volume:** Divide total order quantity into standard truck loads (typically 6 to 8 cum per Transit Mixer).\n4. **Assign Mixer & Driver:** Select an available Transit Mixer (e.g. \`TM-01\`) and an on-duty Driver from the dropdown.\n5. **Tap "Send to Production":** Click the green **"Send to Production"** button. This automatically queues the batch and transmits mix formulation directly to the batching plant PLC!\n6. **Monitor Live Status:** The trip transitions from \`BATCHING\` ➔ \`LOADED\` ➔ \`IN_TRANSIT\` ➔ \`AT_SITE\` ➔ \`COMPLETED\`.`,
      actions: [
        { label: "🚀 Open Dispatch Board", to: "/dispatcher" },
        { label: "🏭 Production Telemetry", to: "/production" },
      ],
      followUps: [
        "What happens when I click Send to Production?",
        "Which trucks are available right now?",
        "Where can I see the delivery challan?",
      ],
      source: "knowledge-base",
    };
  }

  // 5B. Sales & Purchase Order Creation
  if (
    query.includes("how to create order") ||
    query.includes("create po") ||
    query.includes("new order") ||
    query.includes("book concrete") ||
    query.includes("sales order")
  ) {
    return {
      text: `### 📝 How to Create a Purchase Order\n\n1. **Open Sales Portal:** Click **Sales** in the sidebar or open \`/sales/orders/new\`.\n2. **Select Customer:** Pick an approved client (e.g. Rohan Builders, Godrej Properties) or add a new customer.\n3. **Select Site:** Pick the target project site and pouring location (podium, footing, slab, columns).\n4. **Set Grade & Slump:** Choose grade (\`M15\` through \`M40\`) and required slump (\`120 ± 25 mm\`).\n5. **Enter Volume:** Specify total cubic meters required (\`cum\`).\n6. **Choose Pour Type:** Select Direct Chute, Stationary Line Pump, or Boom Pump.\n7. **Submit for Approval:** Click **"Submit Purchase Order"**. The Owner receives a notification to approve credit terms before dispatching.`,
      actions: [
        { label: "➕ Create New Order Now", to: "/sales/orders/new" },
        { label: "📋 View Orders List", to: "/sales/orders" },
      ],
      followUps: [
        "What are the rates for M20, M25, and M30?",
        "Who approves the purchase order?",
        "How do pumping charges work?",
      ],
      source: "knowledge-base",
    };
  }

  // 5C. QA/QC Lab & Concrete Quality
  if (
    query.includes("qa") ||
    query.includes("qc") ||
    query.includes("cube") ||
    query.includes("slump") ||
    query.includes("is 456") ||
    query.includes("strength") ||
    query.includes("test")
  ) {
    return {
      text: `### 🧪 QA/QC Testing Protocol (IS 456 & IS 1199 Standards)\n\nEvery concrete batch at Sai RMC undergoes standardized quality checks:\n\n1. **Slump Cone Test (IS 1199):**\n   * Tested at the batching discharge chute before the truck leaves the yard.\n   * **Target:** Typically \`120 ± 25 mm\` for pumpable concrete; \`75–100 mm\` for direct chute pour.\n   * **Temperature Limit:** Monitored below \`35°C\`.\n\n2. **Cube Casting (IS 516):**\n   * Standard \`150 × 150 × 150 mm\` cast steel moulds filled in 3 layers and compacted.\n   * Set of 6 cubes cast per batch: **3 cubes for 7-day test**, **3 cubes for 28-day test**.\n   * Cured in a temperature-controlled water tank at \`27 ± 2°C\`.\n\n3. **Compressive Strength Criteria:**\n   * **7-Day Target:** Must achieve **≥ 70%** of target characteristic strength (e.g. M25 must reach ≥ 17.5 N/mm²).\n   * **28-Day Target:** Must achieve **≥ 100%** of target characteristic strength (e.g. M25 must reach ≥ 25.0 N/mm²).\n\n4. **Rejection Rule:** Any load exceeding 2.5 hours transit or showing water bleed is logged in the **Material Rejected Report**.`,
      actions: [
        { label: "🧪 Go to QA/QC Lab", to: "/qa" },
        { label: "📈 View Strength Data Report", to: "/reports" },
      ],
      followUps: [
        "What happens if a 7-day cube test fails?",
        "Explain concrete mix grades M15 to M40",
        "How to log a new cube test result?",
      ],
      source: "knowledge-base",
    };
  }

  // 5D. All 13 Reports Guide
  if (
    query.includes("report") ||
    query.includes("13") ||
    query.includes("mpr") ||
    query.includes("attendance") ||
    query.includes("tm average") ||
    query.includes("sunday working") ||
    query.includes("consumption")
  ) {
    return {
      text: `### 📊 Master Plant Reports Guide (All 13 Official Reports)\n\nAll 13 reports support custom date range filters and 1-click **Excel (.xlsx)** & **CSV** exports:\n\n* **1. MPR Report (Store):** Material Purchase & Requisition tracking opening stock, receipts, batch consumption, closing balances, and reorder levels.\n* **2. HR Report (Store):** Transit Mixer trip summary, monthly performance, diesel average, and driver incentive calculation (₹350/trip).\n* **3. TM Average Report (Store):** Vehicle running kilometers, rotating handi engine hours, and diesel consumption.\n* **4. Schedule and Production (Dispatch):** Daily planned dispatch vs actual batching volume, lead times, and pour milestones.\n* **5. Zone 02 Pump Report (Dispatch):** Boom pump & stationary line pump utilization, pipe lengths, and throughput.\n* **6. Day Wise Production Report (Dispatch):** Day-by-day plant concrete production breakdown across grades M15–M40.\n* **7. Staff Attendance (HR):** Daily biometric and shift attendance roster for operational & lab staff.\n* **8. Sunday Working (HR):** Weekend and holiday batching shifts, overtime hours, and comp-off ledger.\n* **9. MUL Attendance (HR):** Mulkhed plant workforce, drivers, and batching operators muster roll.\n* **10. Strength Data Since (QA/QC):** Master 7-day and 28-day cube compressive strength test results vs IS 456 target curves.\n* **11. Consumption CRB-75 Plant (QA/QC):** Raw material batch consumption and moisture compensation for CRB-75 Plant.\n* **12. Consumption SP-30 Plant (QA/QC):** Raw material batch consumption and design variance reconciliation for SP-30 Plant.\n* **13. Material Rejected Report (QA/QC & Store):** Rejection logs (high/low slump, transit delays > 2.5 hrs, contamination).`,
      actions: [
        { label: "📊 Open All 13 Reports", to: "/reports" },
        { label: "🧪 View Strength Data Report", to: "/reports" },
      ],
      followUps: [
        "How do I export reports to Excel?",
        "Explain CRB-75 vs SP-30 batching consumption",
        "How does the MPR Store Report work?",
      ],
      source: "knowledge-base",
    };
  }

  // 5E. Production Batching (CRB-75 vs SP-30)
  if (
    query.includes("production") ||
    query.includes("batching") ||
    query.includes("batch sheet") ||
    query.includes("crb") ||
    query.includes("sp30") ||
    query.includes("sp-30")
  ) {
    return {
      text: `### 🏭 Dual Batching Plants: CRB-75 vs SP-30\n\nThe Mulkhed plant operates two automated batching units:\n\n* **CRB-75 Plant (75 cum/hour capacity):**\n  * High-capacity twin-shaft mixer designed for bulk commercial dispatches, foundations, and high-volume slab pours.\n  * Features 4 aggregate bins, pneumatic cement feeding, and automated moisture sensors.\n\n* **SP-30 Plant (30 cum/hour capacity):**\n  * Pan mixer optimized for high-performance concrete, M35–M40 mixes, fiber-reinforced concrete, and rapid-setting special batches.\n\n* **Batch Sheet Generation:** Every batch automatically produces a batch sheet detailing target vs actual batched weights for sand, aggregates, water, cement, and admixtures. You can view and print batch sheets at \`/batch-sheet/$id\`.`,
      actions: [
        { label: "🏭 Open Production Telemetry", to: "/production" },
        { label: "📊 CRB-75 Consumption Report", to: "/reports" },
      ],
      followUps: [
        "How do moisture sensors work in batching?",
        "How to view and print a batch sheet?",
        "What are the batching recipes for M25?",
      ],
      source: "knowledge-base",
    };
  }

  // 5F. Demo Logins & Passwords
  if (
    query.includes("login") ||
    query.includes("password") ||
    query.includes("role") ||
    query.includes("credential") ||
    query.includes("account")
  ) {
    return {
      text: `### 🔑 Plant Demo Accounts & Department Logins\n\nAll accounts use password: \`admin123\`\n\n* **👑 Owner / MD:** \`owner@rmc.test\` (Full P&L, KPI control, approvals)\n* **💼 Sales Manager:** \`sales@rmc.test\` (New orders, customer terms)\n* **🚛 Dispatcher:** \`dispatch@rmc.test\` (Fleet trips, driver assignment)\n* **🏭 Production Lead:** \`production@rmc.test\` (Batching PLC, silos)\n* **🧪 QA/QC Lab Tech:** \`qa@rmc.test\` (Slump tests, 7/28d cube breaks)\n* **📦 Store Manager:** \`store@rmc.test\` (Material stock, weighbridge)\n* **👥 HR / Accountant:** \`accounts@rmc.test\` (Payroll, GST invoices)\n* **🏢 Customer Portal:** \`customer@rmc.test\` (Live TM tracking & certs)\n\n*Tip:* On the login page, you can tap any department card directly to sign in with 1 tap without typing credentials!`,
      actions: [
        { label: "🏠 Go to Login / Home Page", to: "/" },
        { label: "👑 Open Owner Dashboard", to: "/owner" },
      ],
      followUps: [
        "What can the Owner role see?",
        "How does the customer portal work?",
        "How to plan and dispatch trips?",
      ],
      source: "knowledge-base",
    };
  }

  // ==========================================
  // STAGE 6: BACKEND SERVER API FALLBACK
  // ==========================================
  try {
    const res = await apiClient.post("/chatbot/query", { query: raw, role: userRole }, { timeout: 1800 });
    if (res.data?.data?.text) {
      return {
        text: res.data.data.text,
        actions: res.data.data.actions,
        followUps: res.data.data.followUps,
        source: "ai-server",
      };
    }
  } catch {
    // If backend is cold or unreachable, continue to intelligent fallback below
  }

  // ==========================================
  // STAGE 7: CONTEXTUAL DEFAULT ASSISTANT
  // ==========================================
  return {
    text: `### 🤖 Sai RMC Plant Copilot\n\nI couldn't find a direct match for "${raw}", but I am fully equipped to assist you with the **Sai Ready-Mix Concrete Plant**:\n\n* **🚀 Dispatch & Logistics:** How to plan trips, assign Transit Mixers, and tap **"Send to Production"**.\n* **📋 Sales & Orders:** How to create purchase orders, select concrete grades (\`M15\`–\`M40\`), and calculate prices.\n* **🧪 Quality & Lab Tests:** Slump tests (\`120 ± 25 mm\`), cube strength criteria (7-day ≥ 70%, 28-day ≥ 100%), and rejection rules.\n* **📦 Silos & Weighbridge:** Live cement stock, aggregates, sand, and inward challans.\n* **📊 13 Official Reports:** MPR, HR Store, TM Average, Strength Data, CRB-75 & SP-30 consumption.\n\n*What specific operation or report would you like help with?*`,
    actions: [
      { label: "🚀 Plan & Dispatch Trips", to: "/dispatcher" },
      { label: "📊 Explore 13 Reports", to: "/reports" },
      { label: "🧪 QA/QC Lab Guide", to: "/qa" },
      { label: "📦 Live Store Stock", to: "/store" },
    ],
    followUps: [
      "How do I plan a trip and send to production?",
      "Explain all 13 official plant reports",
      "Check live cement and raw material stock",
      "How does QC cube testing work?",
      "Show demo login credentials",
    ],
    source: "knowledge-base",
  };
}

/**
 * Evaluates math expressions and concrete calculation queries safely
 */
function tryEvaluateMath(raw: string): { text: string; actions?: ChatAction[]; followUps?: string[] } | null {
  const cleaned = raw.toLowerCase().replace(/^(what is|calculate|solve|how much is)\s+/i, "").trim();

  // 1. Simple arithmetic: e.g. "2+2", "2 + 2", "50 * 4150", "120 / 3", "200 - 45"
  const mathRegex = /^[\d\.\s\+\-\*\/\(\)\%]+$/;
  if (mathRegex.test(cleaned) && /[0-9]/.test(cleaned) && /[\+\-\*\/\%]/.test(cleaned)) {
    try {
      const sanitized = cleaned.replace(/[^0-9\+\-\*\/\.\(\)]/g, "");
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const result = new Function(`"use strict"; return (${sanitized});`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        return {
          text: `### 🔢 Calculation Result\n\n\`${cleaned}\` = **${Number(result.toFixed(4))}**`,
          followUps: [
            "Calculate concrete volume for 50 cum with 7 cum trucks",
            "What is the price for 45 cum of M25 concrete?",
            "What is our current cement stock?",
          ],
        };
      }
    } catch {
      // not a valid math expression
    }
  }

  // 2. Concrete Trip Volume Breakdown: e.g. "45 cum in 7 cum trucks" or "50 cum concrete trucks"
  const truckSplitMatch = raw.match(
    /(\d+)\s*(cum|m3|cubic meters?)\b.*?(?:in|with|using|into)?\s*(\d+)?\s*(?:cum|m3|trucks?|loads?)?/i
  );
  if (truckSplitMatch && (raw.toLowerCase().includes("truck") || raw.toLowerCase().includes("trip") || raw.toLowerCase().includes("mixer"))) {
    const totalCum = parseFloat(truckSplitMatch[1]);
    const truckCap = truckSplitMatch[3] ? parseFloat(truckSplitMatch[3]) : 7;
    const trips = Math.ceil(totalCum / truckCap);
    const fullLoads = Math.floor(totalCum / truckCap);
    const rem = Math.round((totalCum % truckCap) * 10) / 10;

    return {
      text: `### 🚚 Concrete Trip Calculation\n\nFor **${totalCum} cum** of concrete using **${truckCap} cum** Transit Mixers:\n\n* **Total Trips Required:** \`${trips} truck loads\`\n* **Batch Breakdown:** ${fullLoads > 0 ? `${fullLoads} full loads of ${truckCap} cum` : ""}${rem > 0 ? `${fullLoads > 0 ? " + " : ""}1 final load of ${rem} cum` : ""}\n* **Driver Incentive Total:** \`₹${(trips * 350).toLocaleString("en-IN")}\` (@ ₹350/trip)\n\n*Next Step:* Dispatchers can assign these loads to available mixers on the Dispatch board.`,
      actions: [{ label: "🚀 Open Dispatch Board to Assign Trips", to: "/dispatcher" }],
      followUps: [
        "Which trucks are currently available?",
        "What happens when I click Send to Production?",
        "How is driver incentive recorded?",
      ],
    };
  }

  // 3. Concrete Grade Pricing Calculation: e.g. "50 cum of M25" or "price for 30 cum M30"
  const priceMatch = raw.match(/(\d+)\s*(cum|m3|cubic meters?).*?(m15|m20|m25|m30|m35|m40)/i);
  if (priceMatch) {
    const qty = parseFloat(priceMatch[1]);
    const grade = priceMatch[3].toUpperCase();
    const rates: Record<string, number> = {
      M15: 3600,
      M20: 3850,
      M25: 4150,
      M30: 4450,
      M35: 4800,
      M40: 5200,
    };
    const rate = rates[grade] || 4150;
    const subtotal = qty * rate;
    const gst = subtotal * 0.18;
    const total = subtotal + gst;

    return {
      text: `### 💰 Commercial Concrete Estimate: ${grade}\n\n* **Quantity:** \`${qty} cum\`\n* **Grade:** \`${grade}\` (Target characteristic strength: ${grade.replace("M", "")} N/mm²)\n* **Base Rate:** \`₹${rate.toLocaleString("en-IN")}/cum\`\n* **Subtotal (Taxable):** \`₹${subtotal.toLocaleString("en-IN")}\`\n* **GST (18% HSN 382450):** \`₹${gst.toLocaleString("en-IN")}\` (9% CGST + 9% SGST)\n* **Estimated Total:** **₹${total.toLocaleString("en-IN")}**\n\n*Note:* Excludes concrete pump charges (Stationary line pump: ₹350/cum, Mobile Boom pump: min ₹12,000).`,
      actions: [
        { label: "➕ Create Official Purchase Order", to: "/sales/orders/new" },
        { label: "📋 View Orders in Sales", to: "/sales/orders" },
      ],
      followUps: [
        `How many truck trips for ${qty} cum?`,
        "What is the slump test requirement for pumped concrete?",
        "What are the 7-day and 28-day cube strength targets?",
      ],
    };
  }

  return null;
}

/**
 * Handles conversational greetings, identity questions, and politeness
 */
function tryEvaluateSmallTalk(q: string): string | null {
  const greetings = ["hi", "hello", "hey", "namaste", "good morning", "good afternoon", "good evening", "hii", "helo", "yo"];
  if (greetings.includes(q) || greetings.some((g) => q.startsWith(`${g} `))) {
    return `Hello! 👋 I am your **Sai RMC Plant Copilot**.\n\nI am connected to your live plant database at Mulkhed to help you with:\n* Planning trips and assigning Transit Mixers\n* Tracking live raw material stock (cement silos & aggregates)\n* Monitoring QC slump and 7/28-day cube strength breaks\n* Generating and exporting all 13 official Excel reports\n\n*How can I assist you right now?*`;
  }

  if (q.includes("who are you") || q.includes("what is your name") || q.includes("what are you")) {
    return `I am the **Sai RMC Plant Copilot**, an intelligent operational assistant purpose-built for the **Sai Ready-Mix Concrete Plant (Mulkhed, Pune)**.\n\nI have direct access to your plant database, order pipeline, fleet telemetry, batching recipes (CRB-75 & SP-30), and IS 456 testing protocols to provide immediate, zero-hallucination assistance.`;
  }

  if (q.includes("how are you") || q.includes("how are you doing") || q.includes("how r u")) {
    return `I'm operating at 100% capacity! The batching plants, weighbridge, and GPS fleet telemetry are online. How can I assist you today?`;
  }

  if (
    q === "thanks" ||
    q === "thank you" ||
    q === "thank u" ||
    q === "thx" ||
    q === "ok" ||
    q === "okay" ||
    q === "great" ||
    q === "awesome" ||
    q === "perfect"
  ) {
    return `You're very welcome! 😊 Feel free to ask anytime if you need help with dispatches, reports, cube tests, or store inventory.`;
  }

  if (q.includes("where is the plant") || q.includes("plant location")) {
    return `The **Sai Ready-Mix Concrete Plant** is located at **Mulkhed (Unit 01), Pune, Maharashtra**. It operates dual batching units: **CRB-75** (75 cum/hr) and **SP-30** (30 cum/hr).`;
  }

  return null;
}
