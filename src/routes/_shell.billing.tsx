import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, CircleDollarSign, Receipt, TriangleAlert, Eye, FileText, RefreshCw, Printer } from "lucide-react";
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
import { inr, cum } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Payment["mode"]>("Bank Transfer");
  const [reference, setReference] = useState("");

  const { params, updateParams, query: invoices } = useListQuery(
    ["invoices-list"],
    () => invoicesApi.list().then((r) => r.data)
  );
  const summary = useQuery({ queryKey: ["invoice-summary"], queryFn: () => invoicesApi.summary().then((r) => r.data) });

  const syncInvoices = useMutation({
    mutationFn: () => invoicesApi.syncAll(),
    onSuccess: (res) => {
      toast.success(res.message || "Invoices synced across delivered trips");
      void qc.invalidateQueries({ queryKey: ["invoices-list"] });
      void qc.invalidateQueries({ queryKey: ["invoice-summary"] });
      void qc.invalidateQueries({ queryKey: ["account-invoices"] });
    },
    onError: () => toast.error("Could not sync invoices"),
  });

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
    { key: "inv", header: "Invoice #", cell: (r) => <span className="font-semibold text-primary">{r.invoiceNumber}</span>, sortValue: (r) => r.invoiceNumber },
    { key: "po", header: "PO Number", cell: (r) => <span className="font-mono text-xs font-medium">{r.poNumber || r.poId}</span>, sortValue: (r) => r.poNumber || r.poId },
    { key: "customer", header: "Customer", cell: (r) => <span className="font-medium">{r.customerName}</span>, sortValue: (r) => r.customerName },
    {
      key: "trips",
      header: "Trips / Volume",
      cell: (r) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground">{r.tripCount || r.lines?.length || 1} trips</span>
          <span className="text-[11px] text-muted-foreground">{r.totalQuantity ? cum(r.totalQuantity) : "Delivered"}</span>
        </div>
      ),
      sortValue: (r) => r.tripCount || 1,
    },
    { key: "issue", header: "Issue Date", cell: (r) => r.issueDate, sortValue: (r) => r.issueDate },
    { key: "due", header: "Due Date", cell: (r) => r.dueDate },
    {
      key: "amount",
      header: "Total Bill Amount",
      align: "right",
      cell: (r) => (
        <div className="text-right">
          <span className="font-bold text-foreground text-sm block">{inr(r.amount)}</span>
          <span className="text-[10px] text-muted-foreground block font-mono">Taxable: {inr(r.subtotal)}</span>
        </div>
      ),
      sortValue: (r) => r.amount,
    },
    { key: "paid", header: "Collected", align: "right", cell: (r) => <span className="tabular-nums text-emerald-500 font-medium">{inr(r.paid)}</span> },
    {
      key: "out",
      header: "Outstanding",
      align: "right",
      cell: (r) => (
        <span className={cn("font-semibold tabular-nums", r.outstanding > 0 ? "text-amber-400" : "text-emerald-400")}>
          {inr(r.outstanding)}
        </span>
      ),
      sortValue: (r) => r.outstanding,
    },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs px-2.5 hover:bg-surface-raised cursor-pointer"
            title="Inspect all trip line items and total bill breakdown"
            onClick={() => setSelectedInvoice(r)}
          >
            <Eye className="size-3.5 text-primary" /> Details
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs px-2 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Download Tax Invoice PDF"
            onClick={() => window.open(`/api/v1/invoices/${r.id}/pdf`, "_blank")}
          >
            <FileText className="size-3.5" /> PDF
          </Button>
          {!readOnly && r.outstanding > 0 && (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1 text-xs bg-primary font-semibold"
              onClick={() => {
                setTarget(r);
                setAmount(String(r.outstanding));
                setReference(`TXN-${Date.now().toString().slice(-6)}`);
              }}
            >
              Collect
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Invoices"
        subtitle="Customer tax invoices and collections generated against delivered concrete"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            disabled={syncInvoices.isPending}
            onClick={() => syncInvoices.mutate()}
          >
            <RefreshCw className={cn("size-3.5", syncInvoices.isPending && "animate-spin")} />
            <span>Sync Delivered Trips</span>
          </Button>
        }
      />

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

      {/* Invoice Details & Multi-Trip Breakdown Modal */}
      <Dialog open={selectedInvoice !== null} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Receipt className="size-5 text-primary" /> Tax Invoice {selectedInvoice?.invoiceNumber}
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  Customer: <span className="font-semibold text-foreground">{selectedInvoice?.customerName}</span> · PO: <span className="font-mono font-medium text-foreground">{selectedInvoice?.poNumber || selectedInvoice?.poId}</span>
                </DialogDescription>
              </div>
              {selectedInvoice && <StatusBadge status={selectedInvoice.status} />}
            </div>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 text-xs">
              {/* Meta details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-raised p-3 rounded-lg border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Issue Date</span>
                  <span className="font-medium text-foreground">{selectedInvoice.issueDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Due Date</span>
                  <span className="font-medium text-foreground">{selectedInvoice.dueDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Trips Included</span>
                  <span className="font-semibold text-primary">{selectedInvoice.lines?.length || selectedInvoice.tripCount || 1} Delivered Trips</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Volume</span>
                  <span className="font-semibold text-foreground">{selectedInvoice.totalQuantity ? cum(selectedInvoice.totalQuantity) : "—"}</span>
                </div>
              </div>

              {/* Line items (Delivered Trips) */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Delivered Concrete Trip Breakdown ({selectedInvoice.lines?.length || 1} Trips)
                </h4>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 text-left">Trip Number</th>
                        <th className="py-2 px-3 text-left">Challan Ref</th>
                        <th className="py-2 px-3 text-right">Delivered Qty</th>
                        <th className="py-2 px-3 text-right">Agreed Rate</th>
                        <th className="py-2 px-3 text-right">Trip Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {(selectedInvoice.lines && selectedInvoice.lines.length > 0) ? (
                        selectedInvoice.lines.map((line, idx) => (
                          <tr key={line.id || idx} className="hover:bg-muted/20">
                            <td className="py-2 px-3 font-semibold text-foreground">{line.tripNumber || `Trip #${idx + 1}`}</td>
                            <td className="py-2 px-3 font-mono text-muted-foreground">{line.challanNumber || "—"}</td>
                            <td className="py-2 px-3 text-right font-medium">{cum(line.quantity)}</td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{inr(line.rate)} / cum</td>
                            <td className="py-2 px-3 text-right font-semibold text-foreground">{inr(line.amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-2 px-3 font-semibold text-foreground">{selectedInvoice.poNumber || "Trip"}</td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">—</td>
                          <td className="py-2 px-3 text-right font-medium">{cum(selectedInvoice.totalQuantity || 8)}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">—</td>
                          <td className="py-2 px-3 text-right font-semibold text-foreground">{inr(selectedInvoice.subtotal)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax & Grand Total Summary */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Subtotal (Concrete Supply):</span>
                  <span className="font-semibold text-foreground">{inr(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">CGST @ 9%:</span>
                  <span className="font-medium text-foreground">{inr(selectedInvoice.gstAmount / 2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">SGST @ 9%:</span>
                  <span className="font-medium text-foreground">{inr(selectedInvoice.gstAmount / 2)}</span>
                </div>
                <div className="border-t border-primary/20 pt-2 flex justify-between items-center text-sm">
                  <span className="font-bold text-foreground">Grand Total Bill Amount:</span>
                  <span className="font-bold text-primary text-base">{inr(selectedInvoice.amount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-border/40">
                  <span className="text-emerald-400 font-medium">Collections / Paid:</span>
                  <span className="font-bold text-emerald-400">{inr(selectedInvoice.paid)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-400 font-medium">Net Outstanding Balance:</span>
                  <span className="font-bold text-amber-400">{inr(selectedInvoice.outstanding)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
            <Button
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => selectedInvoice && window.open(`/api/v1/invoices/${selectedInvoice.id}/pdf`, "_blank")}
            >
              <FileText className="size-3.5" /> Download Tax Invoice PDF
            </Button>
            <Button variant="default" onClick={() => setSelectedInvoice(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

