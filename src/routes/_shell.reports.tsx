import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  Printer,
  Search,
  Building2,
  Truck,
  Users,
  FlaskConical,
  Warehouse,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ChevronRight,
  Filter
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ChartCard } from "@/components/app/chart-card";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/auth-context";
import {
  REPORTS,
  reportsApi,
  toCsv,
  getReportsForRole,
  type ReportDepartment,
  type ReportDefinition
} from "@/api/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/reports")({
  head: () => ({
    meta: [
      { title: "Plant Reports · RMC Command Center" },
      { name: "description", content: "Master operations, quality, material, HR and commercial reports with official Excel and CSV exports." },
    ],
  }),
  component: ReportsPage,
});

const DEPT_ICONS = {
  All: Layers,
  Store: Warehouse,
  Dispatch: Truck,
  HR: Users,
  "QA/QC": FlaskConical,
};

const DEPT_BADGE_COLORS: Record<string, string> = {
  Store: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Dispatch: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  HR: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "QA/QC": "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function ReportsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const isOwner = !role || role === "owner";

  // Scoped reports based on user role
  const accessibleReports = useMemo(() => {
    return getReportsForRole(role);
  }, [role]);

  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialId = urlParams?.get("id") || accessibleReports[0]?.id || "mpr-report";
  const initialDept = (urlParams?.get("dept") as ReportDepartment) || "All";

  const [activeDept, setActiveDept] = useState<ReportDepartment>(initialDept);
  const [activeId, setActiveId] = useState<string>(initialId);
  const [searchFilter, setSearchFilter] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [from, setFrom] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [downloading, setDownloading] = useState(false);

  // Sync activeId if user changes role or activeId is not authorized
  useEffect(() => {
    if (accessibleReports.length > 0 && !accessibleReports.some((r) => r.id === activeId)) {
      const first = accessibleReports[0];
      if (first) setActiveId(first.id);
    }
  }, [accessibleReports, activeId]);

  // Sync if query param changes in URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const queryId = p.get("id");
      const queryDept = p.get("dept") as ReportDepartment | null;
      if (queryId && accessibleReports.some((r) => r.id === queryId)) {
        setActiveId(queryId);
      }
      if (queryDept && isOwner) {
        setActiveDept(queryDept);
      }
    }
  }, [accessibleReports, isOwner]);

  const filteredReports = useMemo(() => {
    return accessibleReports.filter((r) => {
      const matchDept =
        !isOwner || activeDept === "All" || r.departments.includes(activeDept as any);
      const matchSearch =
        searchFilter.trim() === "" ||
        r.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.description.toLowerCase().includes(searchFilter.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [accessibleReports, isOwner, activeDept, searchFilter]);

  const activeReport: ReportDefinition =
    accessibleReports.find((r) => r.id === activeId) ??
    filteredReports[0] ??
    accessibleReports[0] ??
    REPORTS[0]!;

  const pageMeta = useMemo(() => {
    if (role === "store") {
      return {
        title: "Store & Inventory Reports",
        subtitle: "Official Material Purchase & Requisition (MPR), driver diesel averages and transit mixer logs",
      };
    }
    if (role === "dispatcher") {
      return {
        title: "Dispatch & Fleet Operations Reports",
        subtitle: "Plant batching schedules, Zone 02 pump utilization, and daily production reports",
      };
    }
    if (role === "qa") {
      return {
        title: "Quality Assurance & Batching Reports",
        subtitle: "IS 456 compressive cube strength tests, plant consumption logs, and material rejections",
      };
    }
    if (role === "account") {
      return {
        title: "HR & Attendance Reports",
        subtitle: "Staff muster roll, Sunday & statutory duty logs, and driver attendance performance",
      };
    }
    if (role === "production") {
      return {
        title: "Production & Batching Reports",
        subtitle: "Daily batching schedules, plant material consumption logs, and grade production summaries",
      };
    }
    if (role === "sales" || role === "sales_manager") {
      return {
        title: "Sales & Delivery Fulfillment Reports",
        subtitle: "Customer order schedules, day-wise production breakdown, and concrete pump utilization",
      };
    }
    return {
      title: "Plant Operations & Master Reports",
      subtitle: "Official Ready-Mix Concrete Plant Reports organized by Department & Executive Hub",
    };
  }, [role]);

  const reportQuery = useQuery({
    queryKey: ["report", activeReport.id, from, to],
    queryFn: () => reportsApi.run(activeReport.id, from, to).then((r) => r.data),
    enabled: Boolean(activeReport),
  });

  const filteredRows = useMemo(() => {
    if (!reportQuery.data?.rows) return [];
    if (!tableSearch.trim()) return reportQuery.data.rows;
    const lower = tableSearch.toLowerCase();
    return reportQuery.data.rows.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(lower))
    );
  }, [reportQuery.data?.rows, tableSearch]);

  async function handleExportExcel() {
    if (!activeReport) return;
    setDownloading(true);
    try {
      await reportsApi.downloadExcel(
        activeReport.id,
        from,
        to,
        `${activeReport.backendKey}_${from}_${to}`
      );
      toast.success("Excel report exported successfully!");
    } catch {
      toast.error("Failed to download Excel file. Please try CSV.");
    } finally {
      setDownloading(false);
    }
  }

  function handleExportCsv() {
    if (!reportQuery.data || !activeReport) return;
    const blob = new Blob([toCsv(reportQuery.data)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReport.backendKey}_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV file downloaded successfully!");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={pageMeta.title}
        subtitle={pageMeta.subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              disabled={!reportQuery.data || downloading}
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            >
              <FileSpreadsheet className="size-4 mr-1.5" />
              {downloading ? "Generating Excel..." : "Export Excel (.xlsx)"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={!reportQuery.data}
            >
              <Download className="size-4 mr-1.5" />
              Export CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              <Printer className="size-4" />
            </Button>
          </div>
        }
      />

      {/* Department Tabs (Owner Only) or Role Department Scope Indicator */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface p-1">
            {(["All", "Store", "Dispatch", "HR", "QA/QC"] as ReportDepartment[]).map((dept) => {
              const Icon = DEPT_ICONS[dept];
              const count =
                dept === "All"
                  ? REPORTS.length
                  : REPORTS.filter((r) => r.departments.includes(dept as any)).length;
              const isSelected = activeDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setActiveDept(dept)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{dept === "All" ? "All Reports" : dept}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="size-4" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                {role?.replace(/_/g, " ")} Reports Access
              </span>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                {accessibleReports.length} Authorized Logs
              </Badge>
            </div>
          </div>
        )}

        {/* Search Reports */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search report name..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Reports Grid Cards */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredReports.map((r) => {
          const isSelected = r.id === activeReport.id;
          const DeptIcon = DEPT_ICONS[r.department] || Layers;
          return (
            <button
              key={r.id}
              onClick={() => {
                setActiveId(r.id);
                if (typeof window !== "undefined") {
                  const p = new URLSearchParams(window.location.search);
                  p.set("id", r.id);
                  if (activeDept !== "All") p.set("dept", activeDept);
                  window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
                }
              }}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/10 shadow-md shadow-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-surface hover:border-primary/50 hover:bg-surface-raised"
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      DEPT_BADGE_COLORS[r.department] || "bg-muted text-muted-foreground"
                    )}
                  >
                    <DeptIcon className="size-3" />
                    {r.department}
                  </span>
                  {isSelected && (
                    <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                <p className="mt-2 text-xs font-semibold tracking-tight text-foreground line-clamp-1">
                  {r.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {r.description}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] font-medium text-muted-foreground group-hover:text-primary">
                <span>View Full Log</span>
                <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Report Sheet Preview */}
      {activeReport && (
        <ChartCard
          title={activeReport.title}
          description={activeReport.description}
          actions={
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  DEPT_BADGE_COLORS[activeReport.department]
                )}
              >
                Department: {activeReport.departments.join(" & ")}
              </span>
            </div>
          }
        >
          {/* Controls: Date Pickers & Table In-Memory Search */}
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From Date</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To Date</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs font-medium"
                onClick={() => void reportQuery.refetch()}
              >
                Apply Range
              </Button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter rows in active report..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {reportQuery.data && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-surface-raised/40 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Entries
                </p>
                <p className="text-base font-bold text-foreground">
                  {reportQuery.data.rows.length} rows
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface-raised/40 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Report Format
                </p>
                <p className="text-base font-bold text-primary">
                  IS / Plant Standard
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface-raised/40 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Plant Location
                </p>
                <p className="text-base font-bold text-foreground">Mulkhed Plant</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-raised/40 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Compliance Status
                </p>
                <p className="text-base font-bold text-emerald-400">Verified & Signed</p>
              </div>
            </div>
          )}

          {/* Table Content */}
          {reportQuery.isLoading && <LoadingState rows={5} />}
          {reportQuery.error && (
            <ErrorState
              message="Failed to load report data from the backend server."
              onRetry={() => void reportQuery.refetch()}
            />
          )}

          {reportQuery.data && (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[750px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/70 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="w-12 px-3 py-2.5 text-center">#</th>
                    {reportQuery.data.columns.map((c) => (
                      <th
                        key={c}
                        className="px-3 py-2.5 text-left whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="transition-colors hover:bg-surface-raised/50"
                    >
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {rIdx + 1}
                      </td>
                      {row.map((cell, cIdx) => {
                        const str = String(cell ?? "");
                        const isPass = str === "PASS" || str === "ADEQUATE" || str === "CALIBRATION OK";
                        const isFail = str === "FAIL" || str.includes("REORDER") || str.includes("REJECTED");
                        const isStatus = str === "DELIVERED" || str === "PRESENT" || str === "IN_TRANSIT";

                        return (
                          <td
                            key={cIdx}
                            className="px-3 py-2 whitespace-nowrap"
                          >
                            {isPass ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                                {str}
                              </Badge>
                            ) : isFail ? (
                              <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px]">
                                {str}
                              </Badge>
                            ) : isStatus ? (
                              <Badge variant="outline" className="text-[10px]">
                                {str}
                              </Badge>
                            ) : (
                              str
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredRows.length === 0 && (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No records match your filter criteria.
                </div>
              )}
            </div>
          )}
        </ChartCard>
      )}
    </div>
  );
}
