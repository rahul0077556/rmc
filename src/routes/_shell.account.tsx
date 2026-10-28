import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Banknote,
  Calendar,
  BadgeCheck,
  Receipt,
  CircleDollarSign,
  TriangleAlert,
  CreditCard,
  Building2,
  FileText
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { FilterBar } from "@/components/app/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useListQuery } from "@/hooks/use-list-query";
import { accountApi, type Employee, type PayrollRun } from "@/api/account";
import { invoicesApi, type InvoiceRow } from "@/api/invoices";
import { inr, dt, cum } from "@/lib/format";
import { useAuth } from "@/auth/auth-context";
import { cn } from "@/lib/utils";
import type { Payment } from "@/types";

export const Route = createFileRoute("/_shell/account")({
  head: () => ({
    meta: [
      { title: "Accounts & Finance · RMC Command Center" },
      { name: "description", content: "Customer billing, invoices, collections, HR payroll, and employee ledger." },
    ],
  }),
  component: AccountPage,
});

const MODES: Payment["mode"][] = ["Bank Transfer", "Cheque", "Cash", "UPI", "Other"];

function AccountPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const readOnly = user?.role === "owner";

  // Section Tab: Billing & Invoices vs HR & Payroll
  const [activeSection, setActiveSection] = useState<"billing" | "payroll">("billing");

  // Invoices & Payment States
  const [targetInvoice, setTargetInvoice] = useState<InvoiceRow | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Payment["mode"]>("Bank Transfer");
  const [reference, setReference] = useState("");

  const { params, updateParams, query: employees } = useListQuery(["employees"], () => accountApi.employees().then((r) => r.data));
  const payroll = useQuery({ queryKey: ["payroll"], queryFn: () => accountApi.payroll().then((r) => r.data) });
  const summary = useQuery({ queryKey: ["account-summary"], queryFn: () => accountApi.summary().then((r) => r.data) });

  const invoices = useQuery({ queryKey: ["account-invoices"], queryFn: () => invoicesApi.list().then((r) => r.data) });
  const invoiceSummary = useQuery({ queryKey: ["account-inv-summary"], queryFn: () => invoicesApi.summary().then((r) => r.data) });

  const pay = useMutation({
    mutationFn: (input: { id: string; amount: number }) =>
      invoicesApi.recordPayment(
        input.id,
        { amount: input.amount, paidDate: new Date().toISOString().slice(0, 10), mode, reference },
        user?.name ?? "Accountant"
      ),
    onSuccess: () => {
      toast.success("Customer payment recorded successfully");
      setTargetInvoice(null);
      setAmount("");
      setReference("");
      void qc.invalidateQueries({ queryKey: ["account-invoices"] });
      void qc.invalidateQueries({ queryKey: ["account-inv-summary"] });
      void qc.invalidateQueries({ queryKey: ["invoices-list"] });
    },
    onError: () => toast.error("Payment could not be recorded"),
  });

  const filteredEmployees = useMemo(() => {
    if (!employees.data) return [];
    let list = employees.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i: Employee) =>
        i.name.toLowerCase().includes(lower) ||
        i.department.toLowerCase().includes(lower) ||
        i.role.toLowerCase().includes(lower) ||
        i.id.toLowerCase().includes(lower)
      );
    }
    return list;
  }, [employees.data, params]);

  const filteredInvoices = useMemo(() => {
    if (!invoices.data) return [];
    let list = invoices.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i) =>
        i.invoiceNumber.toLowerCase().includes(lower) ||
        i.customerName.toLowerCase().includes(lower)
      );
    }
    return list;
  }, [invoices.data, params]);

  if (employees.isLoading || payroll.isLoading || summary.isLoading || invoices.isLoading) {
    return <LoadingState rows={6} />;
  }

  const empColumns: Column<Employee>[] = [
    { key: "id", header: "Emp ID", cell: (r) => <span className="font-medium">{r.id}</span> },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "dept", header: "Department", cell: (r) => r.department },
    { key: "role", header: "Role", cell: (r) => r.role },
    { key: "join", header: "Join Date", cell: (r) => r.joinDate },
    { key: "salary", header: "Base Salary", align: "right", cell: (r) => inr(r.baseSalary) },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  const payrollColumns: Column<PayrollRun>[] = [
    { key: "id", header: "Run ID", cell: (r) => <span className="font-medium">{r.id}</span> },
    { key: "period", header: "Period", cell: (r) => r.period },
    { key: "emps", header: "Total Employees", align: "right", cell: (r) => r.totalEmployees },
    { key: "amount", header: "Total Amount", align: "right", cell: (r) => inr(r.totalAmount) },
    { key: "processed", header: "Processed On", cell: (r) => r.processedDate ? dt(r.processedDate) : "—" },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  const invoiceColumns: Column<InvoiceRow>[] = [
    { key: "inv", header: "Invoice #", cell: (r) => <span className="font-semibold text-primary">{r.invoiceNumber}</span> },
    { key: "po", header: "PO Number", cell: (r) => <span className="font-mono text-xs font-medium">{r.poNumber || r.poId}</span> },
    { key: "customer", header: "Customer", cell: (r) => <span className="font-medium">{r.customerName}</span> },
    {
      key: "trips",
      header: "Trips / Volume",
      cell: (r) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground">{r.tripCount || r.lines?.length || 1} trips</span>
          <span className="text-[11px] text-muted-foreground">{r.totalQuantity ? cum(r.totalQuantity) : "Delivered"}</span>
        </div>
      ),
    },
    { key: "issue", header: "Issue Date", cell: (r) => r.issueDate },
    { key: "due", header: "Due Date", cell: (r) => r.dueDate },
    { key: "total", header: "Total Amount", align: "right", cell: (r) => <span className="tabular-nums font-semibold">{inr(r.amount)}</span> },
    { key: "paid", header: "Collected", align: "right", cell: (r) => <span className="tabular-nums text-emerald-500 font-medium">{inr(r.paid)}</span> },
    {
      key: "balance",
      header: "Outstanding",
      align: "right",
      cell: (r) => (
        <span className={cn("tabular-nums font-semibold", r.outstanding > 0 ? "text-amber-400" : "text-muted-foreground")}>
          {inr(r.outstanding)}
        </span>
      ),
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
            variant="ghost"
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            onClick={() => window.open(`/api/v1/invoices/${r.id}/pdf`, "_blank")}
            title="Download Tax Invoice PDF"
          >
            <FileText className="size-3" /> PDF
          </Button>
          {!readOnly && r.outstanding > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs h-7"
              onClick={() => {
                setTargetInvoice(r);
                setAmount(String(r.outstanding));
                setReference(`TXN-${Date.now().toString().slice(-6)}`);
              }}
            >
              <CreditCard className="size-3" /> Record Payment
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Accounts & Finance Desk"
          subtitle="Manage customer receivables, invoices, employee records and payroll processing"
        />

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border/70 max-w-fit">
          <button
            type="button"
            onClick={() => setActiveSection("billing")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeSection === "billing"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Receipt className="size-3.5" /> Customer Billing & Invoices
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("payroll")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeSection === "payroll"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-3.5" /> HR & Staff Payroll
          </button>
        </div>
      </div>

      {activeSection === "billing" ? (
        <div className="space-y-6">
          {/* Billing KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total Invoiced"
              value={inr(invoiceSummary.data?.invoiced ?? 0)}
              icon={Receipt}
              comparison="All delivered concrete"
            />
            <KpiCard
              label="Collections Realized"
              value={inr(invoiceSummary.data?.received ?? 0)}
              icon={CircleDollarSign}
              comparison="Total received payments"
            />
            <KpiCard
              label="Outstanding Receivables"
              value={inr(invoiceSummary.data?.outstanding ?? 0)}
              icon={Banknote}
              comparison="Customer balance due"
            />
            <KpiCard
              label="Overdue Invoices"
              value={inr(invoiceSummary.data?.overdue ?? 0)}
              icon={TriangleAlert}
              comparison="Exceeded credit terms"
            />
          </div>

          <FilterBar
            search={params.q}
            onSearchChange={(q) => updateParams({ q })}
            searchPlaceholder="Search invoices by invoice number or customer..."
          />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Customer Tax Invoices</h2>
              <span className="text-xs text-muted-foreground">{filteredInvoices.length} invoices found</span>
            </div>
            <DataTable
              columns={invoiceColumns}
              rows={filteredInvoices}
              rowKey={(r) => r.id}
              emptyTitle="No invoices found"
              emptyDescription="Invoices generated for delivered trips will appear here."
            />
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Payroll KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Active Employees" value={String(summary.data?.activeEmployees ?? 0)} icon={Users} />
            <KpiCard label="Monthly Payroll" value={inr(summary.data?.monthlyPayroll ?? 0)} icon={Banknote} comparison="est. this month" />
            <KpiCard label="Next Payday" value={summary.data?.nextPayday ?? "End of Month"} icon={Calendar} />
            <KpiCard label="Last Payroll" value={payroll.data?.[0]?.status === "PAID" ? "Completed" : "Pending"} icon={BadgeCheck} comparison={payroll.data?.[0]?.period} />
          </div>

          <FilterBar
            search={params.q}
            onSearchChange={(q) => updateParams({ q })}
            searchPlaceholder="Search employees by name, ID, or department..."
          />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Employee Directory</h2>
            <DataTable
              columns={empColumns}
              rows={filteredEmployees}
              rowKey={(r) => r.id}
              emptyTitle="No employees found"
              emptyDescription="Employee records will appear here."
            />
          </section>

          <section className="space-y-3 pt-4 border-t border-border/50">
            <h2 className="text-sm font-semibold">Recent Payroll Runs</h2>
            <DataTable
              columns={payrollColumns}
              rows={payroll.data ?? []}
              rowKey={(r) => r.id}
              emptyTitle="No payroll runs found"
              emptyDescription="Payroll history will appear here."
            />
          </section>
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={targetInvoice !== null} onOpenChange={(open) => !open && setTargetInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Customer Payment</DialogTitle>
            <DialogDescription>
              {targetInvoice?.invoiceNumber} · {targetInvoice?.customerName} · Outstanding: {targetInvoice && inr(targetInvoice.outstanding)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amt">Payment Amount (₹)</Label>
              <Input
                id="pay-amt"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Enter amount in ₹"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-mode">Payment Mode</Label>
              <Select value={mode} onValueChange={(val: any) => setMode(val)}>
                <SelectTrigger id="pay-mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Transaction Reference / UTR Number</Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. UTR / NEFT reference number"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTargetInvoice(null)}>
              Cancel
            </Button>
            <Button
              disabled={!amount || Number(amount) <= 0 || pay.isPending}
              onClick={() => targetInvoice && pay.mutate({ id: targetInvoice.id, amount: Number(amount) })}
            >
              {pay.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
