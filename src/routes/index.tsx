import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Boxes,
  Loader2,
  ShieldCheck,
  Truck,
  Warehouse,
  FlaskConical,
  Package,
  FileSpreadsheet,
  Users,
  Building2,
  Gauge,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  ChevronLeft,
  ChevronRight,
  Crown,
  CheckCircle2
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
      { title: "Sai ReadyMix Concrete · Command Center & Operations" },
      {
        name: "description",
        content: "Enterprise control dashboard for Sai Ready-Mix Concrete Plant (Mulkhed). Order-to-delivery, batching telemetry, weighbridge, and department reports.",
      },
    ],
  }),
  component: LoginPage,
});

// Original Department Roles Cards (Styled with pastel accent boxes & clear tags)
const DEPARTMENT_ROLES = [
  {
    id: "owner",
    title: "Owner",
    sub: "Executive Overview",
    tag: "P&L & All Reports",
    role: "owner",
    icon: Crown,
    bgClass: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    iconColor: "text-amber-400",
    email: "owner@rmc.test",
  },
  {
    id: "sales",
    title: "Sales Desk",
    sub: "POs & Approvals",
    tag: "Commercials",
    role: "sales_manager",
    icon: Gauge,
    bgClass: "bg-teal-500/10 text-teal-300 border-teal-500/30",
    iconColor: "text-teal-400",
    email: "salesmanager@rmc.test",
  },
  {
    id: "dispatch",
    title: "Dispatch",
    sub: "Fleet & Zone 02",
    tag: "Transit Logistics",
    role: "dispatcher",
    icon: Truck,
    bgClass: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    iconColor: "text-sky-400",
    email: "dispatcher@rmc.test",
  },
  {
    id: "production",
    title: "Production",
    sub: "CRB-75 Batching",
    tag: "M15–M40 Mixes",
    role: "production",
    icon: Package,
    bgClass: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    iconColor: "text-orange-400",
    email: "production@rmc.test",
  },
  {
    id: "qa",
    title: "QA / QC Lab",
    sub: "Strength & Cubes",
    tag: "IS 456 Tests",
    role: "qa",
    icon: FlaskConical,
    bgClass: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    iconColor: "text-purple-400",
    email: "qa@rmc.test",
  },
  {
    id: "store",
    title: "Store & Yard",
    sub: "Weighbridge & MPR",
    tag: "Raw Materials",
    role: "store",
    icon: Warehouse,
    bgClass: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
    iconColor: "text-yellow-400",
    email: "store@rmc.test",
  },
  {
    id: "account",
    title: "HR & Accounts",
    sub: "Staff Attendance",
    tag: "Driver Payroll",
    role: "account",
    icon: Users,
    bgClass: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    iconColor: "text-rose-400",
    email: "account@rmc.test",
  },
  {
    id: "customer",
    title: "Customer Portal",
    sub: "Live GPS & Invoices",
    tag: "e-Challan",
    role: "customer",
    icon: Building2,
    bgClass: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    iconColor: "text-indigo-400",
    email: "customer1@rmc.test",
  },
];

const DEFAULT_ROLE = DEPARTMENT_ROLES[0]!;

