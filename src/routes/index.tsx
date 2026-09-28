import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Boxes, Loader2, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, homeForRole } from "@/api/auth";
import { useAuth } from "@/auth/auth-context";
import { isApiError } from "@/api/client";
import { PLANT_NAME } from "@/lib/mock-data";

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
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex">
        <div className="grid-fade absolute inset-0" />
        <div className="absolute -left-24 top-24 size-[420px] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-[360px] rounded-full bg-info/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="brand-gradient flex size-10 items-center justify-center rounded-xl text-primary-foreground">
            <Boxes className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">RMC Command Center</p>
            <p className="text-xs text-muted-foreground">Order-to-Delivery Operations Platform</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            From Order to Delivery, <span className="text-primary">Under Control.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            One control surface for {PLANT_NAME} — purchase orders, dispatch planning, transit mixer
            assignment, batching, quality control, challans and collections.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: "Transit Mixers", value: "12" },
              { label: "Grades Produced", value: "M15–M40" },
              { label: "Stages Tracked", value: "12" },
            ].map((s) => (
              <div key={s.label} className="panel px-3 py-3">
                <p className="text-lg font-semibold">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Truck className="size-4 text-primary" /> Dispatch to delivery in one timeline
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> QC-gated releases
          </span>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <span className="brand-gradient mb-3 flex size-10 items-center justify-center rounded-xl text-primary-foreground">
              <Boxes className="size-5" />
            </span>
            <p className="text-lg font-semibold">RMC Command Center</p>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your plant account to continue.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
              <label className="flex items-center gap-2 text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                Remember me
              </label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => toast.info("Password reset is handled by your plant administrator.")}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Demo credentials
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a role to fill in its account. Password: <span className="text-foreground">{DEMO_PASSWORD}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                  className="rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-xs transition-colors hover:border-primary/50 hover:text-primary"
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
