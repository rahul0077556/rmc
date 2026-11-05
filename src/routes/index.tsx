import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Boxes,
  Truck,
  Warehouse,
  FlaskConical,
  Package,
  FileSpreadsheet,
  Users,
  Building2,
  Gauge,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Workflow,
  Sparkles,
  Layers,
  BarChart3,
  Scale,
  Zap,
  Check,
  Activity,
  ArrowUpRight,
  Shield,
  Clock,
  Compass,
  CheckCircle2,
  ChevronRight,
  Phone,
  Mail,
  HardHat,
  FileText,
  Crown,
  Database,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeSwitcher } from "@/components/app/ThemeSwitcher";
import { RmcChatbot } from "@/components/chatbot/RmcChatbot";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MixFlow OS · Enterprise Ready-Mix Concrete SaaS Platform" },
      {
        name: "description",
        content:
          "The universal multi-tenant cloud operating system for ready-mix concrete producers. Connect SCADA batching systems, transit mixer fleets, laboratory quality assurance, and automated GST billing across your client plants.",
      },
    ],
  }),
  component: ProductLandingPage,
});

const PLATFORM_SOLUTIONS = [
  {
    id: "batching",
    label: "01 / SCADA Batching",
    tag: "Hardware-Agnostic Telemetry",
    title: "Real-Time SCADA Batching & Auto-Stock Deduction",
    description:
      "Direct integration with any batching controller (CRB-75, Schwing Stetter, Liebherr, Simem). Ingests live optical/CSV batch reports, calculates sand moisture compensation, verifies theoretical versus actual variance, and deducts live inventory from vertical cement and aggregate silos.",
    highlights: [
      "Hardware-agnostic SCADA ingestion with sub-second polling",
      "Per-batch aggregate, cement, water, and admixture variance tracking",
      "Instant inventory deduction from live storage silos and tanks",
      "Automated QC warning flags when batch deviates from IS 10262 design mix",
    ],
    badge: "SCADA Core",
    metricValue: "±0.4%",
    metricLabel: "Batch Tolerance",
  },
  {
    id: "dispatch",
    label: "02 / Smart Fleet & Dispatch",
    tag: "Transit Mixer Logistics",
    title: "Intelligent Fleet Scheduling & Emergency Breakdown Swaps",
    description:
      "Automated transit mixer queue allocation based on real-time site pour rates, travel windows, and driver availability. Features 1-click emergency TM vehicle swaps with full audit trails to safeguard concrete slump retention on road.",
    highlights: [
      "Dynamic transit mixer payload & axle weight validation",
      "Turnaround cycle tracking: Gate Out, On-Site, Pouring, Return to Plant",
      "Emergency breakdown swap & trip rescheduling with complete audit history",
      "SMS & WhatsApp customer delivery notifications with live tracking links",
    ],
    badge: "Fleet Intelligence",
    metricValue: "42 min",
    metricLabel: "Avg Turnaround Time",
  },
  {
    id: "qa",
    label: "03 / QA Lab Compliance",
    tag: "IS 456 & IS 10262",
    title: "Laboratory Quality Certification & Cube Strength Tracking",
    description:
      "Eliminates handwritten lab books. Enforces IS 456 slump inspection at batching gate, schedules automated 7-day and 28-day cube compression testing dates, and generates tamper-proof digital quality certificates for client submission.",
    highlights: [
      "Slump retention monitoring against elapsed batching time",
      "Automated 7-day and 28-day cube compression testing schedule",
      "Statistical characteristic strength curves (IS 10262 compliance)",
      "Digital lab certificate export with direct client portal download",
    ],
    badge: "IS 456 Quality",
    metricValue: "99.8%",
    metricLabel: "Test Compliance",
  },
  {
    id: "store",
    label: "04 / Store & Weighbridge",
    tag: "Weighbridge Automation",
    title: "Weighbridge Gross/Tare Inward & Dynamic Silo Catalog",
    description:
      "Full material accountability from aggregate arrival to mixer discharge. Records gross and tare truck weights automatically, supports custom novel materials, and tracks silo balances across OPC 53, Fly Ash, GGBS, M-Sand, 10mm/20mm, and admixtures.",
    highlights: [
      "Automated gross & tare weighbridge capture with tolerance bounds",
      "Dynamic material catalog support with custom reorder levels",
      "Automated reconciliation of inward vendor delivery consignments",
      "Negative stock protection and real-time inventory alerts",
    ],
    badge: "Zero Stock Leakage",
    metricValue: "100%",
    metricLabel: "Inward Reconciliation",
  },
];

