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
  Radio
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
      { title: "ROXXCON RMC NAGPUR · Enterprise Operations Platform" },
      {
        name: "description",
        content: "Enterprise control dashboard for ROXXCON RMC NAGPUR Ready-Mix Concrete Plant. Order-to-delivery, SCADA batching telemetry, weighbridge, and department reports.",
      },
    ],
  }),
  component: LoginPage,
});

const DEPARTMENT_ROLES = [
  {
    id: "owner",
    title: "Owner",
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
    title: "Dispatch",
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
    title: "Production",
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
    title: "QA / QC Lab",
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
    title: "Store & Yard",
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
    title: "HR & Accounts",
    sub: "Billing & Payroll",
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

function LoginPage() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary selection:text-primary-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
            <Boxes className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                ROXXCON RMC NAGPUR
              </span>
              <Badge variant="outline" className="hidden xs:inline-flex text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold">
                Plant Online
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Enterprise Ready-Mix Concrete Operations Platform · IS 4926 & IS 10262
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/reports"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-500" />
            <span>Reports Directory</span>
          </Link>
          <ThemeSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full space-y-8">
        {/* Plant Overview Banner */}
        <section className="text-center sm:text-left space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-1">
            <Radio className="size-3 animate-pulse text-emerald-500" />
            <span>ROXXCON RMC Unit · Direct Department Authentication</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Ready-Mix Plant Command Center
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Select an operational station below for instant 1-tap workspace entry, or sign in with your corporate credentials.
          </p>
        </section>

        {/* 10 Department Workspaces Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Department Workstations
            </h2>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Tap any role card for immediate launch
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
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
                    "group relative flex flex-col items-center justify-between rounded-xl border p-4 text-center transition-all duration-200 cursor-pointer min-h-[140px] text-left",
                    isSelected
                      ? "ring-2 ring-primary border-primary bg-primary/5 shadow-md shadow-primary/10"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 shadow-xs"
                  )}
                >
                  <div className="flex flex-col items-center w-full">
                    <div className={cn("flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105", card.bgClass)}>
                      <Icon className={cn("size-5", card.iconColor)} />
                      {isSelected && !isLoggingIn && (
                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckCircle2 className="size-3" />
                        </span>
                      )}
                    </div>
                    <span className="mt-2.5 text-xs font-bold tracking-tight text-foreground line-clamp-1">
                      {card.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {card.sub}
                    </span>
                  </div>

                  <div className="mt-3 w-full flex items-center justify-center">
                    {isLoggingIn ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-primary animate-pulse">
                        <Loader2 className="size-3 animate-spin" /> Entering...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-primary transition-colors py-0.5 px-2 rounded-md bg-secondary/70">
                        <span>Launch</span>
                        <ArrowRight className="size-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Credentials Form Box */}
        <section className="max-w-xl mx-auto w-full">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg">
            {/* Active Station Banner */}
            <div className="rounded-xl border border-border bg-secondary/40 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <selectedRole.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Active Station</span>
                  <h3 className="text-sm font-bold text-foreground truncate">
                    {selectedRole.title} Workspace
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {selectedRole.email}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                className="shrink-0 font-semibold text-xs h-9 cursor-pointer"
                onClick={() => void submit(undefined, selectedRole.email, DEMO_PASSWORD)}
                disabled={busy}
              >
                {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 size-3.5" />}
                1-Tap Launch
              </Button>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Sign In with Credentials</h2>
                <p className="text-xs text-muted-foreground">Authenticate for your authorized plant role</p>
              </div>
              <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary bg-primary/10">
                Default: {DEMO_PASSWORD}
              </Badge>
            </div>

            {/* Form */}
            <form onSubmit={(e) => submit(e)} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@rmc.test"
                    className="pl-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                  <span>Remember session</span>
                </label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
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

              <Button type="submit" className="w-full text-xs font-semibold h-10 mt-2 cursor-pointer shadow-md" disabled={busy}>
                {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 size-3.5" />}
                Sign In as {selectedRole.title}
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>Role-Based Operational Access</span>
              </span>
              <span className="font-mono">ROXXCON RMC v2.4.0</span>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Enterprise Footer */}
      <footer className="border-t border-border bg-card/60 px-6 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 ROXXCON RMC NAGPUR · Ready-Mix Concrete Operations Platform</p>
        <div className="flex items-center gap-4">
          <Link to="/reports" className="hover:text-foreground transition-colors">Plant Reports (13 Modules)</Link>
          <span>·</span>
          <span className="text-emerald-500 font-medium">IS 456 & IS 10262 Compliant</span>
        </div>
      </footer>

      {/* AI Plant Copilot */}
      <RmcChatbot />
    </div>
  );
}
