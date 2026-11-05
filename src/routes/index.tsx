import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Boxes,
  Loader2,
  Truck,
  Warehouse,
  FlaskConical,
  Package,
  FileSpreadsheet,
  Users,
  Building2,
  Gauge,
  ArrowRight,
  Lock,
  Mail,
  Crown,
  CheckCircle2,
  HardHat,
  FileText,
  ShieldCheck,
  Radio,
  Cpu,
  Workflow,
  Sparkles,
  Layers,
  BarChart3,
  Scale,
  Zap,
  ChevronRight,
  Flame,
  ArrowUpRight,
  Shield,
  Clock,
  Check,
  Activity,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, homeForRole } from "@/api/auth";
import { useAuth } from "@/auth/auth-context";
import { isApiError } from "@/api/client";
import { ThemeSwitcher } from "@/components/app/ThemeSwitcher";
import { RmcChatbot } from "@/components/chatbot/RmcChatbot";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ROXXCON RMC NAGPUR · One Platform. Endless Concrete Automation." },
      {
        name: "description",
        content:
          "Enterprise Ready-Mix Concrete Operations Platform. Connecting SCADA batching systems, weighbridge, fleet dispatch logistics, laboratory QA, and GST billing into one unified command center.",
      },
    ],
  }),
  component: LandingAndLoginPage,
});

const DEPARTMENT_ROLES = [
  {
    id: "owner",
    title: "Owner / Director",
    sub: "Executive Overview",
    tag: "P&L & Audits",
    role: "owner",
    icon: Crown,
    bgClass: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    iconColor: "text-amber-400",
    email: "owner@rmc.test",
  },
  {
    id: "sales",
    title: "Sales Desk",
    sub: "New POs & Sites",
    tag: "Orders",
    role: "sales",
    icon: FileText,
    bgClass: "bg-teal-500/10 text-teal-300 border-teal-500/30",
    iconColor: "text-teal-400",
    email: "sales@rmc.test",
  },
  {
    id: "sales_manager",
    title: "Sales Manager",
    sub: "Commercial Approvals",
    tag: "Price Exceptions",
    role: "sales_manager",
    icon: Gauge,
    bgClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    iconColor: "text-cyan-400",
    email: "salesmanager@rmc.test",
  },
  {
    id: "dispatch",
    title: "Dispatch Master",
    sub: "Fleet & TM Scheduling",
    tag: "Gate Logistics",
    role: "dispatcher",
    icon: Truck,
    bgClass: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    iconColor: "text-sky-400",
    email: "dispatcher@rmc.test",
  },
  {
    id: "supervisor",
    title: "Site Supervisor",
    sub: "Pouring & Pump Ops",
    tag: "Pour Tracking",
    role: "supervisor",
    icon: HardHat,
    bgClass: "bg-lime-500/10 text-lime-300 border-lime-500/30",
    iconColor: "text-lime-400",
    email: "supervisor@rmc.test",
  },
  {
    id: "production",
    title: "Production Engineer",
    sub: "CRB-75 Batching",
    tag: "SCADA Ingestion",
    role: "production",
    icon: Package,
    bgClass: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    iconColor: "text-orange-400",
    email: "production@rmc.test",
  },
  {
    id: "qa",
    title: "QA / QC Lab In-Charge",
    sub: "Slumps & Cubes",
    tag: "IS 456 Tests",
    role: "qa",
    icon: FlaskConical,
    bgClass: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    iconColor: "text-purple-400",
    email: "qa@rmc.test",
  },
  {
    id: "store",
    title: "Store & Weighbridge",
    sub: "Weighbridge & Silos",
    tag: "Raw Materials",
    role: "store",
    icon: Warehouse,
    bgClass: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
    iconColor: "text-yellow-400",
    email: "store@rmc.test",
  },
  {
    id: "account",
    title: "Accounts & Payroll",
    sub: "Billing & Invoices",
    tag: "GST Invoices",
    role: "account",
    icon: Users,
    bgClass: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    iconColor: "text-rose-400",
    email: "account@rmc.test",
  },
  {
    id: "customer",
    title: "Customer Portal",
    sub: "Live Orders & Challans",
    tag: "Client Access",
    role: "customer",
    icon: Building2,
    bgClass: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    iconColor: "text-indigo-400",
    email: "customer1@rmc.test",
  },
];

