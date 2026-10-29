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
  CheckCircle2,
  HardHat,
  FileText
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
import Galaxy from "@/components/Galaxy";
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
    sub: "New POs & Quotes",
    tag: "Executive",
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
    tag: "Manager",
    role: "sales_manager",
    icon: Gauge,
    bgClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    iconColor: "text-cyan-400",
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
    id: "supervisor",
    title: "Site Supervisor",
    sub: "Site Concreting & Pump",
    tag: "TM Arrival & Pour",
    role: "supervisor",
    icon: HardHat,
    bgClass: "bg-lime-500/10 text-lime-300 border-lime-500/30",
    iconColor: "text-lime-400",
    email: "supervisor@rmc.test",
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

  // CINEMATIC STARTING HERO HOME PAGE (Full-Screen, Atmospheric Dark Studio with Single Explore Button - No Navbar)
  if (viewMode === "hero") {
    return (
      <div className="relative min-h-screen w-full bg-[#05070D] text-slate-100 flex flex-col justify-between overflow-hidden select-none">
        {/* Background Hero Image with Slow Cinematic Zoom */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-[1.03] animate-float-slow opacity-90"
          style={{ backgroundImage: "url('/hero-dark-truck.jpg')" }}
        />

        {/* Ambient Floating Glow Orbs for High-Tech Atmosphere */}
        <div className="pointer-events-none absolute top-1/4 left-1/5 size-96 rounded-full bg-cyan-500/15 blur-[120px] animate-float-slow" />
        <div className="pointer-events-none absolute bottom-1/3 right-1/4 size-[420px] rounded-full bg-indigo-600/15 blur-[140px] animate-float-slow [animation-delay:3s]" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-blue-500/10 blur-[160px]" />

        {/* Cinematic Vignette & Deep Dark Gradients */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#05070D] via-[#05070D]/50 to-black/85" />
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#05070D]/85 via-transparent to-[#05070D]/85" />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,#05070D_92%)]" />

        {/* Minimalist Floating Top Controls (Navbar removed as requested) */}
        <div className="relative z-20 flex items-center justify-between px-6 sm:px-12 pt-6 sm:pt-8">
          <div
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md cursor-pointer hover:border-cyan-400/40 transition-all duration-300 shadow-lg shadow-black/50"
            onClick={openPortals}
          >
            <Sparkles className="size-4 text-cyan-400 animate-pulse" />
            <span className="text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-white/90">
              SAI READYMIX
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSwitcher className="scale-85 bg-black/50 border-white/10 backdrop-blur-md" />
            <button
              onClick={openPortals}
              className="rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-1.5 text-[11px] font-medium tracking-widest uppercase text-white hover:bg-white/25 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-300 cursor-pointer"
            >
              PORTALS
            </button>
          </div>
        </div>

        {/* Center Hero Copy & Single Explore Button with High-Tech Animations */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto my-auto py-10 sm:py-16">
          {/* Pulsing Radar Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/40 bg-cyan-950/50 backdrop-blur-md px-4 py-1.5 text-[11px] font-medium tracking-wide text-cyan-300 mb-6 shadow-[0_0_25px_rgba(6,182,212,0.25)] animate-fade-in hover:border-cyan-400 transition-colors">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-cyan-400" />
            </span>
            <span className="tracking-wider uppercase">MULKHED UNIT 01 · AUTOMATION CONSOLE</span>
          </div>

          {/* Shimmering Animated Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-light tracking-tight text-white max-w-3xl leading-[1.18] drop-shadow-xl">
            A technology company that powers{" "}
            <span className="animate-shimmer-sweep bg-[linear-gradient(110deg,#38bdf8,35%,#ffffff,50%,#818cf8,65%,#38bdf8)] bg-[length:200%_100%] bg-clip-text text-transparent font-medium">
              next-generation concrete infrastructure
            </span>
          </h1>

          <p className="mt-5 sm:mt-7 text-xs sm:text-sm md:text-base font-light text-slate-300/85 max-w-xl leading-relaxed">
            Automated batching systems, real-time GPS fleet dispatch, compressive cube laboratory, and unified departmental intelligence.
          </p>

          {/* THE SINGLE EXPLORE BUTTON WITH PULSING GLOW RING */}
          <div className="mt-9 sm:mt-12 relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-40 blur-xl group-hover:opacity-85 group-hover:blur-2xl transition-all duration-500 animate-pulse-glow" />
            <button
              onClick={openPortals}
              className="relative inline-flex items-center gap-3.5 rounded-full border border-cyan-400/60 bg-gradient-to-r from-cyan-500/25 via-blue-500/30 to-indigo-500/25 hover:from-cyan-500/40 hover:via-blue-500/45 hover:to-indigo-500/40 px-10 py-4 text-sm sm:text-base font-semibold tracking-wider uppercase text-white backdrop-blur-2xl shadow-[0_0_35px_rgba(6,182,212,0.35)] hover:shadow-[0_0_55px_rgba(6,182,212,0.6)] hover:border-cyan-300 transition-all duration-300 cursor-pointer active:scale-95"
            >
              <span>Explore</span>
              <ArrowRight className="size-4.5 text-cyan-300 group-hover:translate-x-2 transition-transform duration-300" />
            </button>
          </div>

          {/* Subtitle Telemetry Points with Live Indicators */}
          <div className="mt-12 sm:mt-16 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[11px] font-light text-slate-400/80">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>15 Active TMs</span>
            </span>
            <span className="size-1 rounded-full bg-slate-600 hidden sm:inline-block" />
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>M15–M40 Mixes</span>
            </span>
            <span className="size-1 rounded-full bg-slate-600 hidden sm:inline-block" />
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span>IS 456 Certified</span>
            </span>
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
      {/* Galaxy WebGL Background (User's Exact Configuration) */}
      <div className="fixed inset-0 z-0 pointer-events-auto overflow-hidden">
        <Galaxy
          density={1}
          glowIntensity={0.3}
          flareIntensity={1}
          starSpeed={0.5}
          mouseRepulsion
          clickWarp
          starColors={[]}
          hueShift={140}
          saturation={0}
          starSize={1}
          twinkleIntensity={0.3}
          speed={1}
          rotationSpeed={0.1}
          layers={4}
          direction="forward"
          repulsionStrength={2}
          mouseInteraction
          intro
          lightMode={false}
          className="h-full w-full"
        />
        {/* Soft Vignette Overlay for High-Contrast Readable UI */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#090D16_88%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#090D16]/65 via-[#090D16]/25 to-[#090D16]/85" />
      </div>

      {/* Top Header - Glassmorphic with Home button */}
      <header className="relative z-10 sticky top-0 flex h-16 items-center justify-between border-b border-white/10 bg-[#090D16]/85 px-3.5 sm:px-6 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={openHero}
            title="Back to home"
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 hover:border-cyan-400/40 transition-all mr-1 cursor-pointer"
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
          <Link
            to="/reports"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-400" />
            <span>Reports Directory</span>
          </Link>
          <ThemeSwitcher className="scale-90 sm:scale-100" />
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 px-3.5 py-6 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Department Portals Header */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Select Department Portal</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  1-Tap Instant Entry
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300/80">
                Tap any role card below to enter directly, or authenticate via email & password.
              </p>
            </div>

            <Link
              to="/reports"
              className="inline-flex sm:hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all self-start"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-400" />
              <span>Plant Reports Directory (13 Reports)</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Cards Grid: 10 Roles with Decent Staggered Animations & Hover Elevation */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-3.5">
            {DEPARTMENT_ROLES.map((card, idx) => {
              const Icon = card.icon;
              const isSelected = selectedRole.id === card.id;
              const isLoggingIn = busyCardId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => void handleCardClick(card)}
                  disabled={busy}
                  style={{ animationDelay: `${idx * 45}ms` }}
                  className={cn(
                    "animate-card-in group relative flex flex-col items-center justify-between rounded-xl border p-3.5 text-center transition-all duration-300 cursor-pointer min-h-[148px] sm:min-h-[142px] backdrop-blur-md shadow-lg",
                    card.bgClass,
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-[#090D16] -translate-y-2 shadow-2xl shadow-primary/25 bg-slate-900/90 border-primary"
                      : "bg-slate-900/60 hover:-translate-y-2 hover:shadow-2xl hover:bg-slate-800/80 border-white/10 hover:border-white/30"
                  )}
                >
                  <div className="flex flex-col items-center w-full">
                    <div className="relative flex size-11 sm:size-10 items-center justify-center rounded-xl bg-white/10 shadow-md transition-all duration-300 group-hover:scale-115 group-hover:bg-white/15">
                      <Icon className={cn("size-5 transition-transform duration-300 group-hover:rotate-3", card.iconColor)} />
                      {isSelected && !isLoggingIn && (
                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-black shadow-sm">
                          <CheckCircle2 className="size-3 text-primary-foreground fill-primary" />
                        </span>
                      )}
                    </div>
                    <span className="mt-2.5 text-xs font-bold tracking-tight text-white line-clamp-1 group-hover:text-white">
                      {card.title}
                    </span>
                    <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {card.sub}
                    </span>
                  </div>

                  <div className="mt-3 w-full flex items-center justify-center">
                    {isLoggingIn ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-primary animate-pulse py-0.5">
                        <Loader2 className="size-3 animate-spin" /> Entering...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 group-hover:text-primary transition-all py-1 px-2.5 rounded-full bg-black/50 border border-white/10 group-hover:border-primary/40 group-hover:shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                        <span>Enter</span>
                        <ArrowRight className="size-2.5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Centered Glassmorphism Login Credentials Card */}
        <div className="max-w-xl mx-auto w-full">
          <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-6 sm:p-7 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
            {/* Ambient Corner Glow */}
            <div className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-primary/20 blur-3xl" />

            {/* Quick 1-Click Launch Banner for Selected Role */}
            <div className="rounded-xl border border-white/10 bg-slate-800/80 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
                  <selectedRole.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-semibold text-primary tracking-wider">Selected Station</span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                    {selectedRole.title} Console
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    {selectedRole.email}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                className="shrink-0 font-semibold text-xs h-9 cursor-pointer shadow-md hover:shadow-primary/30 transition-shadow"
                onClick={() => void submit(undefined, selectedRole.email, DEMO_PASSWORD)}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="mr-1.5 size-3.5" />
                )}
                Launch {selectedRole.title}
              </Button>
            </div>

            {/* Header & Demo Password Pill */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold tracking-tight text-white">Sign In with Credentials</h2>
                <p className="text-xs text-slate-400">Access authorized departmental workspace</p>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono border-primary/30 text-primary bg-primary/10">
                Demo: {DEMO_PASSWORD}
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
                    className="pl-8 text-xs bg-slate-800/70 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary"
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
                    className="pl-8 text-xs bg-slate-800/70 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary"
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
                  className="text-[11px] text-primary hover:underline cursor-pointer"
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

              <Button type="submit" className="w-full text-xs font-semibold h-10 mt-2 cursor-pointer shadow-lg shadow-primary/20" disabled={busy}>
                {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 size-3.5" />}
                Sign In as {selectedRole.title}
              </Button>
            </form>

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
