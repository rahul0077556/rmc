import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, CalendarClock, ClipboardList, Lock, PackageCheck, Truck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { ChartCard } from "@/components/app/chart-card";
import { StatusBadge } from "@/components/app/status-badge";
import { DataTable, type Column } from "@/components/app/data-table";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { dashboardApi, type OwnerDashboard } from "@/api/dashboard";
import { cum, inr, inrCompact, num } from "@/lib/format";
import { PLANT_NAME } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/owner")({
  head: () => ({
    meta: [
      { title: "Plant Overview · RMC Command Center" },
      { name: "description", content: "Owner view of plant orders, deliveries, fleet and collections." },
      { property: "og:title", content: "Plant Overview · RMC Command Center" },
      { property: "og:description", content: "Owner view of plant orders, deliveries, fleet and collections." },
    ],
  }),
  component: OwnerDashboardPage,
});

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const DONUT_COLORS = ["var(--warning)", "var(--info)", "var(--success)", "var(--muted-foreground)"];

type ScheduleRow = OwnerDashboard["dailySchedule"][number];

function OwnerDashboardPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-dashboard", days],
    queryFn: () => dashboardApi.owner(days).then((r) => r.data),
  });

  if (isLoading) return <LoadingState rows={6} />;
  if (error || !data) return <ErrorState message="Plant metrics could not be loaded." onRetry={() => void refetch()} />;

  const scheduleColumns: Column<ScheduleRow>[] = [
    { key: "time", header: "Time", cell: (r) => <span className="font-medium">{r.time}</span>, sortValue: (r) => r.time },
    { key: "customer", header: "Customer", cell: (r) => r.customer, sortValue: (r) => r.customer },
    { key: "po", header: "PO Number", cell: (r) => <span className="text-muted-foreground">{r.po}</span> },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.quantity), sortValue: (r) => r.quantity },
    { key: "tm", header: "TM", cell: (r) => r.tm },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  const maxTruck = Math.max(...data.truckUtilisation.map((t) => t.count), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plant Overview"
        subtitle={`${PLANT_NAME} · read-only owner view`}
        actions={
          <div className="flex rounded-lg border border-border bg-surface-raised p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  days === r.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total Orders" value={num(data.totalOrders.value)} change={data.totalOrders.change} comparison={`vs previous ${days} days`} icon={ClipboardList} spark={data.totalOrders.spark} />
        <KpiCard label="Pending Orders" value={num(data.pendingOrders.value)} change={data.pendingOrders.change} comparison="awaiting completion" icon={CalendarClock} spark={data.pendingOrders.spark} />
        <KpiCard label="Delivered Orders" value={num(data.deliveredOrders.value)} change={data.deliveredOrders.change} comparison={`vs previous ${days} days`} icon={PackageCheck} spark={data.deliveredOrders.spark} />
        <KpiCard label="Quantity Delivered" value={cum(data.quantityDelivered.value)} change={data.quantityDelivered.change} comparison="concrete supplied" icon={Truck} spark={data.quantityDelivered.spark} />
        <KpiCard label="Outstanding Payments" value={inrCompact(data.outstandingPayments.value)} change={data.outstandingPayments.change} comparison="receivable balance" icon={Banknote} spark={data.outstandingPayments.spark} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Orders per date" description="Order count and booked volume" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.ordersPerDate}>
              <defs>
                <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" width={28} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="orders" stroke="var(--primary)" strokeWidth={2} fill="url(#ordersFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Order status distribution" description="All purchase orders">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.statusDistribution} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
                {data.statusDistribution.map((entry, i) => (
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
            {data.statusDistribution.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                {s.name}
                <span className="ml-auto text-foreground">{s.value}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold">Today's delivery schedule</h2>
          <DataTable
            columns={scheduleColumns}
            rows={data.dailySchedule}
            rowKey={(r) => `${r.po}-${r.time}-${r.tm}`}
            emptyTitle="No trips scheduled today"
            emptyDescription="Planned trips for today will appear here as dispatch schedules them."
            initialPageSize={10}
          />
        </div>

        <div className="space-y-4">
          <ChartCard title="Payment status" description="Across all invoices">
            <ul className="space-y-3 text-sm">
              {[
                { label: "Invoiced", value: data.payments.invoiced, tone: "text-foreground" },
                { label: "Received", value: data.payments.received, tone: "text-success" },
                { label: "Outstanding", value: data.payments.outstanding, tone: "text-warning" },
                { label: "Overdue", value: data.payments.overdue, tone: "text-destructive" },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={cn("font-medium tabular-nums", row.tone)}>{inr(row.value)}</span>
                </li>
              ))}
            </ul>
          </ChartCard>

          <ChartCard title="Transit mixer utilisation" description="Fleet of 12 vehicles">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.truckUtilisation} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide domain={[0, maxTruck]} />
                <YAxis type="category" dataKey="status" width={86} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip
                  cursor={{ fill: "var(--surface-raised)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 4, 4]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Plant performance</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {data.performance.map((metric) => (
            <div key={metric.label} className="panel p-4">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums">{metric.value}%</p>
              <Progress value={metric.value} className="mt-3 h-1.5" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Coming soon</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "GPS Tracking", desc: "Live vehicle positions during transit." },
            { title: "Employee Attendance", desc: "Shift-wise plant workforce attendance." },
          ].map((card) => (
            <div key={card.title} className="panel flex items-center justify-between gap-4 p-4 opacity-55">
              <div>
                <p className="text-sm font-medium">{card.title}</p>
                <p className="text-xs text-muted-foreground">{card.desc}</p>
              </div>
              <Button variant="outline" size="sm" disabled>
                <Lock className="size-3.5" /> Coming soon
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
