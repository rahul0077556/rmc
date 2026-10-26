import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarDays, Sparkles, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ChartCard } from "@/components/app/chart-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ordersApi } from "@/api/orders";
import { customersApi } from "@/api/customers";
import { useAuth } from "@/auth/auth-context";
import { GRADES, GRADE_RATE } from "@/lib/mock-data";
import { checkDeliveryCapacity } from "@/lib/capacity-data";
import { cn } from "@/lib/utils";
import type { Grade } from "@/types";

export const Route = createFileRoute("/_shell/sales/orders/new")({
  head: () => ({
    meta: [
      { title: "Create Purchase Order · RMC Command Center" },
      { name: "description", content: "Raise a new concrete purchase order with delivery and pump requirements." },
      { property: "og:title", content: "Create Purchase Order · RMC Command Center" },
      { property: "og:description", content: "Raise a new concrete purchase order with delivery and pump requirements." },
    ],
  }),
  component: CreateOrderPage,
});

const schema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  siteId: z.string().min(1, "Select a delivery site"),
  grade: z.enum(GRADES as unknown as [Grade, ...Grade[]]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  ratePerCum: z.coerce.number().positive("Enter a rate"),
  deliveryDate: z.string().min(1, "Choose a delivery date"),
  deliveryTime: z.string().min(1, "Choose a delivery time"),
  purpose: z.enum(["Slab", "Column", "Beam", "Footing", "Other"]),
  pumpRequired: z.boolean(),
  pumpOwnership: z.enum(["Customer Pump", "Company Pump"]).optional(),
  pumpType: z.enum(["Horizontal", "Vertical"]).optional(),
  pipelineLength: z.coerce.number().min(0).optional(),
  workersRequired: z.coerce.number().min(0).optional(),
  paymentTerms: z.string().min(1, "Enter payment terms"),
  reference: z.string(),
  notes: z.string(),
});

type FormValues = z.input<typeof schema>;

function CreateOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pump, setPump] = useState(false);

  const customers = useQuery({ queryKey: ["customers"], queryFn: () => customersApi.list().then((r) => r.data) });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: "",
      siteId: "",
      grade: "M25",
      quantity: 24,
      ratePerCum: GRADE_RATE.M25,
      deliveryDate: new Date().toISOString().slice(0, 10),
      deliveryTime: "09:00",
      purpose: "Slab",
      pumpRequired: false,
      paymentTerms: "30 days from invoice",
      reference: "",
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: (input: { values: FormValues; status: "DRAFT" | "SUBMITTED" }) =>
      ordersApi.create(
        { ...schema.parse(input.values), status: input.status },
        user?.name ?? "Sales",
      ),
    onSuccess: (res) => {
      toast.success(res.message ?? "PO saved");
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void navigate({ to: "/sales/orders" });
    },
    onError: () => toast.error("Please fix the highlighted fields before saving."),
  });

  const selectedCustomer = customers.data?.find((c) => c.id === form.watch("customerId"));
  const err = form.formState.errors;

  const watchDate = form.watch("deliveryDate");
  const watchQty = form.watch("quantity");
  const capacityCheck = useMemo(() => {
    return checkDeliveryCapacity(watchDate, Number(watchQty) || 0);
  }, [watchDate, watchQty]);

  function save(status: "DRAFT" | "SUBMITTED") {
    void form.handleSubmit((values) => create.mutate({ values, status }))();
  }

  return (
    <div className="space-y-6 pb-24">
      <PageHeader title="Create Purchase Order" subtitle="Capture order, delivery, pump and payment details" />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Order information" description="Customer, grade and volume">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Customer</Label>
              <Select
                value={form.watch("customerId")}
                onValueChange={(v) => {
                  form.setValue("customerId", v);
                  form.setValue("siteId", "");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {(customers.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err.customerId && <p className="text-xs text-destructive">{err.customerId.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Delivery site</Label>
              <Select value={form.watch("siteId")} onValueChange={(v) => form.setValue("siteId", v)} disabled={!selectedCustomer}>
                <SelectTrigger><SelectValue placeholder={selectedCustomer ? "Select site" : "Select a customer first"} /></SelectTrigger>
                <SelectContent>
                  {(selectedCustomer?.sites ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err.siteId && <p className="text-xs text-destructive">{err.siteId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Grade / mix</Label>
              <Select
                value={form.watch("grade")}
                onValueChange={(v) => {
                  form.setValue("grade", v as Grade);
                  form.setValue("ratePerCum", GRADE_RATE[v as Grade]);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Quantity (cum)</Label>
              <Input inputMode="decimal" {...form.register("quantity")} />
              {err.quantity && <p className="text-xs text-destructive">{err.quantity.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Rate per cum (₹)</Label>
              <Input inputMode="decimal" {...form.register("ratePerCum")} />
              {err.ratePerCum && <p className="text-xs text-destructive">{err.ratePerCum.message}</p>}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Delivery details" description="When and where the pour happens">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Delivery date</Label>
              <Input type="date" {...form.register("deliveryDate")} />
              {err.deliveryDate && <p className="text-xs text-destructive">{err.deliveryDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Delivery time</Label>
              <Input type="time" {...form.register("deliveryTime")} />
            </div>

            {/* Live "Can we deliver this?" validation banner */}
            <div
              className={cn(
                "sm:col-span-2 rounded-xl border p-3.5 text-xs space-y-2 transition-all duration-300",
                capacityCheck.status === "confirmed" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
                capacityCheck.status === "tight" && "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100",
                capacityCheck.status === "overbooked" && "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-100"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  “Can we deliver this?”
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                    capacityCheck.status === "confirmed" && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                    capacityCheck.status === "tight" && "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
                    capacityCheck.status === "overbooked" && "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse font-extrabold"
                  )}
                >
                  {capacityCheck.status === "confirmed" ? "Slot Available" : capacityCheck.status === "tight" ? "Tight Schedule" : "Overbooked"}
                </span>
              </div>

              <p className="text-foreground leading-relaxed font-medium">
                {capacityCheck.message}
              </p>

              {capacityCheck.status !== "confirmed" && capacityCheck.nearestOpenSlots.length > 0 && (
                <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Sparkles className="size-3.5 text-amber-500" />
                    Nearest open slots:
                  </span>
                  {capacityCheck.nearestOpenSlots.map((s) => (
                    <button
                      key={s.date}
                      type="button"
                      onClick={() => form.setValue("deliveryDate", s.date)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 transition-colors"
                    >
                      <strong className="font-bold">{s.dayName}, {s.displayDate}</strong> (+{s.availableCum} cum open · {s.utilizationPercent}%)
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Purpose</Label>
              <Select value={form.watch("purpose")} onValueChange={(v) => form.setValue("purpose", v as FormValues["purpose"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Slab", "Column", "Beam", "Footing", "Other"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Pump requirement" description="Placement equipment for this pour">
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm">Pump required</span>
              <Switch
                checked={pump}
                onCheckedChange={(v) => {
                  setPump(v);
                  form.setValue("pumpRequired", v);
                }}
              />
            </label>

            {pump && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Ownership</Label>
                  <Select
                    value={form.watch("pumpOwnership") ?? "Company Pump"}
                    onValueChange={(v) => form.setValue("pumpOwnership", v as "Customer Pump" | "Company Pump")}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Company Pump">Company</SelectItem>
                      <SelectItem value="Customer Pump">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Pump type</Label>
                  <Select
                    value={form.watch("pumpType") ?? "Horizontal"}
                    onValueChange={(v) => form.setValue("pumpType", v as "Horizontal" | "Vertical")}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Horizontal">Horizontal</SelectItem>
                      <SelectItem value="Vertical">Vertical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Pipeline length (m)</Label>
                  <Input inputMode="numeric" {...form.register("pipelineLength")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Workers required</Label>
                  <Input inputMode="numeric" {...form.register("workersRequired")} />
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Payment & notes" description="Commercial terms for this order">
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Payment terms</Label>
              <Input {...form.register("paymentTerms")} />
              {err.paymentTerms && <p className="text-xs text-destructive">{err.paymentTerms.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Customer PO reference</Label>
              <Input placeholder="Customer document reference" {...form.register("reference")} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} placeholder="Site instructions, timing constraints, access notes" {...form.register("notes")} />
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:left-[250px]">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => void navigate({ to: "/sales/orders" })}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => save("DRAFT")} disabled={create.isPending}>
            Save draft
          </Button>
          <Button onClick={() => save("SUBMITTED")} disabled={create.isPending}>
            Submit PO
          </Button>
        </div>
      </div>
    </div>
  );
}
