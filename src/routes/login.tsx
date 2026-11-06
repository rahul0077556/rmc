import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Boxes,
  Loader2,
  Lock,
  Mail,
  Building2,
  User,
  Phone,
  MapPin,
  Cpu,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Crown,
  Truck,
  Package,
  FlaskConical,
  Warehouse,
  Users,
  FileText,
  Gauge,
  HardHat,
  ChevronDown,
  Info
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Client Portal Login · MixFlow OS Ready-Mix Cloud" },
      {
        name: "description",
        content: "Secure multi-tenant authentication portal for ready-mix concrete plant organizations and department sub-logins.",
      },
    ],
  }),
  component: SecureAuthPage,
});

// Client organizations enrolled in the SaaS platform
const KNOWN_ORGANIZATIONS = [
  { id: "roxxcon", name: "ROXXCON RMC NAGPUR", city: "Nagpur, Maharashtra", status: "Active Client" },
  { id: "apex", name: "Apex Ready Mix Concrete", city: "Pune, Maharashtra", status: "Active Client" },
  { id: "sai", name: "Sai Concrete Infrastructure", city: "Nashik, Maharashtra", status: "Active Client" },
  { id: "shree", name: "Shree Ram Concrete Hub", city: "Mumbai, Maharashtra", status: "Active Client" },
];