const MULTI_TENANT_CLIENTS = [
  {
    name: "ROXXCON RMC NAGPUR",
    city: "Nagpur, Maharashtra",
    capacity: "60 cum/hr",
    scada: "CRB-75 Plant Controller",
    fleet: "14 Transit Mixers",
    status: "Enterprise Client",
  },
  {
    name: "Apex Ready Mix Concrete",
    city: "Pune, Maharashtra",
    capacity: "90 cum/hr",
    scada: "Schwing Stetter MCI 70",
    fleet: "22 Transit Mixers",
    status: "Enterprise Client",
  },
  {
    name: "Sai Concrete Infrastructure",
    city: "Nashik, Maharashtra",
    capacity: "60 cum/hr",
    scada: "Liebherr Litronic-MPS",
    fleet: "12 Transit Mixers",
    status: "Enterprise Client",
  },
  {
    name: "Shree Ram Concrete Hub",
    city: "Mumbai, Maharashtra",
    capacity: "120 cum/hr",
    scada: "Simem Bravo Control",
    fleet: "28 Transit Mixers",
    status: "Enterprise Client",
  },
];

const SUB_LOGIN_ROLES_EXPLAINED = [
  { title: "Plant Owner / Director", role: "Owner", desc: "Executive dashboard, P&L analytics, and financial audit logs.", icon: Crown, color: "text-amber-400" },
  { title: "Sales Desk", role: "Sales", desc: "Customer master, site geotagging, and new PO booking.", icon: FileText, color: "text-teal-400" },
  { title: "Sales Manager", role: "Manager", desc: "Commercial credit verification and price exception approvals.", icon: Gauge, color: "text-cyan-400" },
  { title: "Dispatch Master", role: "Dispatcher", desc: "Fleet scheduling, TM turnaround, and emergency vehicle swaps.", icon: Truck, color: "text-sky-400" },
  { title: "Site Supervisor", role: "Supervisor", desc: "On-site pouring tracking, pump ops, and receipt acknowledgments.", icon: HardHat, color: "text-lime-400" },
  { title: "Production Engineer", role: "Production", desc: "SCADA batch report ingestion, moisture trim, and batching queue.", icon: Package, color: "text-orange-400" },
  { title: "QA / QC Lab In-Charge", role: "QA / QC", desc: "IS 456 slump checks, 7d/28d cube casting & compression testing.", icon: FlaskConical, color: "text-purple-400" },
  { title: "Store & Weighbridge", role: "Store", desc: "Automated gross/tare weighbridge, live silo stock, and gate inward.", icon: Warehouse, color: "text-yellow-400" },
  { title: "Accounts & Billing", role: "Accounts", desc: "Delivery challan release, GST e-invoices, and driver payroll.", icon: Users, color: "text-rose-400" },
  { title: "Customer Client Portal", role: "Customer", desc: "Client self-service: live order status, e-challans, and lab certificates.", icon: Building2, color: "text-indigo-400" },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    phase: "Order Intake & Approval",
    title: "PO Booking & Capacity Reservation",
    description:
      "Sales desk inputs contractor PO, pour site coordinates, and concrete grade (M10-M80). Automated commercial checks verify customer credit limits and plant hourly capacity before dispatch approval.",
    icon: FileText,
  },
  {
    step: "02",
    phase: "Automated Batching",
    title: "SCADA Ingestion & Raw Material Trim",
    description:
      "Plant operator triggers batching. SCADA system measures real-time sand moisture, trims batch weights, deducts cement and aggregate silos, and records actual consumption into the database.",
    icon: Cpu,
  },
  {
    step: "03",
    phase: "Dispatch & Logistics",
    title: "Transit Mixer Gate Pass & Slump QC",
    description:
      "Transit mixer is loaded and passes gate inspection. Lab technician certifies slump. The system issues an electronic delivery challan with QR code and live ETA tracking for site engineers.",
    icon: Truck,
  },
  {
    step: "04",
    phase: "Testing & Accounting",
    title: "Cube Compression & Instant Invoicing",
    description:
      "Cube samples are logged for 7-day & 28-day crushing tests. The accounts team releases computerized GST tax invoices with matched challan slips in 1 click.",
    icon: BarChart3,
  },
];

