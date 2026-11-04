import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarDays, Sparkles, CheckCircle2, AlertTriangle, Clock, Plus, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ChartCard } from "@/components/app/chart-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ordersApi } from "@/api/orders";
import { customersApi, type CustomerRow } from "@/api/customers";
import { AddCustomerDialog } from "@/components/sales/AddCustomerDialog";
import { AddSiteDialog } from "@/components/sales/AddSiteDialog";
import { request } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { GRADES, GRADE_RATE } from "@/lib/mock-data";
import { checkDeliveryCapacity } from "@/lib/capacity-data";
import { cn } from "@/lib/utils";
import type { Grade, Site } from "@/types";

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

const todayDateStr = new Date().toISOString().slice(0, 10);

const schema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  siteId: z.string().min(1, "Select a delivery site"),
  grade: z.enum(GRADES as unknown as [Grade, ...Grade[]]),
  mixDesignId: z.string().optional(),
  slumpRequiredMm: z.coerce.number().min(50, "Slump must be at least 50mm").max(220, "Slump must be under 220mm").default(120),
  rateReason: z.string().optional(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  ratePerCum: z.coerce.number().positive("Enter a rate"),
  deliveryDate: z.string().min(1, "Choose a delivery date").refine((val) => val >= todayDateStr, "Delivery date cannot be in the past"),
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
}).refine((data) => {
  const baseRate = GRADE_RATE[data.grade] || 4500;
  const deviation = Math.abs(data.ratePerCum - baseRate) / baseRate;
  if (deviation > 0.15 && (!data.rateReason || data.rateReason.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Rate deviates by >15% from standard. Please enter a justification reason.",
  path: ["rateReason"],
});

type FormValues = z.input<typeof schema>;

function CreateOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pump, setPump] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newSiteOpen, setNewSiteOpen] = useState(false);

  const customers = useQuery({ queryKey: ["customers"], queryFn: () => customersApi.list().then((r) => r.data) });
  const grades = useQuery({
    queryKey: ["grades"],
    queryFn: () => request<any[]>({ url: "/grades", method: "GET" }).then((r) => r.data || []),
  });
  const ordersList = useQuery({
    queryKey: ["orders", "sales-orders"],
    queryFn: () => ordersApi.list().then((r) => r.data || []),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: "",
      siteId: "",
      grade: "M25",
      mixDesignId: "",
      slumpRequiredMm: 120,
      rateReason: "",
      quantity: 24,
      ratePerCum: GRADE_RATE.M25,
      deliveryDate: todayDateStr,
      deliveryTime: "09:00",
      purpose: "Slab",
      pumpRequired: false,
      paymentTerms: "30 days from invoice",
      reference: "",
      notes: "",
    },
  });

  const watchGrade = form.watch("grade");
  const selectedGradeObj = grades.data?.find((g) => g.code === watchGrade);
  const availableMixes = selectedGradeObj?.mixDesigns || [];

  // When grade changes, pick default mix
  useEffect(() => {
    if (availableMixes.length > 0) {
      const defaultMix = availableMixes.find((m: any) => m.isDefault) || availableMixes[0];
      if (defaultMix && !form.getValues("mixDesignId")) {
        form.setValue("mixDesignId", defaultMix.id);
      }
    }
  }, [watchGrade, availableMixes, form]);

  const create = useMutation({
    mutationFn: (input: { values: FormValues; status: "DRAFT" | "SUBMITTED" }) => {
      const parsed = schema.parse(input.values);
      return ordersApi.create(
        { ...parsed, status: input.status },
        user?.name ?? "Sales",
      );
    },
    onSuccess: (res) => {
      toast.success(res.message ?? "PO saved");
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void navigate({ to: "/sales/orders" });
    },
    onError: (err: any) => toast.error(err?.message || "Please fix the highlighted fields before saving."),
  });

  const selectedCustomer = customers.data?.find((c) => c.id === form.watch("customerId"));
  const err = form.formState.errors;

  const watchDate = form.watch("deliveryDate");
  const watchQty = form.watch("quantity");
  const watchRate = form.watch("ratePerCum");
  const baseRate = GRADE_RATE[watchGrade as Grade] || 4500;
  const isRateDeviated = Math.abs((Number(watchRate) || 0) - baseRate) / baseRate > 0.15;

  const capacityCheck = useMemo(() => {
    return checkDeliveryCapacity(watchDate, Number(watchQty) || 0, undefined, ordersList.data);
  }, [watchDate, watchQty, ordersList.data]);

  function save(status: "DRAFT" | "SUBMITTED") {
    void form.handleSubmit(
      (values) => create.mutate({ values, status }),
      (validationErrors) => {
        const firstErrorKey = Object.keys(validationErrors)[0];
        const errorMsg = firstErrorKey ? (validationErrors as any)[firstErrorKey]?.message || "Validation failed" : "Validation failed";
        toast.error(`Please check ${firstErrorKey || "fields"}: ${errorMsg}`);
      }
    )();
  }

  return (
    <div className="space-y-6 pb-24">
      <PageHeader title="Create Purchase Order" subtitle="Capture order, delivery, pump and payment details" />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Order information" description="Customer, grade and volume">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Customer</Label>
                <button
                  type="button"
                  onClick={() => setNewCustomerOpen(true)}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>+ Add New Customer</span>
                </button>
              </div>
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
              <div className="flex items-center justify-between">
                <Label>Delivery site *</Label>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setNewSiteOpen(true)}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-3" />
                    <span>+ Add Site</span>
                  </button>
                )}
              </div>
              <Select value={form.watch("siteId")} onValueChange={(v) => form.setValue("siteId", v)} disabled={!selectedCustomer}>
                <SelectTrigger><SelectValue placeholder={selectedCustomer ? ((selectedCustomer.sites ?? []).length > 0 ? "Select site" : "No sites added yet — click + Add Site") : "Select a customer first"} /></SelectTrigger>
                <SelectContent>
                  {(selectedCustomer?.sites ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.address})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer && (selectedCustomer.sites ?? []).length === 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
                  <span>This customer has no delivery sites yet.</span>
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setNewSiteOpen(true)}>
                    + Add Site Now
                  </Button>
                </div>
              )}
              {err.siteId && <p className="text-xs text-destructive">{err.siteId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select
                value={form.watch("grade")}
                onValueChange={(v) => {
                  form.setValue("grade", v as Grade);
                  form.setValue("ratePerCum", GRADE_RATE[v as Grade]);
                  const gradeObj = grades.data?.find((g) => g.code === v);
                  const mixes = gradeObj?.mixDesigns || [];
                  const def = mixes.find((m: any) => m.isDefault) || mixes[0];
                  if (def) form.setValue("mixDesignId", def.id);
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
              <Label>Mix Design Recipe</Label>
              <Select
                value={form.watch("mixDesignId")}
                onValueChange={(v) => form.setValue("mixDesignId", v)}
              >
                <SelectTrigger><SelectValue placeholder="Select mix recipe" /></SelectTrigger>
                <SelectContent>
                  {availableMixes.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.description ? `(${m.description})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Required Slump (mm)</Label>
              <Input
                type="number"
                min={50}
                max={220}
                placeholder="120"
                {...form.register("slumpRequiredMm")}
              />
              {err.slumpRequiredMm && <p className="text-xs text-destructive">{err.slumpRequiredMm.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Quantity (cum) *</Label>
              <Input inputMode="decimal" {...form.register("quantity")} />
              {err.quantity && <p className="text-xs text-destructive">{err.quantity.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Rate per cum (₹) *</Label>
                <span className="text-[11px] text-muted-foreground">Standard base rate: ₹{baseRate}/cum</span>
              </div>
              <Input inputMode="decimal" {...form.register("ratePerCum")} />
              {err.ratePerCum && <p className="text-xs text-destructive">{err.ratePerCum.message}</p>}

              {isRateDeviated && (
                <div className="mt-2 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="size-3.5 text-amber-500" />
                    Rate deviation &gt; 15% from standard (₹{baseRate}). Justification reason required:
                  </div>
                  <Input
                    placeholder="e.g. Volume discount approved by sales manager / Special high-slump admixture"
                    {...form.register("rateReason")}
                    className="mt-1 bg-background text-foreground text-xs h-8"
                  />
                  {err.rateReason && <p className="text-xs text-destructive">{err.rateReason.message}</p>}
                </div>
              )}
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
      <AddCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onCustomerCreated={(newCust) => {
          form.setValue("customerId", newCust.id);
          if (newCust.sites && newCust.sites.length > 0 && newCust.sites[0]) {
            form.setValue("siteId", newCust.sites[0].id);
          }
          toast.success(`Selected customer "${newCust.name}" and site for new order!`);
        }}
      />
      {selectedCustomer && (
        <AddSiteDialog
          open={newSiteOpen}
          onOpenChange={setNewSiteOpen}
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          onSiteCreated={(newSite) => {
            void qc.invalidateQueries({ queryKey: ["customers"] });
            form.setValue("siteId", newSite.id);
            toast.success(`Selected newly created site "${newSite.name}"!`);
          }}
        />
      )}
    </div>
  );
}
