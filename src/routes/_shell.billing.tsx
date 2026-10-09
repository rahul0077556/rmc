import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, CircleDollarSign, Receipt, TriangleAlert } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/app/filter-bar";
import { useListQuery } from "@/hooks/use-list-query";
import { ChartCard } from "@/components/app/chart-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invoicesApi, type InvoiceRow } from "@/api/invoices";
import { isApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { inr } from "@/lib/format";
import type { Payment } from "@/types";

export const Route = createFileRoute("/_shell/billing")({
  head: () => ({
    meta: [
      { title: "Billing · RMC Command Center" },
      { name: "description", content: "Invoices, collections and outstanding balances across customers." },
    ],
  }),
  component: BillingPage,
});

const MODES: Payment["mode"][] = ["Bank Transfer", "Cheque", "Cash", "UPI", "Other"];
const STATUSES = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];
const DONUT_COLORS = ["#94a3b8", "#3b82f6", "#eab308", "#22c55e", "#ef4444", "#64748b"];

function BillingPage() {
  const { user } = useAuth();
  const readOnly = user?.role === "owner";
  const qc = useQueryClient();
  const [target, setTarget] = useState<InvoiceRow | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Payment["mode"]>("Bank Transfer");
  const [reference, setReference] = useState("");

  const { params, updateParams, query: invoices } = useListQuery(
    ["invoices-list"],
    () => invoicesApi.list().then((r) => r.data)
  );
  const summary = useQuery({ queryKey: ["invoice-summary"], queryFn: () => invoicesApi.summary().then((r) => r.data) });

  const pay = useMutation({
    mutationFn: (input: { id: string; amount: number }) =>
      invoicesApi.recordPayment(
        input.id,
        { amount: input.amount, paidDate: new Date().toISOString().slice(0, 10), mode, reference },
        user?.name ?? "Billing",
      ),
    onSuccess: () => {
      toast.success("Payment recorded");
      setTarget(null);
      setAmount("");
      setReference("");
      void qc.invalidateQueries();
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Payment could not be recorded"),
  });

  const filteredInvoices = useMemo(() => {
    if (!invoices.data) return [];
    let list = invoices.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i) => i.invoiceNumber.toLowerCase().includes(lower) || i.customerName.toLowerCase().includes(lower));
    }
    if (params['status'] && params['status'] !== "all") {
      list = list.filter((i) => i.status === params['status']);
    }
    return list;
  }, [invoices.data, params]);

  const statusDistribution = useMemo(() => {
    if (!invoices.data) return [];
    const counts = {} as Record<string, number>;
    invoices.data.forEach(i => {
      counts[i.status] = (counts[i.status] || 0) + 1;
    });
    return STATUSES.map(s => ({
      name: s.replace(/_/g, " "),
      value: counts[s] || 0
    })).filter(s => s.value > 0);
  }, [invoices.data]);

  if (invoices.isLoading || summary.isLoading) return <LoadingState rows={5} />;
  if (invoices.error || !invoices.data || !summary.data)
    return <ErrorState message="Billing data could not be loaded." onRetry={() => void invoices.refetch()} />;

  const columns: Column<InvoiceRow>[] = [
    { key: "inv", header: "Invoice", cell: (r) => <span className="font-medium">{r.invoiceNumber}</span> },
    { key: "po", header: "PO", cell: (r) => r.poId },
    { key: "customer", header: "Customer", cell: (r) => r.customerName, sortValue: (r) => r.customerName },
    { key: "issue", header: "Issue Date", cell: (r) => r.issueDate, sortValue: (r) => r.issueDate },
    { key: "due", header: "Due Date", cell: (r) => r.dueDate },
    { key: "amount", header: "Amount", align: "right", cell: (r) => inr(r.amount), sortValue: (r) => r.amount },
    { key: "paid", header: "Paid", align: "right", cell: (r) => inr(r.paid) },
    { key: "out", header: "Outstanding", align: "right", cell: (r) => inr(r.outstanding), sortValue: (r) => r.outstanding },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) =>
        !readOnly && r.outstanding > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTarget(r);
              setAmount(String(r.outstanding));
            }}
          >
            Record payment
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" subtitle="Invoices raised against delivered concrete" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total invoiced" value={inr(summary.data.invoiced)} icon={Receipt} />
        <KpiCard label="Received" value={inr(summary.data.received)} icon={Banknote} />
        <KpiCard label="Outstanding" value={inr(summary.data.outstanding)} icon={CircleDollarSign} />
        <KpiCard label="Overdue" value={inr(summary.data.overdue)} icon={TriangleAlert} />
      </div>

      <FilterBar
        search={params.q}
        onSearchChange={(q) => updateParams({ q })}
        searchPlaceholder="Search invoices or customers..."
        filters={[
          {
            key: "status",
            placeholder: "Status",
            value: params['status'],
            options: STATUSES.map((s) => ({ label: s.replace(/_/g, " "), value: s })),
            onChange: (status) => updateParams({ status }),
          }
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={readOnly ? "lg:col-span-2" : "lg:col-span-3"}>
          <DataTable
            columns={columns}
            rows={filteredInvoices}
            rowKey={(r) => r.id}
            initialPageSize={10}
            emptyTitle="No invoices found"
            emptyDescription="Adjust your filters or try a different search term."
          />
        </div>
        {readOnly && (
          <ChartCard title="Invoice status distribution" description="All invoices">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
                  {statusDistribution.map((entry, i) => (
                    <Cell key={entry.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
              {statusDistribution.map((s, i) => (
                <li key={s.name} className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  {s.name}
                  <span className="ml-auto text-foreground">{s.value}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        )}
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment · {target?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              {target?.customerName} · outstanding {target && inr(target.outstanding)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="amt">Amount (₹)</Label>
              <Input id="amt" value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Payment["mode"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref">Reference</Label>
              <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button disabled={!amount} onClick={() => target && pay.mutate({ id: target.id, amount: Number(amount) })}>
              Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

