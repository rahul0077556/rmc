import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Boxes, Loader2, ShieldCheck, Truck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, homeForRole } from "@/api/auth";
import { useAuth } from "@/auth/auth-context";
import { isApiError } from "@/api/client";
import { PLANT_NAME } from "@/lib/mock-data";
import { Truck3DCanvas } from "@/components/home/Truck3DCanvas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in · RMC Command Center" },
      {
        name: "description",
        content: "Sign in to the RMC Command Center order-to-delivery operations platform.",
      },
      { property: "og:title", content: "Sign in · RMC Command Center" },
      {
        property: "og:description",
        content: "Sign in to the RMC Command Center order-to-delivery operations platform.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("owner@rmc.test");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) void navigate({ to: homeForRole(user.role) });
  }, [ready, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signedIn = await login(email, password);
      toast.success(`Welcome back, ${signedIn.name}`);
      void navigate({ to: DEMO_ACCOUNTS.find((a) => a.email === signedIn.email)?.home ?? homeForRole(signedIn.role) });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Unable to sign in right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.18fr_1fr]">
      {/* LEFT SECTION: 3D HERO SHOWCASE */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-8 lg:flex xl:p-10">
        <div className="grid-fade absolute inset-0" />
        <div className="absolute -left-24 top-24 size-[420px] rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 size-[360px] rounded-full bg-info/10 blur-3xl pointer-events-none" />

        {/* Top Branding */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="brand-gradient flex size-10 items-center justify-center rounded-xl text-primary-foreground shadow-lg shadow-primary/20">
              <Boxes className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">RMC Command Center</p>
              <p className="text-xs text-muted-foreground">{PLANT_NAME}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            <span>Interactive 3D Fleet Experience</span>
          </div>
        </div>

        {/* Middle: Headline & 3D Truck Model */}
        <div className="relative my-auto flex flex-col pt-4">
          <div className="max-w-xl">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              From Order to Delivery,{" "}
              <span className="bg-gradient-to-r from-primary via-purple-400 to-indigo-300 bg-clip-text text-transparent">
                Under Control.
              </span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Intelligent industrial dispatch & fleet control for {PLANT_NAME} — real-time 3D mixer simulation,
              batching telemetry, slump & cube quality gates, challans, and collections.
            </p>
          </div>

          {/* 3D Interactive Transit Mixer Canvas Viewport */}
          <div className="relative my-4 h-[380px] w-full xl:h-[430px]">
            <Truck3DCanvas />
          </div>

          {/* Key Plant Metrics */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Transit Mixers", value: "18", sub: "Live GPS & Telemetry" },
              { label: "Grades Produced", value: "M15–M40", sub: "Auto-Batching Scales" },
              { label: "Stages Tracked", value: "12", sub: "QC-Gated Dispatch" },
            ].map((s) => (
              <div key={s.label} className="panel px-3.5 py-2.5 transition-all hover:border-primary/40">
                <p className="text-lg font-semibold tracking-tight text-foreground">{s.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="text-[10px] text-primary/80">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Badges */}
        <div className="relative flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Truck className="size-4 text-primary" /> Dispatch to delivery in one unified timeline
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-400" /> IS 456 / IS 10262 QC verification
          </span>
        </div>
      </section>

      {/* RIGHT SECTION: SIGN IN & ROLE PICKER */}
      <section className="flex flex-col items-center justify-center p-6 sm:p-8 lg:p-10">
        <div className="w-full max-w-sm">
          {/* Mobile Branding & Mobile 3D Canvas */}
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="brand-gradient flex size-10 items-center justify-center rounded-xl text-primary-foreground">
                <Boxes className="size-5" />
              </span>
              <div>
                <p className="text-base font-semibold">RMC Command Center</p>
                <p className="text-xs text-muted-foreground">{PLANT_NAME}</p>
              </div>
            </div>

            {/* Mobile 3D Preview */}
            <div className="relative mt-4 h-[230px] w-full overflow-hidden rounded-xl border border-border">
              <Truck3DCanvas />
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Access your plant operations account.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@rmc.test"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                Remember me
              </label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => toast.info("Password reset is managed by your plant administrator.")}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full font-medium" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Sign in to Operations
            </Button>
          </form>

          {/* Quick-Access Role Switcher */}
          <div className="mt-8 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Demo Accounts (10 Roles)
              </p>
              <span className="text-[11px] font-mono text-primary font-medium">{DEMO_PASSWORD}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Click any role to autofill credentials and explore its dashboard:
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    toast.info(`Filled credentials for ${account.label}`);
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                    email === account.email
                      ? "border-primary bg-primary/15 text-primary shadow-sm"
                      : "border-border bg-surface-raised text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