const PRICING_PLANS = [
  {
    name: "Single Plant Starter",
    desc: "For independent ready-mix concrete operators with 1 batching plant.",
    price: "₹18,500",
    period: "per month",
    badge: "Popular",
    features: [
      "1 Ready-Mix Batching Plant",
      "Up to 10 Transit Mixers",
      "All 10 Department Sub-Logins included",
      "SCADA Batch Sheet Ingestion (CRB-75 / CSV)",
      "Automated Delivery Challans & GST Billing",
      "IS 456 Slump & Cube Strength Log",
      "13 Turnkey Plant Reports (DPR, Silos, Audit)",
      "Standard Email & Chat Support",
    ],
    cta: "Start 14-Day Free Trial",
    highlight: false,
  },
  {
    name: "Multi-Plant Enterprise",
    desc: "For commercial concrete producers managing multiple plant locations.",
    price: "₹42,000",
    period: "per month",
    badge: "Best Value",
    features: [
      "Up to 4 Batching Plant Workspaces",
      "Up to 35 Transit Mixers across fleet",
      "Dedicated Client Workspaces & Tenant URLs",
      "Hardware-Agnostic SCADA Polling (Schwing, Liebherr)",
      "Automated Gross/Tare Weighbridge Integration",
      "Centralized Multi-Plant Dispatcher Board",
      "Emergency Vehicle Swap Audit Trail",
      "Custom ERP & Tally / SAP Integration",
      "Dedicated Plant Onboarding Specialist",
    ],
    cta: "Onboard Your Enterprise",
    highlight: true,
  },
  {
    name: "Custom Cloud / On-Prem",
    desc: "For large infrastructure conglomerates and turnkey government contractors.",
    price: "Custom",
    period: "annual licensing",
    badge: "Enterprise",
    features: [
      "Unlimited Plant Locations & Silos",
      "Unlimited Transit Mixers & Pumps",
      "Dedicated Private Cloud or On-Premise Server",
      "Custom SCADA PLC / Modbus Direct Polling",
      "SLA 99.99% Guaranteed Uptime",
      "Custom Mobile Apps with Plant Branding",
      "Enterprise Single Sign-On (SSO / SAML)",
      "24/7 Dedicated Priority Phone Support",
    ],
    cta: "Contact Enterprise Sales",
    highlight: false,
  },
];