const DEFAULT_ROLE = DEPARTMENT_ROLES[0]!;

const PLATFORM_SOLUTIONS = [
  {
    id: "batching",
    label: "01 / SCADA Batching",
    tag: "Telemetry & Ingestion",
    title: "Sub-Second SCADA Telemetry & Variance Tracking",
    description:
      "Ingests live batch reports directly from plant controllers (CRB-75, Schwing Stetter, Liebherr, Simem). Automatically calculates moisture compensation, verifies theoretical versus actual design mix, and deducts live inventory from vertical cement and aggregate silos.",
    highlights: [
      "Automated optical and CSV batch report extraction",
      "Per-batch aggregate & cement percentage variance",
      "Instant deduction from live storage silos and tanks",
      "Immediate QC flag trigger for out-of-tolerance batches",
    ],
    badge: "SCADA Core",
    metricValue: "±0.4%",
    metricLabel: "Aggregate Tolerance",
  },
  {
    id: "dispatch",
    label: "02 / Smart Fleet & Dispatch",
    tag: "Transit Mixer Logistics",
    title: "Dynamic Fleet Scheduling & Emergency Breakdown Handling",
    description:
      "Precision transit mixer queue allocation based on site pour rates, real-time driver availability, and transit travel windows. Provides 1-click emergency TM vehicle swaps with full audit trails to safeguard concrete slump retention on road.",
    highlights: [
      "Automated transit mixer payload & axle weight validation",
      "Live turnaround tracking: Gate Out, On-Site, Pouring, Return",
      "Emergency breakdown swap & trip rescheduling with audit log",
      "SMS & WhatsApp customer delivery notifications with live link",
    ],
    badge: "Fleet Intelligence",
    metricValue: "42 min",
    metricLabel: "Avg Turnaround Time",
  },
  {
    id: "qa",
    label: "03 / QA Lab Compliance",
    tag: "IS 456 & IS 10262",
    title: "Comprehensive Slump & Cube Strength Certification",
    description:
      "Eliminates manual laboratory registers. Enforces IS 456 slump inspection at batching gate, schedules automated 7-day and 28-day cube compression strength testing dates, and generates tamper-proof digital quality certificates for client submission.",
    highlights: [
      "Slump retention monitoring against transit elapsed time",
      "Automated 7-day and 28-day cube test schedule calendar",
      "Statistical strength distribution (IS 10262 characteristic target)",
      "Digital lab certificate export with direct client portal download",
    ],
    badge: "IS 456 Quality",
    metricValue: "99.8%",
    metricLabel: "Test Compliance",
  },
  {
    id: "store",
    label: "04 / Store & Silos",
    tag: "Weighbridge Automation",
    title: "Weighbridge Inward Automation & Dynamic Materials",
    description:
      "Full inventory accountability from aggregate delivery to mixer discharge. Records gross and tare truck weights automatically, handles dynamic novel materials, and tracks silo levels across OPC 53, Fly Ash, GGBS, M-Sand, 10mm/20mm, and admixtures.",
    highlights: [
      "Automated gross & tare weighbridge capture with tolerance bounds",
      "Dynamic material catalog support with custom reorder levels",
      "Automated reconciliation of inward vendor consignments",
      "Negative stock protection and real-time inventory alerts",
    ],
    badge: "Zero Stock Leakage",
    metricValue: "100%",
    metricLabel: "Inward Reconciliation",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    phase: "Order Intake & Approval",
    title: "PO Booking & Capacity Reservation",
    description:
      "Sales desk inputs contractor PO, pour site coordinates, and mix grade (M10-M80). Automated commercial checks verify customer credit limits and plant hourly capacity before dispatch approval.",
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

function LandingAndLoginPage() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();

  const [activeSolutionTab, setActiveSolutionTab] = useState(0);
  const [selectedRole, setSelectedRole] = useState(DEFAULT_ROLE);
  const [email, setEmail] = useState(DEFAULT_ROLE.email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto redirect if already signed in
  useEffect(() => {
    if (ready && user) void navigate({ to: homeForRole(user.role) });
  }, [ready, user, navigate]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function submit(e?: React.FormEvent, targetEmail?: string, targetPassword?: string) {
    if (e) e.preventDefault();
    setBusy(true);
    setError(null);
    const useEmail = targetEmail || email;
    const usePassword = targetPassword || password;

    try {
      const signedIn = await login(useEmail, usePassword);
      toast.success(`Welcome back, ${signedIn.name}`);
      void navigate({
        to: DEMO_ACCOUNTS.find((a) => a.email === signedIn.email)?.home ?? homeForRole(signedIn.role),
      });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Unable to sign in right now.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCardClick(card: (typeof DEPARTMENT_ROLES)[0]) {
    setSelectedRole(card);
    setEmail(card.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setBusyCardId(card.id);
    await submit(undefined, card.email, DEMO_PASSWORD);
    setBusyCardId(null);
  }

  const currentSolution = PLATFORM_SOLUTIONS[activeSolutionTab]!;

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] selection:bg-emerald-500 selection:text-black font-sans antialiased relative overflow-x-hidden">
      {/* Background Tech Grid & Radial Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
        {/* Top center emerald spotlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />
        {/* Bottom subtle ambient cyan glow */}
        <div className="absolute bottom-1/4 right-10 w-[600px] h-[400px] bg-cyan-500/5 blur-[160px] rounded-full pointer-events-none" />
      </div>

      {/* ============================================================ */}
      {/* TOP NAVIGATION BAR                                           */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#07090e]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-black font-black shadow-lg shadow-emerald-500/20">
              <Boxes className="size-5" />
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                ROXXCON <span className="text-emerald-400">RMC</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Plant Online · Nagpur
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={() => scrollToSection("solutions")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Solutions
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("architecture")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("workflows")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Workflow
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("workstations")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Workstations
            </button>
            <Link
              to="/reports"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <FileSpreadsheet className="size-3 text-emerald-400" />
              <span>13 Plant Reports</span>
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <button
              type="button"
              onClick={() => scrollToSection("login-section")}
              className="hidden xs:inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              Sign In
            </button>
            <Button
              onClick={() => scrollToSection("login-section")}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>Explore Now</span>
              <ArrowRight className="size-3.5 ml-1 text-black" />
            </Button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* HERO SECTION                                                 */}
      {/* ============================================================ */}
      <section className="relative z-10 pt-16 sm:pt-24 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium mb-6 shadow-sm shadow-emerald-500/20 animate-fade-in">
          <Sparkles className="size-3.5 text-emerald-400" />
          <span>Next-Generation Ready-Mix Automation & SCADA Intelligence</span>
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
          Simplify complex ready-mix plant workflows. Connect your SCADA batching systems, weighbridge gross/tare automation, transit mixer fleet logistics, and laboratory QA in one intelligent real-time operating suite.
        </p>

        {/* Hero CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={() => scrollToSection("login-section")}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm h-12 px-7 rounded-xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Explore Platform</span>
            <ArrowRight className="size-4" />
          </Button>

          <button
            type="button"
            onClick={() => scrollToSection("architecture")}
            className="w-full sm:w-auto text-sm font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 h-12 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Workflow className="size-4 text-emerald-400" />
            <span>View Architecture</span>
          </button>
        </div>

        {/* Plant Live Metrics Ticker */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Operational Entities</span>
            <div className="text-2xl font-black text-white mt-1">35 Tables</div>
            <span className="text-[11px] text-emerald-400 font-medium">Relational Schema</span>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reports Directory</span>
            <div className="text-2xl font-black text-white mt-1">13 Reports</div>
            <span className="text-[11px] text-emerald-400 font-medium">Day · 7D · Month · Year</span>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SCADA Telemetry</span>
            <div className="text-2xl font-black text-white mt-1">Sub-Second</div>
            <span className="text-[11px] text-emerald-400 font-medium">Auto Inward Deduction</span>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Concrete Standards</span>
            <div className="text-2xl font-black text-white mt-1">IS 456 / 10262</div>
            <span className="text-[11px] text-emerald-400 font-medium">Slump & Cube Testing</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* NODE ARCHITECTURE DIAGRAM (ORVYN INSPIRATION)                */}
        {/* ============================================================ */}
        <div id="architecture" className="mt-20 scroll-mt-24">
          <div className="relative rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.03] to-transparent p-6 sm:p-10 shadow-2xl backdrop-blur-md overflow-hidden">
            {/* Ambient background glow inside card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-500/10 blur-[100px] pointer-events-none rounded-full" />

            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                System Topology
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Connected Plant Intelligence Architecture
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                Every physical touchpoint at ROXXCON RMC streams into the core orchestration engine without friction.
              </p>
            </div>

            {/* Architecture Node Diagram Layout */}
            <div className="relative grid grid-cols-1 lg:grid-cols-7 gap-6 items-center">
              {/* Left Column: 3 Input Source Nodes */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">01 / INPUT SOURCE</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">Active</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-emerald-300 transition-colors">
                    Sales Order & Capacity
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    PO validation, commercial credit terms, and pour site coordinates.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-400 font-semibold">02 / SCADA INTEGRATION</span>
                    <Badge variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-400 bg-cyan-500/10">Real-Time</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-cyan-300 transition-colors">
                    CRB-75 Batch Telemetry
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Optical / CSV batch sheet parsing, moisture trim, & theoretical variance.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0d121c]/90 p-4 text-left shadow-lg hover:border-emerald-500/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-400 font-semibold">03 / WEIGHBRIDGE & YARD</span>
                    <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/10">Synchronized</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-amber-300 transition-colors">
                    Gross / Tare Silo Inward
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Raw aggregate, cement, and admixture live balances & reconciliation.
                  </p>
                </div>
              </div>

              {/* Center Column: Core Engine Hub (Hexagon / Glowing Node) */}
              <div className="lg:col-span-3 flex flex-col items-center justify-center py-4 sm:py-6">
                <div className="relative group">
                  {/* Glowing halo */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-75 transition duration-500" />
                  
                  <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-500/50 bg-[#0c1017] p-6 sm:p-8 text-center shadow-2xl">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 mb-3 shadow-inner">
                      <Cpu className="size-7 animate-pulse text-emerald-400" />
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-bold">
                      ROXXCON CORE ENGINE
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-white mt-1">
                      Central Plant Bus
                    </h3>
                    <p className="text-xs text-slate-300 mt-2 max-w-xs leading-relaxed">
                      Sub-second operational state sync, event dispatching, vehicle swap handling, and unified audit trails.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                      <Activity className="size-3 text-emerald-400 animate-spin" />
                      10 Connected Operational Roles
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: 3 Output Destination Nodes */}
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
                    <span className="text-[10px] font-mono text-rose-400 font-semibold">06 / ERP & BILLING</span>
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
      {/* SECTION: "LESS COMPLEXITY. MORE POSSIBILITY."                */}
      {/* ============================================================ */}
      <section id="solutions" className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] bg-black/30 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                01 / About ROXXCON RMC Platform
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
                Less Complexity. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  More Concrete Possibility.
                </span>
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              We bring orders, SCADA batching, fleet logistics, laboratory quality assurance, and accounts together into one intelligent platform. Making ready-mix concrete operations transparent, fast, and auditable across every shift.
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
              {/* Left Column: Solution Details */}
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

                {/* Bullet Points */}
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

                <div className="pt-4">
                  <Button
                    onClick={() => scrollToSection("login-section")}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs h-10 px-5 rounded-xl shadow-md cursor-pointer"
                  >
                    <span>Launch {currentSolution.tag}</span>
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>

              {/* Right Column: Visual Telemetry Card */}
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

                  {/* Concrete mix details mockup */}
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
      <section id="workflows" className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] scroll-mt-20">
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
      {/* SECTION: 10 DEPARTMENT WORKSTATIONS & DIRECT ACCESS          */}
      {/* ============================================================ */}
      <section id="workstations" className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] bg-black/40 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                Direct Department Access
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mt-1">
                Operational Workstations
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Tap any station card below for immediate 1-tap workspace entry, or sign in below with custom credentials.
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs px-3 py-1 self-start sm:self-auto font-mono">
              10 Department Roles Active
            </Badge>
          </div>

          {/* Department Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {DEPARTMENT_ROLES.map((card) => {
              const Icon = card.icon;
              const isSelected = selectedRole.id === card.id;
              const isLoggingIn = busyCardId === card.id;

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    handleCardClick(card);
                    scrollToSection("login-section");
                  }}
                  disabled={busy}
                  className={cn(
                    "group relative flex flex-col items-center justify-between rounded-xl border p-4 text-center transition-all duration-200 cursor-pointer min-h-[145px] text-left",
                    isSelected
                      ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/15"
                      : "border-white/[0.08] bg-[#0c1018]/80 hover:border-emerald-500/40 hover:bg-[#111724]"
                  )}
                >
                  <div className="flex flex-col items-center w-full">
                    <div className={cn("flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105", card.bgClass)}>
                      <Icon className={cn("size-5", card.iconColor)} />
                      {isSelected && !isLoggingIn && (
                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-black">
                          <CheckCircle2 className="size-3" />
                        </span>
                      )}
                    </div>
                    <span className="mt-2.5 text-xs font-bold tracking-tight text-white line-clamp-1">
                      {card.title}
                    </span>
                    <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {card.sub}
                    </span>
                  </div>

                  <div className="mt-3 w-full flex items-center justify-center">
                    {isLoggingIn ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 animate-pulse">
                        <Loader2 className="size-3 animate-spin" /> Launching...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-emerald-400 transition-colors py-0.5 px-2 rounded-md bg-white/[0.04]">
                        <span>Launch</span>
                        <ArrowRight className="size-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION: LOGIN & CREDENTIALS AUTHENTICATION                  */}
      {/* ============================================================ */}
      <section id="login-section" className="relative z-10 py-16 sm:py-24 border-t border-white/[0.08] scroll-mt-20">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
              Authentication Terminal
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
              Sign In to Your Operational Station
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select any role card above or enter credentials below.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.1] bg-[#0c1018]/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Active Station Banner */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <selectedRole.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    Target Station
                  </span>
                  <h3 className="text-sm font-bold text-white truncate">
                    {selectedRole.title} Workspace
                  </h3>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {selectedRole.email}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                className="shrink-0 font-bold text-xs h-9 bg-emerald-500 hover:bg-emerald-400 text-black shadow-md cursor-pointer"
                onClick={() => void submit(undefined, selectedRole.email, DEMO_PASSWORD)}
                disabled={busy}
              >
                {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 size-3.5" />}
                1-Tap Launch
              </Button>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Corporate Credentials</h3>
                <p className="text-xs text-slate-400">Role-based encrypted plant authentication</p>
              </div>
              <Badge variant="outline" className="text-xs font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                Default: {DEMO_PASSWORD}
              </Badge>
            </div>

            {/* Form */}
            <form onSubmit={(e) => submit(e)} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@rmc.test"
                    className="pl-9 text-xs bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 text-xs font-mono bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                  <span>Remember session</span>
                </label>
                <button
                  type="button"
                  className="text-xs text-emerald-400 hover:underline"
                  onClick={() => toast.info("Password managed by plant administrator (Devendra Kulkarni)")}
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full text-xs font-extrabold h-11 mt-2 bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 cursor-pointer"
                disabled={busy}
              >
                {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 size-3.5" />}
                Sign In as {selectedRole.title}
              </Button>
            </form>

            <div className="mt-6 border-t border-white/[0.08] pt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span>Role-Based Operational Access</span>
              </span>
              <span className="font-mono text-slate-500">ROXXCON RMC v2.4.0</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* ENTERPRISE FOOTER                                            */}
      {/* ============================================================ */}
      <footer className="border-t border-white/[0.08] bg-[#05070a] px-6 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold">
              <Boxes className="size-4" />
            </span>
            <div>
              <p className="font-bold text-slate-300">ROXXCON RMC NAGPUR</p>
              <p className="text-[11px] text-slate-500">Ready-Mix Concrete Operations Platform · IS 4926, IS 456 & IS 10262</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <button type="button" onClick={() => scrollToSection("solutions")} className="hover:text-white transition-colors cursor-pointer">
              Solutions
            </button>
            <button type="button" onClick={() => scrollToSection("architecture")} className="hover:text-white transition-colors cursor-pointer">
              Architecture
            </button>
            <button type="button" onClick={() => scrollToSection("workflows")} className="hover:text-white transition-colors cursor-pointer">
              Workflow
            </button>
            <button type="button" onClick={() => scrollToSection("login-section")} className="hover:text-white transition-colors cursor-pointer">
              Terminal Login
            </button>
            <Link to="/reports" className="hover:text-emerald-400 text-slate-300 font-medium transition-colors">
              13 Reports Directory
            </Link>
          </div>

          <p className="text-[11px] text-slate-500">
            © 2026 ROXXCON RMC. All rights reserved.
          </p>
        </div>
      </footer>

      {/* AI Plant Copilot */}
      <RmcChatbot />
    </div>
  );
}