// Department sub-logins inside a client organization
const SUB_LOGIN_ROLES = [
  {
    id: "owner",
    role: "owner",
    title: "Plant Owner / Director",
    sub: "Executive P&L & Audits",
    email: "owner@rmc.test",
    icon: Crown,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "sales",
    role: "sales",
    title: "Sales Desk",
    sub: "Order Booking & POs",
    email: "sales@rmc.test",
    icon: FileText,
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    id: "sales_manager",
    role: "sales_manager",
    title: "Sales Manager",
    sub: "Commercial Approvals",
    email: "salesmanager@rmc.test",
    icon: Gauge,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    id: "dispatch",
    role: "dispatcher",
    title: "Dispatch Master",
    sub: "Fleet & TM Logistics",
    email: "dispatcher@rmc.test",
    icon: Truck,
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  {
    id: "supervisor",
    role: "supervisor",
    title: "Site Supervisor",
    sub: "Pouring & Pump Ops",
    email: "supervisor@rmc.test",
    icon: HardHat,
    color: "text-lime-400 bg-lime-500/10 border-lime-500/20",
  },
  {
    id: "production",
    role: "production",
    title: "Production Engineer",
    sub: "CRB-75 SCADA Batching",
    email: "production@rmc.test",
    icon: Package,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  {
    id: "qa",
    role: "qa",
    title: "QA / QC Lab In-Charge",
    sub: "IS 456 Slump & Cubes",
    email: "qa@rmc.test",
    icon: FlaskConical,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  {
    id: "store",
    role: "store",
    title: "Store & Weighbridge",
    sub: "Gross/Tare & Silo Stock",
    email: "store@rmc.test",
    icon: Warehouse,
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  },
  {
    id: "account",
    role: "account",
    title: "Accounts & Payroll",
    sub: "GST Invoicing & Ledger",
    email: "account@rmc.test",
    icon: Users,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  {
    id: "customer",
    role: "customer",
    title: "Customer Client Portal",
    sub: "Live Orders & E-Challans",
    email: "customer1@rmc.test",
    icon: Building2,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
];

function SecureAuthPage() {
  const { login, registerOrganization, user, ready } = useAuth();
  const navigate = useNavigate();

  // Mode: "login" or "signup"
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Selected client organization
  const [organizations, setOrganizations] = useState(KNOWN_ORGANIZATIONS);
  const [selectedOrg, setSelectedOrg] = useState(KNOWN_ORGANIZATIONS[0]!);
  const [selectedSubLogin, setSelectedSubLogin] = useState(SUB_LOGIN_ROLES[0]!);

  // Fetch real organizations from backend
  useEffect(() => {
    fetch("/api/v1/auth/organizations")
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const list = res.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            city: p.city || "India",
            status: "Active Plant Workspace",
          }));
          setOrganizations(list);
          if (!list.find((o: any) => o.id === selectedOrg.id)) {
            setSelectedOrg(list[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Login form state
  const [email, setEmail] = useState(SUB_LOGIN_ROLES[0]!.email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSandboxGuide, setShowSandboxGuide] = useState(false);

  // Sign up form state (New Plant Client onboarding)
  const [signupOrgName, setSignupOrgName] = useState("");
  const [signupCity, setSignupCity] = useState("");
  const [signupScada, setSignupScada] = useState("CRB-75");
  const [signupCapacity, setSignupCapacity] = useState("60 cum/hr");
  const [signupAdminName, setSignupAdminName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  // Check URL query params for initial tab
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "signup" || params.get("tab") === "signup") {
        setAuthMode("signup");
      }
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (ready && user) {
      void navigate({ to: homeForRole(user.role) });
    }
  }, [ready, user, navigate]);

  function handleSubLoginSelect(sub: (typeof SUB_LOGIN_ROLES)[0]) {
    setSelectedSubLogin(sub);
    setEmail(sub.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const signedIn = await login(email, password);
      toast.success(`Authenticated successfully as ${signedIn.name}`);
      void navigate({
        to: DEMO_ACCOUNTS.find((a) => a.email === signedIn.email)?.home ?? homeForRole(signedIn.role),
      });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Authentication failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const signedIn = await registerOrganization({
        organization_name: signupOrgName,
        name: signupAdminName,
        email: signupEmail,
        password: signupPassword,
        phone: signupPhone,
        city: signupCity,
        role: "owner",
      });

      toast.success(`Plant workspace created for ${signupOrgName}! Welcome.`);
      void navigate({ to: homeForRole(signedIn.role) });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Could not initialize plant workspace. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function applySandboxCredentials(sub: (typeof SUB_LOGIN_ROLES)[0]) {
    setSelectedSubLogin(sub);
    setEmail(sub.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
    toast.info(`Sandbox credentials loaded for ${sub.title}`);
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] selection:bg-emerald-500 selection:text-black font-sans antialiased relative flex flex-col justify-between">
      {/* Background Tech Grid & Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none" />
      </div>

      {/* Top Header */}
      <header className="relative z-20 w-full border-b border-white/[0.08] bg-[#07090e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-black font-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Boxes className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                  MixFlow <span className="text-emerald-400">OS</span>
                </span>
                <Badge variant="outline" className="hidden sm:inline-flex text-[9px] px-2 py-0.5 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-mono">
                  SaaS Gateway
                </Badge>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Enterprise Ready-Mix Concrete Cloud
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Product Website
            </Link>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Main Authentication Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="max-w-xl w-full">
          {/* Card Header & Tab Switcher */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 mb-3">
              <ShieldCheck className="size-3.5" />
              <span>Multi-Tenant Client Security Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {authMode === "login" ? "Client Organization Sign In" : "Onboard New Plant Client"}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {authMode === "login"
                ? "Authenticate into your licensed plant workspace and authorized department station."
                : "Register a dedicated cloud workspace for your ready-mix concrete production facility."}
            </p>

            {/* Mode Switcher Tabs */}
            <div className="mt-5 inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setError(null);
                }}
                className={cn(
                  "px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  authMode === "login"
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Client Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setError(null);
                }}
                className={cn(
                  "px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  authMode === "signup"
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Onboard New Plant
              </button>
            </div>
          </div>

          {/* Form Card */}
          <div className="rounded-2xl border border-white/[0.1] bg-[#0c1018]/95 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative">
            {/* ======================================================== */}
            {/* TAB 1: LOGIN                                             */}
            {/* ======================================================== */}
            {authMode === "login" && (
              <div className="space-y-6">
                {/* 1. Client Organization Workspace */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-emerald-400" />
                      <span>Select Client Plant Workspace</span>
                    </Label>
                    <span className="text-[10px] text-emerald-400 font-mono">Multi-Tenant</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {organizations.map((org) => {
                      const isOrgSelected = selectedOrg.id === org.id;
                      return (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => setSelectedOrg(org)}
                          className={cn(
                            "text-left p-2.5 rounded-xl border transition-all cursor-pointer",
                            isOrgSelected
                              ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-xs"
                              : "border-white/[0.08] bg-black/40 text-slate-400 hover:border-white/20 hover:text-slate-200"
                          )}
                        >
                          <span className="text-xs font-bold block truncate text-white">{org.name}</span>
                          <span className="text-[10px] text-slate-400 block truncate">{org.city}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Department Sub-Login Role Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Cpu className="size-3.5 text-cyan-400" />
                      <span>Authorized Department Sub-Login</span>
                    </Label>
                    <span className="text-[10px] text-slate-400 font-mono">10 Roles · 1-Click Access</span>
                  </div>

                  {/* Open, Fully Visible Responsive Grid of All 10 Roles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                    {SUB_LOGIN_ROLES.map((sub) => {
                      const isSubSelected = selectedSubLogin.id === sub.id;
                      const Icon = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSubLoginSelect(sub)}
                          className={cn(
                            "flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer text-left",
                            isSubSelected
                              ? "border-emerald-500/60 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40 shadow-sm"
                              : "border-white/[0.08] bg-black/40 text-slate-400 hover:border-white/20 hover:text-slate-200 hover:bg-white/[0.02]"
                          )}
                        >
                          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg border", sub.color)}>
                            <Icon className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold truncate text-white">{sub.title}</span>
                              {isSubSelected && <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />}
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">{sub.sub}</span>
                            <span className="text-[10px] text-emerald-400/80 font-mono block truncate">{sub.email}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Sub-Login Banner */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("flex size-8 items-center justify-center rounded-lg border", selectedSubLogin.color)}>
                      <selectedSubLogin.icon className="size-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">
                        {selectedSubLogin.title} ({selectedOrg.name})
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {email}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    Encrypted
                  </Badge>
                </div>

                {/* 3. Credentials Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-medium text-slate-300">
                      Authorized Work Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 size-4 text-slate-500" />
                      <Input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="operator@plant.com"
                        className="pl-9 text-xs bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-xs font-medium text-slate-300">
                        Secure Password
                      </Label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPassword(DEMO_PASSWORD);
                            toast.info("Filled Demo@123 password");
                          }}
                          className="text-[10px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/20 font-mono cursor-pointer transition-colors"
                        >
                          Fill Demo@123
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                          <span>{showPassword ? "Hide" : "Show"}</span>
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 size-4 text-slate-500" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="pl-9 pr-10 text-xs font-mono bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                      <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                      <span>Keep signed in for this shift</span>
                    </label>
                    <button
                      type="button"
                      className="text-xs text-emerald-400 hover:underline cursor-pointer"
                      onClick={() => toast.info(`Password is administered by ${selectedOrg.name} IT admin.`)}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2.5 text-xs text-red-400">
                      <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full text-xs font-extrabold h-11 bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 cursor-pointer transition-all hover:scale-[1.01]"
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
                    <span>Sign In to {selectedSubLogin.title}</span>
                  </Button>
                </form>

                {/* Collapsible Sandbox / Demo Credentials Helper */}
                <div className="pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setShowSandboxGuide(!showSandboxGuide)}
                    className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1.5 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Info className="size-3.5 text-emerald-400" />
                      <span>Evaluation Sandbox & Demo Credentials</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      {showSandboxGuide ? "Hide" : "View"}
                    </span>
                  </button>

                  {showSandboxGuide && (
                    <div className="mt-3 p-3.5 rounded-xl border border-white/10 bg-black/70 space-y-3 text-xs animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-semibold">Pre-Configured Plant Credentials:</span>
                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
                          Password: {DEMO_PASSWORD}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        To test different plant sub-logins during evaluation, tap any role below to populate credentials:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {SUB_LOGIN_ROLES.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => applySandboxCredentials(sub)}
                            className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-left transition-colors cursor-pointer"
                          >
                            <span className="text-[11px] font-bold text-white block truncate">{sub.title}</span>
                            <span className="text-[9px] text-slate-500 font-mono block truncate">{sub.email}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: SIGN UP (ONBOARD NEW PLANT CLIENT)               */}
            {/* ======================================================== */}
            {authMode === "signup" && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <Sparkles className="size-4" />
                    <span>New Client Plant Onboarding</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    This provisions an isolated multi-tenant organization database, creates the Plant Director root account, and prepares sub-logins for your plant crew.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="signup-org" className="text-xs font-medium text-slate-300">
                      Organization / Plant Name *
                    </Label>
                    <Input
                      id="signup-org"
                      type="text"
                      value={signupOrgName}
                      onChange={(e) => setSignupOrgName(e.target.value)}
                      placeholder="e.g. Apex Ready Mix Concrete"
                      className="text-xs bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-city" className="text-xs font-medium text-slate-300">
                      Plant City / Location *
                    </Label>
                    <Input
                      id="signup-city"
                      type="text"
                      value={signupCity}
                      onChange={(e) => setSignupCity(e.target.value)}
                      placeholder="e.g. Nagpur, Maharashtra"
                      className="text-xs bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="signup-scada" className="text-xs font-medium text-slate-300">
                      SCADA Controller Model
                    </Label>
                    <select
                      id="signup-scada"
                      value={signupScada}
                      onChange={(e) => setSignupScada(e.target.value)}
                      className="w-full h-9 rounded-md border border-white/10 bg-black/50 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="CRB-75">CRB-75 Plant Controller</option>
                      <option value="Schwing Stetter">Schwing Stetter MCI 70/100</option>
                      <option value="Liebherr">Liebherr Litronic-MPS</option>
                      <option value="Simem">Simem Bravo Control</option>
                      <option value="Other / Universal">Universal CSV / Optical SCADA</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-cap" className="text-xs font-medium text-slate-300">
                      Batching Capacity
                    </Label>
                    <select
                      id="signup-cap"
                      value={signupCapacity}
                      onChange={(e) => setSignupCapacity(e.target.value)}
                      className="w-full h-9 rounded-md border border-white/10 bg-black/50 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="30 cum/hr">30 cum / hour</option>
                      <option value="60 cum/hr">60 cum / hour</option>
                      <option value="90 cum/hr">90 cum / hour</option>
                      <option value="120 cum/hr">120+ cum / hour</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-white/[0.08] pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-xs font-medium text-slate-300">
                      Director / Admin Full Name *
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupAdminName}
                      onChange={(e) => setSignupAdminName(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className="text-xs bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-phone" className="text-xs font-medium text-slate-300">
                      Phone Number *
                    </Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="text-xs bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="signup-email" className="text-xs font-medium text-slate-300">
                    Official Corporate Email *
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="director@yourcompany.com"
                    className="text-xs bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="signup-pw" className="text-xs font-medium text-slate-300">
                      Admin Password *
                    </Label>
                    <Input
                      id="signup-pw"
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="text-xs font-mono bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-cpw" className="text-xs font-medium text-slate-300">
                      Confirm Password *
                    </Label>
                    <Input
                      id="signup-cpw"
                      type="password"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="text-xs font-mono bg-black/50 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2.5 text-xs text-red-400">
                    <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full text-xs font-extrabold h-11 mt-2 bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 cursor-pointer transition-all hover:scale-[1.01]"
                  disabled={busy}
                >
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                  <span>Initialize Organization Workspace</span>
                </Button>
              </form>
            )}

            {/* Card Footer */}
            <div className="mt-6 border-t border-white/[0.08] pt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span>Multi-Tenant Role-Segregated Isolation</span>
              </span>
              <span className="font-mono">MixFlow OS v3.0</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#05070a] px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 MixFlow OS · Enterprise Ready-Mix Concrete SaaS Platform</p>
        <div className="flex items-center gap-4 text-xs">
          <Link to="/" className="hover:text-slate-300 transition-colors">Product Solutions</Link>
          <span>·</span>
          <span className="text-emerald-400">IS 456 & IS 10262 Certified Architecture</span>
        </div>
      </footer>
    </div>
  );
}