function LoginPage() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"hero" | "portals">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "portals") return "portals";
    }
    return "hero";
  });
  const [selectedRole, setSelectedRole] = useState(DEFAULT_ROLE);
  const [email, setEmail] = useState(DEFAULT_ROLE.email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) void navigate({ to: homeForRole(user.role) });
  }, [ready, user, navigate]);

  const openPortals = () => {
    setViewMode("portals");
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/?view=portals");
    }
  };

  const openHero = () => {
    setViewMode("hero");
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/");
    }
  };

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

  function handleSelectRole(item: (typeof DEPARTMENT_ROLES)[0]) {
    setSelectedRole(item);
    setEmail(item.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  // CINEMATIC STARTING HERO HOME PAGE (Full-Screen, Atmospheric Dark Studio with Single Explore Button)
  if (viewMode === "hero") {
    return (
      <div className="relative min-h-screen w-full bg-[#05070D] text-slate-100 flex flex-col justify-between overflow-hidden select-none">
        {/* Background Hero Image */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-[1.02]"
          style={{ backgroundImage: "url('/hero-dark-truck.jpg')" }}
        />

        {/* Cinematic Vignette & Deep Dark Gradients matching the reference photo */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#05070D] via-[#05070D]/40 to-black/85" />
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#05070D]/80 via-transparent to-[#05070D]/80" />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#05070D_95%)]" />

        {/* Top Navbar */}
        <header className="relative z-10 flex h-20 items-center justify-between px-5 sm:px-12 backdrop-blur-[2px]">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={openPortals}>
            <Sparkles className="size-5 text-cyan-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-white/95">
              SAI READYMIX
            </span>
          </div>

          {/* Minimalist Center Navigation */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-light tracking-wider text-slate-300/80">
            <button onClick={openPortals} className="hover:text-white transition-colors cursor-pointer">
              Operations
            </button>
            <button onClick={openPortals} className="hover:text-white transition-colors cursor-pointer">
              Fleet Telemetry
            </button>
            <button onClick={openPortals} className="hover:text-white transition-colors cursor-pointer">
              CRB-75 Batching
            </button>
            <button onClick={openPortals} className="hover:text-white transition-colors cursor-pointer">
              IS 456 Quality
            </button>
            <Link to="/reports" className="hover:text-white transition-colors">
              Department Reports
            </Link>
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-3">
            <ThemeSwitcher className="scale-85 bg-black/50 border-white/10" />
            <button
              onClick={openPortals}
              className="rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-4 py-1.5 text-[11px] font-medium tracking-widest uppercase text-white hover:bg-white/25 hover:border-white/40 transition-all duration-200 cursor-pointer"
            >
              PORTAL
            </button>
          </div>
        </header>

        {/* Center Hero Copy & Single Explore Button */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto my-auto py-10 sm:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/40 backdrop-blur-md px-4 py-1 text-[11px] font-medium tracking-wide text-cyan-300 mb-6 shadow-[0_0_20px_rgba(6,182,212,0.15)] animate-fade-in">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>MULKHED UNIT 01 · AUTOMATION CONSOLE</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-light tracking-tight text-white max-w-3xl leading-[1.18] drop-shadow-lg">
            A technology company that powers next-generation concrete infrastructure
          </h1>

          <p className="mt-4 sm:mt-6 text-xs sm:text-sm md:text-base font-light text-slate-300/80 max-w-xl leading-relaxed">
            Automated batching systems, real-time GPS fleet dispatch, compressive cube laboratory, and unified departmental intelligence.
          </p>

          {/* THE SINGLE EXPLORE BUTTON */}
          <div className="mt-8 sm:mt-12">
            <button
              onClick={openPortals}
              className="group relative inline-flex items-center gap-3 rounded-full border border-cyan-400/50 bg-gradient-to-r from-cyan-500/20 via-blue-500/25 to-indigo-500/20 hover:from-cyan-500/35 hover:via-blue-500/35 hover:to-indigo-500/35 px-9 py-4 text-sm sm:text-base font-medium tracking-wider uppercase text-white backdrop-blur-xl shadow-[0_0_40px_rgba(6,182,212,0.3)] hover:shadow-[0_0_60px_rgba(6,182,212,0.55)] hover:border-cyan-400/80 transition-all duration-300 cursor-pointer active:scale-95"
            >
              <span>Explore</span>
              <ArrowRight className="size-4 text-cyan-300 group-hover:translate-x-1.5 transition-transform" />
            </button>
          </div>

          {/* Subtitle Telemetry Points */}
          <div className="mt-12 sm:mt-16 flex items-center gap-5 sm:gap-8 text-[11px] font-light text-slate-400/70">
            <span>15 Active TMs</span>
            <span className="size-1 rounded-full bg-slate-500" />
            <span>M15–M40 Mixes</span>
            <span className="size-1 rounded-full bg-slate-500" />
            <span>IS 456 Certified</span>
          </div>
        </main>

        {/* Minimalist Footer */}
        <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-12 py-5 text-[11px] font-light text-white/40 border-t border-white/5 backdrop-blur-sm gap-2">
          <span>© 2026 Sai ReadyMix Concrete Ltd · Mulkhed Plant</span>
          <button onClick={openPortals} className="text-cyan-400/80 hover:text-cyan-300 transition-colors cursor-pointer">
            Access Department Logins (Owner, Dispatch, QA, Store) →
          </button>
        </footer>

        {/* AI Plant Copilot */}
        <RmcChatbot />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-primary selection:text-white">
      {/* Rich Industrial Background Layers */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* Subtle Blueprint Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Ambient Radial Gradient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-primary/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-[600px] h-[350px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />
      </div>

      {/* Top Header - Mobile Optimized with Home button */}
      <header className="relative z-10 sticky top-0 flex h-16 items-center justify-between border-b border-white/10 bg-[#090D16]/90 px-3.5 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={openHero}
            title="Back to home"
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors mr-1 cursor-pointer"
          >
            <ChevronLeft className="size-4 text-cyan-400" />
            <span className="hidden xs:inline">Home</span>
          </button>
          <span className="brand-gradient flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-lg shadow-primary/25">
            <Boxes className="size-4.5 sm:size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-white truncate max-w-[145px] xs:max-w-none">
                Sai ReadyMix Concrete
              </span>
              <Badge variant="outline" className="hidden xs:inline-flex text-[9px] sm:text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shrink-0">
                Unit 01
              </Badge>
            </div>
            <p className="hidden md:block text-[11px] text-slate-400 truncate">IS 456 & IS 10262 Certified Operations Console</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeSwitcher className="scale-90 sm:scale-100" />
          <div className="hidden lg:flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>Plant Live Telemetry Active</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 px-3.5 py-6 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Department Portals Bar */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Select Department Portal</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Tap card to enter directly
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Click any department to sign in and open its operational workspace immediately.
              </p>
            </div>

            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all self-start sm:self-auto"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-400" />
              <span>Plant Reports Directory (13 Reports)</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Cards Grid: Clean, Pastel Boxes, Direct 1-Tap Entry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
            {DEPARTMENT_ROLES.map((card) => {
              const Icon = card.icon;
              const isSelected = selectedRole.id === card.id;
              const isLoggingIn = busyCardId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => void handleCardClick(card)}
                  disabled={busy}
                  className={cn(
                    "group relative flex flex-col items-center justify-between rounded-xl border p-3 sm:p-3.5 text-center transition-all duration-200 cursor-pointer active:scale-95 min-h-[142px] sm:min-h-[135px]",
                    card.bgClass,
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-[#090D16] scale-[1.02] shadow-lg shadow-primary/20 bg-slate-800/90"
                      : "hover:scale-[1.02] hover:bg-slate-800/60 opacity-90 hover:opacity-100 border-white/10"
                  )}
                >
                  <div className="flex flex-col items-center w-full">
                    <div className="relative flex size-11 sm:size-10 items-center justify-center rounded-xl bg-white/10 shadow-sm transition-transform group-hover:scale-110">
                      <Icon className={cn("size-5", card.iconColor)} />
                      {isSelected && !isLoggingIn && (
                        <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-black">
                          <CheckCircle2 className="size-3 text-primary-foreground fill-primary" />
                        </span>
                      )}
                    </div>
                    <span className="mt-2 text-xs font-bold tracking-tight text-white line-clamp-1">
                      {card.title}
                    </span>
                    <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {card.sub}
                    </span>
                  </div>

                  <div className="mt-2.5 w-full flex items-center justify-center">
                    {isLoggingIn ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-primary animate-pulse py-0.5">
                        <Loader2 className="size-3 animate-spin" /> Entering...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 group-hover:text-primary transition-colors py-0.5 px-2 rounded-full bg-black/40 border border-white/5">
                        <span>Enter</span>
                        <ArrowRight className="size-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Central Operations Workspace & Login Panel */}
        <div className="grid gap-6 lg:grid-cols-12 items-stretch">
          {/* LEFT: Plant Telemetry Overview & Direct Role Quick Launch */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                <span>Mulkhed Plant Automation</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  High Performance Concrete Operations{" "}
                  <span className="bg-gradient-to-r from-primary via-amber-300 to-emerald-400 bg-clip-text text-transparent">
                    Under Total Control.
                  </span>
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Unified enterprise operating system for Sai Ready-Mix Concrete Plant (Mulkhed). Connects live weighbridge scales,
                  transit mixer fleet telemetry, batching computers, compressive cube breaks, and official department records.
                </p>
              </div>

              {/* Plant Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {[
                  { label: "Active Fleet", value: "15 TMs", sub: "GPS Telemetry" },
                  { label: "Design Grades", value: "M15–M40", sub: "Automated Mix" },
                  { label: "OPC 53 Cement", value: "85 MT", sub: "Silo Storage" },
                  { label: "Official Reports", value: "Departmental", sub: "Excel & CSV" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-slate-800/40 p-3 transition-colors hover:border-primary/40">
                    <p className="text-base font-bold text-white">{s.value}</p>
                    <p className="text-xs font-semibold text-slate-300">{s.label}</p>
                    <p className="text-[10px] text-primary">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick 1-Click Launch Button for the Selected Department */}
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <selectedRole.icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">
                    Selected Role: {selectedRole.title}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Account: <span className="font-mono text-slate-300">{selectedRole.email}</span> · {selectedRole.tag}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                className="shrink-0 font-semibold text-xs h-9"
                onClick={() => void submit(undefined, selectedRole.email, DEMO_PASSWORD)}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="mr-1.5 size-3.5" />
                )}
                Launch {selectedRole.title} Console
              </Button>
            </div>
          </div>

          {/* RIGHT: Modern Sleek Sign In Card */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-white">Plant Access Portal</h2>
                  <p className="text-xs text-slate-400">Sign in to your authorized department workspace</p>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono border-primary/30 text-primary bg-primary/10">
                  {DEMO_PASSWORD}
                </Badge>
              </div>

              {/* Login Form */}
              <form onSubmit={(e) => submit(e)} className="mt-5 space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@rmc.test"
                      className="pl-8 text-xs bg-slate-800/60 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-8 text-xs bg-slate-800/60 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                    Remember credentials
                  </label>
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => toast.info("Password managed by plant administrator (Devendra Kulkarni)")}
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full text-xs font-semibold h-10 mt-2" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 size-3.5" />}
                  Sign In as {selectedRole.title}
                </Button>
              </form>
            </div>

            <div className="mt-6 border-t border-white/10 pt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Single Sign-On Enabled</span>
              </span>
              <span className="font-mono text-slate-400">v2.4.0 (Enterprise)</span>
            </div>
          </div>
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#090D16]/90 px-6 py-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 Sai ReadyMix Concrete Ltd · Mulkhed Plant Command Center</p>
        <div className="flex items-center gap-4">
          <Link to="/reports" className="hover:text-white transition-colors">Plant Reports</Link>
          <span className="text-white/20">|</span>
          <span className="text-emerald-400">IS 456:2000 & IS 10262:2019 Certified</span>
        </div>
      </footer>

      {/* AI Plant Copilot */}
      <RmcChatbot />
    </div>
  );
}
