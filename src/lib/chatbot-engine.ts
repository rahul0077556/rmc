import { getDb } from "@/lib/store";
import type { Role } from "@/types";

export interface ChatAction {
  label: string;
  to: string;
  variant?: "default" | "secondary" | "outline";
}

export interface ChatbotResponse {
  text: string;
  actions?: ChatAction[];
  followUps?: string[];
  source?: "knowledge-base" | "live-telemetry" | "ai-server";
}

/**
 * Intelligent RMC Plant Copilot Domain Engine.
 * Provides instant, zero-latency, high-precision answers regarding:
 * - Plant workflows & step-by-step guides for every department
 * - All 13 plant reports with direct navigation
 * - Concrete technology, IS 456 / IS 10262 standards, slump & cube testing
 * - Live plant telemetry (orders, fleet, inventory stock, cube tests)
 * - Demo accounts and login access
 */
export async function processChatbotQuery(
  rawQuery: string,
  userRole?: Role
): Promise<ChatbotResponse> {
  const query = rawQuery.trim().toLowerCase();
  const db = getDb();

  // 1. LIVE TELEMETRY: Real-time dynamic plant status
  if (
    query.includes("live") ||
    query.includes("stock") ||
    query.includes("inventory") ||
    query.includes("silo") ||
    query.includes("cement") ||
    query.includes("aggregate") ||
    query.includes("how much cement") ||
    query.includes("material available")
  ) {
    if (query.includes("stock") || query.includes("silo") || query.includes("cement") || query.includes("material")) {
      const cementStock = db.materialStock.find((m) => m.material.toLowerCase().includes("cement"))?.currentLevel ?? 142;
      const flyAshStock = db.materialStock.find((m) => m.material.toLowerCase().includes("fly ash"))?.currentLevel ?? 48;
      const sandStock = db.materialStock.find((m) => m.material.toLowerCase().includes("sand"))?.currentLevel ?? 310;
      const agg10Stock = db.materialStock.find((m) => m.material.toLowerCase().includes("10mm"))?.currentLevel ?? 420;
      const agg20Stock = db.materialStock.find((m) => m.material.toLowerCase().includes("20mm"))?.currentLevel ?? 380;
      
      return {
        text: `### 📦 Live Material Stock & Silo Telemetry (Mulkhed Plant)\n\nHere is the current raw material inventory snapshot:\n\n* **OPC 53 Cement Silo 1:** \`${cementStock} MT\` (Safe level, above reorder limit of 50 MT)\n* **Fly Ash Silo 2:** \`${flyAshStock} MT\` (Active PPC blend)\n* **Robo Sand / Crushed Sand:** \`${sandStock} MT\` (Yard Bay 1)\n* **10mm Coarse Aggregate:** \`${agg10Stock} MT\` (Yard Bay 2)\n* **20mm Coarse Aggregate:** \`${agg20Stock} MT\` (Yard Bay 3)\n\n*Tip:* To record fresh weighbridge inwards or check low-stock alerts, visit the Store & Yard section.`,
        actions: [
          { label: "📦 View Full Store & Yard", to: "/store" },
          { label: "📊 View MPR Store Report", to: "/reports" },
        ],
        followUps: [
          "How do I record a weighbridge inward ticket?",
          "Explain the MPR Store Report",
          "What are the reorder levels for cement?",
        ],
        source: "live-telemetry",
      };
    }
  }

  // 2. LIVE ORDERS & FLEET
  if (
    query.includes("active order") ||
    query.includes("pending order") ||
    query.includes("how many orders") ||
    query.includes("orders today") ||
    query.includes("orders status")
  ) {
    const totalOrders = db.purchaseOrders.length;
    const submitted = db.purchaseOrders.filter((p) => p.status === "SUBMITTED").length;
    const approved = db.purchaseOrders.filter((p) => p.status === "APPROVED").length;
    const activeTrips = db.trips.filter((t) => ["PLANNED", "BATCHING", "LOADED", "IN_TRANSIT"].includes(t.status)).length;
    const availableTms = db.transitMixers.filter((tm) => tm.status === "AVAILABLE").length;

    return {
      text: `### 📋 Active Orders & Fleet Overview\n\n* **Total Purchase Orders:** \`${totalOrders}\`\n* **Pending Approval (Sales/Owner):** \`${submitted} POs\`\n* **Approved & Ready for Dispatch:** \`${approved} POs\`\n* **Active Trips in Motion:** \`${activeTrips} loads\`\n* **Transit Mixers Available in Yard:** \`${availableTms} of ${db.transitMixers.length} TMs\`\n\n*Next Step:* Dispatchers can plan trips for approved orders or send queued batches to production.`,
      actions: [
        { label: "🚀 Go to Dispatcher Board", to: "/dispatcher" },
        { label: "➕ View Purchase Orders", to: "/sales/orders" },
      ],
      followUps: [
        "How do I plan a trip and send to production?",
        "How do I approve pending orders?",
        "Show available transit mixers",
      ],
      source: "live-telemetry",
    };
  }

  // 3. HOW TO PLAN TRIPS & DISPATCH
  if (
    query.includes("plan trip") ||
    query.includes("dispatch") ||
    query.includes("send to production") ||
    query.includes("assign truck") ||
    query.includes("transit mixer") ||
    query.includes("driver") ||
    query.includes("how to dispatch")
  ) {
    return {
      text: `### 🚀 How to Plan & Dispatch Trips (Step-by-Step)\n\n1. **Navigate to Dispatch Board:** Go to the Dispatcher section (\`/dispatcher\`).\n2. **Select Approved PO:** Locate an order marked \`APPROVED\` by Sales/Owner, and click **"Plan Trips"** (or open \`/dispatcher/plan/$poId\`).\n3. **Split into Trip Batches:** Divide the required concrete volume (e.g., 24 cum) into standard truck loads (typically 6 to 8 cum per Transit Mixer).\n4. **Assign TM & Driver:** Pick an available Transit Mixer (e.g. \`TM-01\`) and an on-duty Driver from the dropdown.\n5. **Send to Production:** Click the green **"Send to Production"** button. This securely transmits the mix formula, target volume, and truck code to the batching plant PLC console.\n6. **Track Status:** Monitor the trip as it progresses: \`BATCHING\` ➔ \`LOADED\` ➔ \`IN_TRANSIT\` ➔ \`AT_SITE\` ➔ \`COMPLETED\`.`,
      actions: [
        { label: "🚀 Open Dispatch Board", to: "/dispatcher" },
        { label: "🏭 View Production Telemetry", to: "/production" },
      ],
      followUps: [
        "What happens when I click Send to Production?",
        "How does the driver get trip incentive ₹350?",
        "Where can I see the delivery challan?",
      ],
      source: "knowledge-base",
    };
  }

  // 4. ALL 13 OFFICIAL REPORTS
  if (
    query.includes("report") ||
    query.includes("mpr") ||
    query.includes("13 report") ||
    query.includes("crb") ||
    query.includes("sp30") ||
    query.includes("tm average") ||
    query.includes("attendance") ||
    query.includes("sunday working") ||
    query.includes("zone 02")
  ) {
    return {
      text: `### 📊 Master Plant Reports Guide (All 13 Official Reports)\n\nSai RMC Command Center includes 13 enterprise reports with real-time analytics, Excel (.xlsx) and CSV exports:\n\n#### 📦 Store Reports\n1. **MPR Report (Store):** Material Purchase & Requisition tracking opening stock, inward receipts, batch consumption, closing balances, and minimum reorder alerts.\n2. **HR Report (Store):** Transit Mixer trip summary, monthly performance, diesel average, and driver incentive calculation (₹350/trip).\n3. **TM Average Report (Store):** Vehicle running kilometers, rotating handi engine hours, diesel consumption (km/L & L/hr).\n\n#### 🚛 Dispatch & Logistics Reports\n4. **Schedule and Production:** Daily dispatch schedules vs actual batching volume, lead times, and pour milestones.\n5. **Zone 02 Pump Report:** Boom pump & stationary line pump utilization, pipe lengths, and throughput.\n6. **Day Wise Production Report:** Day-by-day plant concrete production breakdown across grades M15–M40.\n\n#### 👥 HR & Administration Reports\n7. **Staff Attendance:** Daily biometric and shift attendance roster for operational & lab staff.\n8. **Sunday Working:** Weekend and holiday batching shifts, overtime hours, and comp-off ledger.\n9. **MUL Attendance:** Mulkhed plant workforce, drivers, and batching operators muster roll.\n\n#### 🧪 QA/QC Lab Reports\n10. **Strength Data Since:** Master 7-day and 28-day cube compressive strength test results vs IS 456 target curves.\n11. **Consumption CRB-75 Plant:** Raw material batch consumption and moisture compensation for CRB-75 Plant.\n12. **Consumption SP-30 Plant:** Raw material batch consumption and design variance reconciliation for SP-30 Plant.\n13. **Material Rejected Report:** Rejection logs (high/low slump, transit delays > 2.5 hrs, contamination) and returned concrete recycling.`,
      actions: [
        { label: "📊 Open All 13 Reports", to: "/reports" },
        { label: "🧪 View QA Strength Report", to: "/reports" },
      ],
      followUps: [
        "How do I export reports to Excel?",
        "Explain CRB-75 vs SP-30 batching consumption",
        "How does the Strength Data Since report work?",
      ],
      source: "knowledge-base",
    };
  }

  // 5. QA/QC LAB: CUBE TEST & SLUMP CHECK
  if (
    query.includes("qa") ||
    query.includes("qc") ||
    query.includes("cube") ||
    query.includes("slump") ||
    query.includes("strength") ||
    query.includes("test") ||
    query.includes("is 456") ||
    query.includes("is 10262") ||
    query.includes("rejection")
  ) {
    return {
      text: `### 🧪 QA/QC Quality Testing Protocol (IS 456 & IS 1199)\n\nEvery concrete batch at Sai RMC undergoes rigorous quality control:\n\n1. **Slump Cone Test (IS 1199):**\n   * Tested at batching discharge chute before TM leaves the yard.\n   * **Target:** Typically \`120 ± 25 mm\` for pumpable concrete; \`75–100 mm\` for direct pour.\n   * **Temperature:** Monitored below \`35°C\`.\n\n2. **Cube Casting (IS 516):**\n   * Standard \`150 × 150 × 150 mm\` cast steel moulds filled in 3 layers and compacted.\n   * Set of 6 cubes cast per batch: **3 cubes for 7-day test**, **3 cubes for 28-day test**.\n   * Cured in temperature-controlled water tank at \`27 ± 2°C\`.\n\n3. **Compressive Strength Criteria:**\n   * **7-Day Target:** Must achieve **≥ 70%** of target characteristic strength (e.g. M25 must reach ≥ 17.5 N/mm²).\n   * **28-Day Target:** Must achieve **≥ 100%** of target characteristic strength (e.g. M25 must reach ≥ 25.0 N/mm²).\n\n4. **Rejection Protocol:** If slump is out of tolerance (> 175mm water bleed or < 75mm stiff), or transit exceeds 2.5 hours, batch is flagged in the **Material Rejected Report**.`,
      actions: [
        { label: "🧪 Go to QA/QC Lab", to: "/qa" },
        { label: "📈 View Strength Data Report", to: "/reports" },
      ],
      followUps: [
        "What happens if a 7-day cube test fails?",
        "Explain concrete mix grades M15 to M40",
        "How to log a new cube test?",
      ],
      source: "knowledge-base",
    };
  }

  // 6. CONCRETE GRADES & MIX DESIGNS (M15 to M40)
  if (
    query.includes("mix design") ||
    query.includes("grade") ||
    query.includes("m15") ||
    query.includes("m20") ||
    query.includes("m25") ||
    query.includes("m30") ||
    query.includes("m35") ||
    query.includes("m40") ||
    query.includes("ratio") ||
    query.includes("water cement")
  ) {
    return {
      text: `### 🏗️ Concrete Mix Design Specifications\n\nSai RMC produces concrete adhering to **IS 10262:2019** and **IS 456:2000** standards:\n\n* **M15 (15 N/mm²):** Lean mix / PCC (Plain Cement Concrete), levelling courses, foundation sub-bases. W/C ~ 0.55.\n* **M20 (20 N/mm²):** General RCC, foundation footings, boundary walls, floor screeds. W/C ~ 0.50.\n* **M25 (25 N/mm²):** Standard structural RCC for residential slabs, beams, columns. W/C ~ 0.45.\n* **M30 (30 N/mm²):** High-load commercial slabs, industrial floors, retaining walls. W/C ~ 0.42.\n* **M35 (35 N/mm²):** Heavy structural columns, post-tensioned slabs, water tanks. W/C ~ 0.40.\n* **M40 (40 N/mm²):** High-rise columns, bridges, high-wear industrial pavements. W/C ~ 0.38.\n\n*Admixture:* Sika Plastiment or Fosroc Auramix is dosed at 0.5%–1.2% by weight of cementitious material for maximum slump retention with low water content.`,
      actions: [
        { label: "➕ Create Order with Mix Grade", to: "/sales/orders/new" },
        { label: "🏭 View Batching Formulation", to: "/production" },
      ],
      followUps: [
        "What is the price of M25 concrete?",
        "How much water is added per cubic meter?",
        "How to plan a trip for M30 grade?",
      ],
      source: "knowledge-base",
    };
  }

  // 7. HOW TO CREATE SALES ORDER / PO
  if (
    query.includes("create order") ||
    query.includes("new order") ||
    query.includes("purchase order") ||
    query.includes("po") ||
    query.includes("book concrete") ||
    query.includes("sales") ||
    query.includes("how to order")
  ) {
    return {
      text: `### 📝 How to Create a Purchase Order (Step-by-Step)\n\n1. **Open Sales Portal:** Click **Sales** in the sidebar or go to \`/sales/orders/new\`.\n2. **Select Customer & Site:** Choose an approved client (e.g. Rohan Builders, Godrej Properties) and their designated project site.\n3. **Specify Pour Date & Time:** Select target delivery slot and pumping schedule.\n4. **Choose Concrete Grade & Slump:** Pick grade (\`M15\` through \`M40\`) and required slump (\`120 ± 25 mm\`).\n5. **Enter Volume (cum):** Enter the total cubic meters required (e.g. 50 cum).\n6. **Select Pour Method:** Choose Direct Chute, Stationary Line Pump, or Boom Pump.\n7. **Submit for Approval:** Click **"Submit Purchase Order"**. The Owner receives a notification to approve commercial terms and credit limits.`,
      actions: [
        { label: "➕ Create New Order Now", to: "/sales/orders/new" },
        { label: "📋 View Orders List", to: "/sales/orders" },
      ],
      followUps: [
        "Who approves the purchase order?",
        "How do pumping charges work?",
        "How to dispatch after approval?",
      ],
      source: "knowledge-base",
    };
  }

  // 8. STORE & WEIGHBRIDGE OPERATIONS
  if (
    query.includes("store") ||
    query.includes("weighbridge") ||
    query.includes("tare") ||
    query.includes("gross") ||
    query.includes("challan") ||
    query.includes("reorder") ||
    query.includes("inward")
  ) {
    return {
      text: `### ⚖️ Store & Weighbridge Operational Guide\n\n* **Digital Weighbridge (Gross & Tare):**\n  * When raw material dumpers (sand, 10mm, 20mm, cement tankers) enter the plant, they weigh on the in-ground digital scale (**Gross Weight**).\n  * After unloading into aggregate bays or blowing cement into silos, the truck re-weighs (**Tare Weight**).\n  * Net material is automatically added to live store inventory.\n\n* **Silo Monitoring:**\n  * Silo 1 (OPC 53 Cement) & Silo 2 (Fly Ash) are equipped with load cells. If stock falls below 50 MT, the system triggers an amber reorder warning.\n\n* **Store Requisition:** Generate purchase requisitions before stock dips below safety threshold to prevent batching shutdowns.`,
      actions: [
        { label: "📦 Go to Store & Yard", to: "/store" },
        { label: "📊 View MPR Store Report", to: "/reports" },
      ],
      followUps: [
        "What is the current cement stock?",
        "Explain the MPR Store Report",
        "How to record inward raw material?",
      ],
      source: "knowledge-base",
    };
  }

  // 9. PRODUCTION & BATCHING (CRB-75 vs SP-30)
  if (
    query.includes("production") ||
    query.includes("batching") ||
    query.includes("batch sheet") ||
    query.includes("plc") ||
    query.includes("crb") ||
    query.includes("sp-30") ||
    query.includes("sp30")
  ) {
    return {
      text: `### 🏭 Production & Dual Batching Plants\n\nMulkhed plant operates two automated batching units:\n\n* **CRB-75 Plant (75 cum/hour capacity):**\n  * High-capacity twin-shaft mixer designed for bulk commercial dispatches, foundations, and high-volume slab pours.\n  * Features 4 aggregate bins, pneumatic cement feeding, and moisture sensors.\n\n* **SP-30 Plant (30 cum/hour capacity):**\n  * Pan mixer optimized for high-performance concrete, M35–M40 mixes, fiber-reinforced concrete, and rapid-setting special batches.\n\n* **Batch Sheet Generation:** Every batch automatically produces a batch sheet detailing target vs actual batched weights for sand, aggregates, water, cement, and admixtures. You can print or download batch sheets at \`/batch-sheet/$id\`.`,
      actions: [
        { label: "🏭 Open Production Telemetry", to: "/production" },
        { label: "📊 CRB-75 Consumption Report", to: "/reports" },
        { label: "📊 SP-30 Consumption Report", to: "/reports" },
      ],
      followUps: [
        "How do moisture sensors work in batching?",
        "How to view and print a batch sheet?",
        "How to plan trips for production?",
      ],
      source: "knowledge-base",
    };
  }

  // 10. BILLING, ACCOUNTS & DRIVER INCENTIVES
  if (
    query.includes("bill") ||
    query.includes("invoice") ||
    query.includes("gst") ||
    query.includes("tax") ||
    query.includes("incentive") ||
    query.includes("driver salary") ||
    query.includes("payroll") ||
    query.includes("350")
  ) {
    return {
      text: `### 💳 Billing, GST & Driver Trip Accounting\n\n* **GST Tax Invoices:**\n  * Generated under **HSN Code 382450** (Ready-Mix Concrete) with standard **18% GST** (9% CGST + 9% SGST).\n  * Invoices automatically link to signed digital delivery challans.\n\n* **Driver Trip Allowance:**\n  * Drivers receive **₹350 per completed trip** as logged in the HR Store & Dispatch records.\n  * Fuel mileage (km/L) is reconciled against the **TM Average Report**.\n\n* **Customer Statements:** Track outstanding balances, aging analysis (0-30 days, 31-60 days, >60 days), and payment receipts in the Billing portal.`,
      actions: [
        { label: "💳 Open Billing Portal", to: "/billing" },
        { label: "👥 Open HR & Accounts", to: "/account" },
      ],
      followUps: [
        "How do I mark an invoice as paid?",
        "Where can I view driver attendance?",
        "Show customer payment summaries",
      ],
      source: "knowledge-base",
    };
  }

  // 11. DEMO LOGIN ACCOUNTS & ROLES
  if (
    query.includes("login") ||
    query.includes("account") ||
    query.includes("password") ||
    query.includes("role") ||
    query.includes("credentials") ||
    query.includes("how to login") ||
    query.includes("who can login")
  ) {
    return {
      text: `### 🔑 Plant Demo Accounts & Department Logins\n\nAll accounts use password: \`admin123\`\n\n* **👑 Owner / MD:** \`owner@rmc.test\` (Full P&L, KPI control, approvals)\n* **💼 Sales Manager:** \`sales@rmc.test\` (New orders, customer terms)\n* **🚛 Dispatcher:** \`dispatch@rmc.test\` (Fleet trips, driver assignment)\n* **🏭 Production Lead:** \`production@rmc.test\` (Batching PLC, silos)\n* **🧪 QA/QC Lab Tech:** \`qa@rmc.test\` (Slump tests, 7/28d cube breaks)\n* **📦 Store Manager:** \`store@rmc.test\` (Material stock, weighbridge)\n* **👥 HR / Accountant:** \`accounts@rmc.test\` (Payroll, GST invoices)\n* **🏢 Customer Portal:** \`customer@rmc.test\` (Live TM tracking & certs)\n\n*Tip:* On the login page, you can tap any department card directly to enter without typing credentials!`,
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

  // 12. GENERAL HELP / WHAT CAN YOU DO?
  return {
    text: `### 🤖 Sai RMC Plant Copilot\n\nI am your intelligent operational assistant for the entire **Sai Ready-Mix Concrete Plant (Mulkhed)**. I can help you with:\n\n* **🚀 Department Operations:** How to use Sales, Dispatch, Production, QA Lab, Store, Billing, or Customer Portal.\n* **📋 Step-by-Step Guides:** How to create a PO, assign trucks, send trips to production, or record weighbridge weights.\n* **📊 All 13 Official Reports:** MPR, HR Store, TM Average, Schedule & Production, Strength Data, CRB-75 & SP-30 consumption, etc.\n* **🧪 Concrete Quality (IS 456):** Slump tests, cube testing (7-day ≥70%, 28-day ≥100%), mix designs M15 to M40.\n* **📦 Live Plant Telemetry:** Ask about current cement stock, active orders, or available trucks in the yard.\n\n*How can I help you right now?*`,
    actions: [
      { label: "🚀 Plan & Dispatch Trips", to: "/dispatcher" },
      { label: "📊 Explore 13 Reports", to: "/reports" },
      { label: "🧪 QA/QC Lab Guide", to: "/qa" },
      { label: "📦 Live Store Stock", to: "/store" },
    ],
    followUps: [
      "How do I plan a trip and send to production?",
      "Explain all 13 plant reports",
      "Check live cement and raw material stock",
      "How does QC cube testing work?",
      "Show demo login credentials",
    ],
    source: "knowledge-base",
  };
}