function ProductLandingPage() {
  const [activeSolutionTab, setActiveSolutionTab] = useState(0);
  const navigate = useNavigate();

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  const currentSolution = PLATFORM_SOLUTIONS[activeSolutionTab]!;

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] selection:bg-emerald-500 selection:text-black font-sans antialiased relative overflow-x-hidden">
      {/* Background Tech Grid & Ambient Spotlights */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/3 right-10 w-[600px] h-[400px] bg-cyan-500/5 blur-[160px] rounded-full pointer-events-none" />
      </div>

      {/* ============================================================ */}
      {/* TOP NAVIGATION BAR                                           */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#07090e]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Product Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-black font-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Boxes className="size-5" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                MixFlow <span className="text-emerald-400">OS</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Enterprise RMC Cloud
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={() => scrollToSection("solutions")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Platform Solutions
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("architecture")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              SCADA Architecture
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("multi-tenant")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Multi-Plant Tenancy
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("workflows")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Workflow Pipeline
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("pricing")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Pricing & ROI
            </button>
            <Link
              to="/reports"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1 text-slate-400"
            >
              <FileSpreadsheet className="size-3 text-emerald-400" />
              <span>13 Reports</span>
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-pointer bg-white/[0.02]"
            >
              <Lock className="size-3 text-emerald-400" />
              <span>Client Sign In</span>
            </Link>
            <Link
              to="/login"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs h-9 px-4 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Explore Platform</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* HERO SECTION                                                 */}
      {/* ============================================================ */}
      <section className="relative z-10 pt-16 sm:pt-24 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-6 shadow-sm shadow-emerald-500/20">
          <Sparkles className="size-3.5 text-emerald-400" />
          <span>The Next-Generation Operating System for Ready-Mix Concrete Plants</span>
        </div>

        {/* Big Bold Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
          One Platform. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            Endless Concrete Automation.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-sm sm:text-base lg:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-normal">
          Empower your ready-mix concrete enterprise with universal cloud SCADA telemetry, automated gate challans, IS 456 lab compliance, and multi-tenant plant workspaces. Deliver turnkey plant intelligence to all your operating facilities.
        </p>

        {/* Hero CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login"
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm h-12 px-7 rounded-xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Onboard Your Plant Workspace</span>
            <ArrowRight className="size-4" />
          </Link>

          <Link
            to="/login"
            className="w-full sm:w-auto text-sm font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 h-12 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Lock className="size-4 text-emerald-400" />
            <span>Client Portal Sign In</span>
          </Link>
        </div>

        {/* Value Metrics Ticker */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Multi-Plant Ready</span>
            <div className="text-2xl font-black text-white mt-1">Multi-Tenant</div>
            <span className="text-[11px] text-emerald-400 font-medium">Segregated Workspaces</span>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SCADA Compatibility</span>
            <div className="text-2xl font-black text-white mt-1">100% Universal</div>
            <span className="text-[11px] text-emerald-400 font-medium">CRB-75, Schwing, Liebherr</span>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sub-Logins Included</span>
            <div className="text-2xl font-black text-white mt-1">10 Roles</div>
            <span className="text-[11px] text-emerald-400 font-medium">Owner to Lab Tech</span>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Concrete Standards</span>
            <div className="text-2xl font-black text-white mt-1">IS 456 & 10262</div>
            <span className="text-[11px] text-emerald-400 font-medium">Digital Certifications</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* NODE ARCHITECTURE TOPOLOGY (ORVYN INSPIRATION)               */}
        {/* ============================================================ */}
        <div id="architecture" className="mt-20 scroll-mt-24">
          <div className="relative rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.03] to-transparent p-6 sm:p-10 shadow-2xl backdrop-blur-md overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-500/10 blur-[100px] pointer-events-none rounded-full" />

            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                System Topology
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                How MixFlow OS Bridges Hardware to Cloud
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                Physical controllers, gross/tare scales, and vehicle telemetry stream into our central cloud engine in real time.
              </p>
            </div>

            {/* Architecture Node Diagram */}
            <div className="relative grid grid-cols-1 lg:grid-cols-7 gap-6 items-center">
              {/* Left Column: 3 Source Inputs */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">01 / COMMERCIAL DESK</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">Active</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-emerald-300 transition-colors">
                    Client PO & Credit Check
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    PO intake, credit term verification, and pour site coordinates.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-400 font-semibold">02 / SCADA INTEGRATION</span>
                    <Badge variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-400 bg-cyan-500/10">Real-Time</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-cyan-300 transition-colors">
                    Batch Telemetry Ingestion
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    CRB-75 optical/CSV parsing, moisture trim, & design mix variance.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-400 font-semibold">03 / WEIGHBRIDGE INWARD</span>
                    <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/10">Synchronized</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-amber-300 transition-colors">
                    Gross / Tare Silo Sync
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Raw aggregate, cement, and admixture live balances & reconciliation.
                  </p>
                </div>
              </div>

              {/* Center Column: MixFlow OS Cloud Hub */}
              <div className="lg:col-span-3 flex flex-col items-center justify-center py-4 sm:py-6">
                <div className="relative group">
                  <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-75 transition duration-500" />
                  
                  <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-500/50 bg-[#0c1017] p-6 sm:p-8 text-center shadow-2xl">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 mb-3 shadow-inner">
                      <Cpu className="size-7 animate-pulse text-emerald-400" />
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-bold">
                      MIXFLOW OS CLOUD ENGINE
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-white mt-1">
                      Multi-Tenant Orchestrator
                    </h3>
                    <p className="text-xs text-slate-300 mt-2 max-w-xs leading-relaxed">
                      Isolated tenant databases, real-time event distribution, emergency vehicle swap handling, and unified audit trails.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                      <Activity className="size-3 text-emerald-400 animate-spin" />
                      10 Role-Segregated Sub-Logins
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: 3 Output Destinations */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-sky-400 font-semibold">04 / DISPATCH & FLEET</span>
                    <Badge variant="outline" className="text-[9px] border-sky-500/30 text-sky-400 bg-sky-500/10">Live GPS</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-sky-300 transition-colors">
                    Transit Mixer Allocation
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Payload capacity check, driver turnaround, and breakdown swaps.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-purple-400 font-semibold">05 / QUALITY ASSURANCE</span>
                    <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-400 bg-purple-500/10">Certified</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-purple-300 transition-colors">
                    IS 456 Slump & 28D Cubes
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Casting schedules, compression testing dates, & digital certificates.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-rose-400 font-semibold">06 / ERP & GST BILLING</span>
                    <Badge variant="outline" className="text-[9px] border-rose-500/30 text-rose-400 bg-rose-500/10">1-Click GST</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-rose-300 transition-colors">
                    Delivery Challans & Invoices
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Tamper-proof digital gate passes, customer portal view, and GST tax slips.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* MULTI-TENANT ARCHITECTURE & SUB-LOGINS SECTION               */}
      {/* ============================================================ */}
      <section id="multi-tenant" className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] bg-black/40 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
              B2B Multi-Tenancy Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
              Deliver Dedicated Workspaces for Each Client. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                With 10 Department Sub-Logins per Plant.
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              When you sell MixFlow OS to a concrete company (e.g., Roxxcon, Apex, or Sai Concrete), they receive their own isolated company workspace. Their crew logs in via role-segregated sub-logins with strict permission boundaries.
            </p>
          </div>

          {/* Client Workspaces Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {MULTI_TENANT_CLIENTS.map((client, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/[0.08] bg-[#0c1018]/90 p-5 hover:border-emerald-500/40 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    {client.status}
                  </Badge>
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {client.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1">{client.city}</p>

                <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1.5 text-[11px] font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Controller:</span>
                    <span className="text-emerald-400 font-semibold">{client.scada}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Capacity:</span>
                    <span>{client.capacity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fleet:</span>
                    <span>{client.fleet}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sub-Logins Grid */}
          <div className="rounded-2xl border border-white/[0.09] bg-[#0c1018]/80 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  10 Built-In Department Sub-Logins per Organization
                </h3>
                <p className="text-xs text-slate-400">
                  Every plant user gets their own authenticated station with role-based UI restriction:
                </p>
              </div>
              <Link
                to="/login"
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
              >
                <span>Enter Client Login Gateway</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {SUB_LOGIN_ROLES_EXPLAINED.map((sub, idx) => {
                const Icon = sub.icon;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40 text-left hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("flex size-7 items-center justify-center rounded-lg bg-white/[0.04]", sub.color)}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">{sub.role}</span>
                    </div>
                    <span className="text-xs font-bold text-white block">{sub.title}</span>
                    <span className="text-[11px] text-slate-400 block mt-1 leading-snug line-clamp-2">{sub.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION: "LESS COMPLEXITY. MORE POSSIBILITY."                */}
      {/* ============================================================ */}
      <section id="solutions" className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                01 / About MixFlow OS Platform
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
                Less Complexity. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  More Concrete Possibility.
                </span>
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              We bring plant orders, SCADA batching, fleet logistics, laboratory quality assurance, and accounts together into one intelligent SaaS platform. Making ready-mix concrete operations transparent, fast, and auditable across every shift.
            </p>
          </div>

          {/* Interactive Feature Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-white/[0.08] pb-4 mb-8">
            {PLATFORM_SOLUTIONS.map((sol, index) => (
              <button
                key={sol.id}
                type="button"
                onClick={() => setActiveSolutionTab(index)}
                className={cn(
                  "text-left p-3.5 rounded-xl border transition-all cursor-pointer",
                  activeSolutionTab === index
                    ? "border-emerald-500/40 bg-emerald-500/10 text-white shadow-md shadow-emerald-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                )}
              >
                <span className="text-[11px] font-mono block text-emerald-400/90">{sol.label}</span>
                <span className="text-xs font-bold block mt-1 truncate">{sol.tag}</span>
              </button>
            ))}
          </div>

          {/* Active Feature Showcase Card */}
          <div className="rounded-2xl border border-white/[0.09] bg-[#0c1018]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  <Badge variant="outline" className="border-0 p-0 text-emerald-400">{currentSolution.badge}</Badge>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  {currentSolution.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {currentSolution.description}
                </p>

                <ul className="space-y-2.5 pt-2">
                  {currentSolution.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                        <Check className="size-3" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 flex items-center gap-3">
                  <Link
                    to="/login"
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs h-10 px-5 rounded-xl shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Launch {currentSolution.tag}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Live Plant Telemetry Simulator */}
              <div className="lg:col-span-5">
                <div className="relative rounded-xl border border-white/10 bg-black/60 p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-mono font-bold text-slate-200">LIVE PLANT TELEMETRY</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">CRB-75 SYNC</span>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
                    <span className="text-[11px] text-slate-400 block">{currentSolution.metricLabel}</span>
                    <div className="text-3xl font-black text-white mt-1 text-emerald-400 font-mono">
                      {currentSolution.metricValue}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Live benchmark across current production shift</span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-white/[0.05]">
                      <span className="text-slate-400">Active Grade:</span>
                      <span className="text-white font-bold">M25 Design Mix (IS 10262)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/[0.05]">
                      <span className="text-slate-400">Batch Quantity:</span>
                      <span className="text-white font-bold">8.0 cum (Full Payload)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/[0.05]">
                      <span className="text-slate-400">Assigned TM:</span>
                      <span className="text-emerald-400 font-bold">MH40DC4288 (Vikash)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Status:</span>
                      <span className="text-emerald-400 font-bold">Batched & Dispatched</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION: WORKFLOW PIPELINE (FROM ORDER TO POUR)              */}
      {/* ============================================================ */}
      <section id="workflows" className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] bg-black/30 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
              From Order to Pour
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
              Intelligent Workflows, Made Simple.
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Automated handshakes across departments eliminate phone call bottlenecks and manual register errors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((wf) => {
              const Icon = wf.icon;
              return (
                <div
                  key={wf.step}
                  className="rounded-2xl border border-white/[0.08] bg-[#0b0f17]/80 p-6 flex flex-col justify-between hover:border-emerald-500/40 hover:bg-[#0e141f] transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black font-mono text-emerald-400/40 group-hover:text-emerald-400 transition-colors">
                        {wf.step}
                      </span>
                      <div className="flex size-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-300 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 transition-colors">
                        <Icon className="size-4" />
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-emerald-400 font-semibold block mt-4">
                      {wf.phase}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1 group-hover:text-emerald-300 transition-colors">
                      {wf.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {wf.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400 group-hover:text-emerald-400 transition-colors">
                    <span>Automated Handshake</span>
                    <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION: PRICING & ROI                                       */}
      {/* ============================================================ */}
      <section id="pricing" className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
              Pricing & Plant Licensing
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
              Transparent Pricing. Proven Plant ROI.
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Reduce batch cycle time by 35%, eliminate 100% manual register fraud, and stop raw material leakage with guaranteed payback.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {PRICING_PLANS.map((plan, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-2xl border p-6 sm:p-8 flex flex-col justify-between transition-all relative backdrop-blur-xl",
                  plan.highlight
                    ? "border-emerald-500/60 bg-gradient-to-b from-emerald-500/10 via-[#0c121c] to-[#0c121c] shadow-2xl shadow-emerald-500/15"
                    : "border-white/[0.08] bg-[#0c1018]/80 hover:border-white/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">{plan.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        plan.highlight
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/20"
                          : "border-white/10 text-slate-400"
                      )}
                    >
                      {plan.badge}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-xs text-slate-400">/{plan.period}</span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{plan.desc}</p>

                  <ul className="mt-6 space-y-2.5 border-t border-white/[0.08] pt-6">
                    {plan.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <Link
                    to="/login"
                    className={cn(
                      "w-full h-11 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      plan.highlight
                        ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/25"
                        : "bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10"
                    )}
                  >
                    <span>{plan.cta}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FINAL CONVERSION BANNER                                      */}
      {/* ============================================================ */}
      <section className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] bg-gradient-to-b from-black/50 to-emerald-950/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
            Ready to Automate Your Concrete Plant?
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-3">
            Join the Leading Ready-Mix Producers on MixFlow OS.
          </h2>
          <p className="text-sm text-slate-400 mt-4 max-w-xl mx-auto leading-relaxed">
            From single CRB-75 plants to nationwide multi-plant ready-mix operations. Provision your client workspace in under 5 minutes.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs h-12 px-7 rounded-xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Onboard Your Plant Workspace</span>
              <ArrowRight className="size-4" />
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto text-xs font-bold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 h-12 px-6 rounded-xl transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="size-3.5 text-emerald-400" />
              <span>Client Portal Sign In</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* ENTERPRISE FOOTER                                            */}
      {/* ============================================================ */}
      <footer className="border-t border-white/[0.08] bg-[#05070a] px-6 py-10 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold">
              <Boxes className="size-4" />
            </span>
            <div>
              <p className="font-bold text-slate-300">MixFlow OS · Ready-Mix Concrete Cloud Technologies</p>
              <p className="text-[11px] text-slate-500">Multi-Tenant Cloud Operations Platform · IS 4926, IS 456 & IS 10262</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <button type="button" onClick={() => scrollToSection("solutions")} className="hover:text-white transition-colors cursor-pointer">
              Solutions
            </button>
            <button type="button" onClick={() => scrollToSection("architecture")} className="hover:text-white transition-colors cursor-pointer">
              Architecture
            </button>
            <button type="button" onClick={() => scrollToSection("multi-tenant")} className="hover:text-white transition-colors cursor-pointer">
              Multi-Tenancy
            </button>
            <button type="button" onClick={() => scrollToSection("pricing")} className="hover:text-white transition-colors cursor-pointer">
              Pricing
            </button>
            <Link to="/login" className="hover:text-emerald-400 text-slate-300 font-medium transition-colors">
              Client Login
            </Link>
            <Link to="/reports" className="hover:text-emerald-400 text-slate-300 font-medium transition-colors">
              13 Reports Directory
            </Link>
          </div>

          <p className="text-[11px] text-slate-500">
            © 2026 MixFlow OS Technologies. All rights reserved.
          </p>
        </div>
      </footer>

      {/* AI Plant Copilot */}
      <RmcChatbot />
    </div>
  );
}
