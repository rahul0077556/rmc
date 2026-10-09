import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Banknote, Calendar, BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { FilterBar } from "@/components/app/filter-bar";
import { useListQuery } from "@/hooks/use-list-query";
import { accountApi, type Employee, type PayrollRun } from "@/api/account";
import { inr, dt } from "@/lib/format";

export const Route = createFileRoute("/_shell/account")({
  head: () => ({
    meta: [
      { title: "HR & Accounts · RMC Command Center" },
      { name: "description", content: "Manage employees, payroll, and attendance." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { params, updateParams, query: employees } = useListQuery(["employees"], () => accountApi.employees().then((r) => r.data));
  const payroll = useQuery({ queryKey: ["payroll"], queryFn: () => accountApi.payroll().then((r) => r.data) });
  const summary = useQuery({ queryKey: ["account-summary"], queryFn: () => accountApi.summary().then((r) => r.data) });

  const filteredEmployees = useMemo(() => {
    if (!employees.data) return [];
    let list = employees.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i: Employee) => i.name.toLowerCase().includes(lower) || i.department.toLowerCase().includes(lower) || i.role.toLowerCase().includes(lower) || i.id.toLowerCase().includes(lower));
    }
    return list;
  }, [employees.data, params]);

  if (employees.isLoading || payroll.isLoading || summary.isLoading) return <LoadingState rows={6} />;
  if (employees.error || !employees.data || payroll.error || !payroll.data || summary.error || !summary.data) 
    return <ErrorState message="Account data could not be loaded." onRetry={() => void employees.refetch()} />;

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

  return (
    <div className="space-y-6">
      <PageHeader title="HR & Payroll" subtitle="Employee directory and payroll processing" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Employees" value={String(summary.data.activeEmployees)} icon={Users} />
        <KpiCard label="Monthly Payroll" value={inr(summary.data.monthlyPayroll)} icon={Banknote} comparison="est. this month" />
        <KpiCard label="Next Payday" value={summary.data.nextPayday} icon={Calendar} />
        <KpiCard label="Last Payroll" value={payroll.data[0]?.status === "PAID" ? "Completed" : "Pending"} icon={BadgeCheck} comparison={payroll.data[0]?.period} />
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
          rows={payroll.data}
          rowKey={(r) => r.id}
          emptyTitle="No payroll runs found"
          emptyDescription="Payroll history will appear here."
        />
      </section>
    </div>
  );
}
