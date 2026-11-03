import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PackageSearch,
  Truck,
  AlertTriangle,
  Box,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Save,
  Building2,
  Settings,
  Fuel,
  Receipt,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  GitFork,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Search,
  Scale,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { MaterialFlowDiagram } from "@/components/common/MaterialFlowDiagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/app/filter-bar";
import { useListQuery } from "@/hooks/use-list-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  storeApi,
  type InventoryItem,
  type WeighbridgeTicket,
  type TransitMixerPayload,
  type DprRecord,
  type ExpenseRecord,
  type AttendanceRecord,
  type StockTransactionItem,
} from "@/api/store";
import { useAuth } from "@/auth/auth-context";
import { inr, dt, num } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/store")({
  head: () => ({
    meta: [
      { title: "Store & Inventory Operations · RMC Command Center" },
      { name: "description", content: "End-to-end material inventory, manual gate inward receipts, batching consumption tracking and flow." },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { user } = useAuth();
  const readOnly = user?.role === "owner";
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"inventory" | "inward-register" | "consumption" | "material-flow" | "payloads" | "dpr" | "expenses" | "attendance">("inventory");

  // Queries
  const { params, updateParams, query: inventory } = useListQuery(["inventory"], () => storeApi.inventory().then((r) => r.data));
  const weighbridge = useQuery({ queryKey: ["weighbridge"], queryFn: () => storeApi.weighbridge().then((r) => r.data) });
  const transactions = useQuery({ queryKey: ["stock-transactions"], queryFn: () => storeApi.transactions().then((r) => r.data) });
  const payloads = useQuery({ queryKey: ["payload-details"], queryFn: () => storeApi.payloadDetails().then((r) => r.data) });
  const dpr = useQuery({ queryKey: ["dpr-reports"], queryFn: () => storeApi.dprReports().then((r) => r.data) });
  const expenses = useQuery({ queryKey: ["store-expenses"], queryFn: () => storeApi.expenses().then((r) => r.data) });
  const attendance = useQuery({ queryKey: ["store-attendance"], queryFn: () => storeApi.attendance().then((r) => r.data) });

  // Inward Entry Modal State
  const [inwardOpen, setInwardOpen] = useState(false);
  const [selectedMaterialName, setSelectedMaterialName] = useState("Cement (OPC 53)");
  const [supplierName, setSupplierName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [grossWeight, setGrossWeight] = useState<number>(0);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [directNetWeight, setDirectNetWeight] = useState<number>(0);
  const [weightMode, setWeightMode] = useState<"tare_gross" | "direct">("tare_gross");
  const [storageLocation, setStorageLocation] = useState("Cement Silo #1");
  const [driverName, setDriverName] = useState("");
  const [watchmanName, setWatchmanName] = useState("Ganesh Shinde (Gate Security)");
  const [remarks, setRemarks] = useState("");

  // Printable Gate Pass Slip State
  const [printedSlip, setPrintedSlip] = useState<WeighbridgeTicket | null>(null);

  // Auto-calculated Net Weight
  const calculatedNetWeight = useMemo(() => {
    if (weightMode === "direct") return Number(directNetWeight) || 0;
    return Math.max(0, (Number(grossWeight) || 0) - (Number(tareWeight) || 0));
  }, [weightMode, directNetWeight, grossWeight, tareWeight]);

  // Mutation: Save Inward Entry
  const saveInwardMutation = useMutation({
    mutationFn: () => {
      const net = calculatedNetWeight;
      return storeApi.saveWeighbridgeEntry({
        wbName: "Plant Gate Scale #1",
        ticketNumber: `WB-${Date.now().toString().slice(-6)}`,
        type: "INWARD",
        vehicleNumber: vehicleNo.trim().toUpperCase() || "MH-12-INWARD",
        partyName: supplierName.trim() || "Approved Material Vendor",
        product: selectedMaterialName,
        grossWeight: weightMode === "tare_gross" ? Number(grossWeight) : net,
        tareWeight: weightMode === "tare_gross" ? Number(tareWeight) : 0,
        grossDate: new Date().toISOString(),
        tareDate: new Date().toISOString(),
        driverName: driverName.trim() || "Driver",
        watchmanName: watchmanName.trim(),
      });
    },
    onSuccess: (res) => {
      const { ticket, updatedStock } = res.data;
      toast.success(
        `Inward Gate Pass ${ticket.ticketNumber} recorded! Live stock of ${ticket.material} updated to ${num(updatedStock?.currentStock ?? 0)} ${updatedStock?.unit ?? "kg"}.`
      );

      setPrintedSlip(ticket);
      setInwardOpen(false);
      resetInwardForm();

      void qc.invalidateQueries({ queryKey: ["inventory"] });
      void qc.invalidateQueries({ queryKey: ["weighbridge"] });
      void qc.invalidateQueries({ queryKey: ["stock-transactions"] });
    },
    onError: () => toast.error("Failed to record inward material entry. Please check values."),
  });

  function resetInwardForm() {
    setSupplierName("");
    setVehicleNo("");
    setChallanNo("");
    setGrossWeight(0);
    setTareWeight(0);
    setDirectNetWeight(0);
    setDriverName("");
    setRemarks("");
  }

  function handleOpenInwardFor(materialName: string, silo: string) {
    setSelectedMaterialName(materialName);
    setStorageLocation(silo);
    setInwardOpen(true);
  }

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    if (!inventory.data) return [];
    let list = inventory.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i: InventoryItem) => i.material.toLowerCase().includes(lower) || i.category.toLowerCase().includes(lower));
    }
    return list;
  }, [inventory.data, params]);

  // Filtered Inward Receipts
  const inwardTickets = useMemo(() => {
    if (!weighbridge.data) return [];
    return weighbridge.data.filter((t: WeighbridgeTicket) => t.type === "INWARD");
  }, [weighbridge.data]);

  // Consumption Transactions (OUT)
  const consumptionLogs = useMemo(() => {
    if (!transactions.data) return [];
    return transactions.data.filter((t: StockTransactionItem) => t.type === "OUT");
  }, [transactions.data]);

  // Compute Total Plant Stock
  const totalStockKg = useMemo(() => {
    if (!inventory.data) return 0;
    return inventory.data.reduce((acc: number, item: InventoryItem) => {
      return acc + (item.unit === "kg" ? item.currentStock : item.currentStock * 1);
    }, 0);
  }, [inventory.data]);

  const totalInwardKg = useMemo(() => {
    if (!inventory.data) return 0;
    return inventory.data.reduce((acc: number, item: InventoryItem) => acc + (item.totalInward || 0), 0);
  }, [inventory.data]);

  const totalConsumedKg = useMemo(() => {
    if (!inventory.data) return 0;
    return inventory.data.reduce((acc: number, item: InventoryItem) => acc + (item.totalConsumed || 0), 0);
  }, [inventory.data]);

  if (inventory.isLoading) return <LoadingState rows={5} />;
  if (inventory.error || !inventory.data)
    return <ErrorState message="Store inventory could not be loaded." onRetry={() => void inventory.refetch()} />;

  // Columns for Inventory Table
  const inventoryColumns: Column<InventoryItem>[] = [
    {
      key: "material",
      header: "Material & Category",
      cell: (r) => (
        <div>
          <span className="font-semibold text-foreground text-xs sm:text-sm">{r.material}</span>
          <span className="block text-[11px] text-muted-foreground">{r.siloName || "Storage Bay"}</span>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Current Available",
      align: "right",
      cell: (r) => {
        const isCritical = r.currentStock <= r.reorderLevel * 0.5;
        const isLow = r.currentStock <= r.reorderLevel;
        return (
          <div className="text-right">
            <span className={cn("tabular-nums font-bold text-sm", isCritical ? "text-destructive" : isLow ? "text-amber-500" : "text-emerald-500")}>
              {num(r.currentStock)} {r.unit}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {((r.currentStock / r.capacity) * 100).toFixed(0)}% Capacity
            </span>
          </div>
        );
      },
      sortValue: (r) => r.currentStock,
    },
    {
      key: "inward",
      header: "Total Inward",
      align: "right",
      cell: (r) => (
        <span className="font-mono text-xs text-sky-400">
          +{num(r.totalInward || 0)} {r.unit}
        </span>
      ),
      sortValue: (r) => r.totalInward || 0,
    },
    {
      key: "consumed",
      header: "Total Consumed",
      align: "right",
      cell: (r) => (
        <span className="font-mono text-xs text-rose-400">
          -{num(r.totalConsumed || 0)} {r.unit}
        </span>
      ),
      sortValue: (r) => r.totalConsumed || 0,
    },
    {
      key: "reorder",
      header: "Reorder Threshold",
      align: "right",
      cell: (r) => `${num(r.reorderLevel)} ${r.unit}`,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => {
        const status = r.status || (r.currentStock <= r.reorderLevel ? "LOW" : "HEALTHY");
        return (
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border",
              status === "HEALTHY"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : status === "LOW"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
            )}
          >
            {status}
          </span>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      align: "center",
      cell: (r) => (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => handleOpenInwardFor(r.material, r.siloName || "Silo")}
        >
          <Plus className="size-3 mr-1" />
          Add Inward
        </Button>
      ),
    },
  ];

  // Columns for Inward Gate Receipts
  const inwardColumns: Column<WeighbridgeTicket>[] = [
    {
      key: "ticket",
      header: "Gate Pass / Ticket",
      cell: (r) => (
        <div>
          <span className="font-mono font-bold text-foreground">{r.gatePassNo || r.ticketNumber}</span>
          <span className="block text-[11px] text-muted-foreground">{r.ticketNumber}</span>
        </div>
      ),
    },
    {
      key: "material",
      header: "Material Received",
      cell: (r) => <span className="font-semibold text-primary">{r.material}</span>,
    },
    {
      key: "supplier",
      header: "Supplier / Vendor",
      cell: (r) => r.supplierOrCustomer || "Direct Vendor",
    },
    {
      key: "vehicle",
      header: "Vehicle No.",
      cell: (r) => <span className="font-mono text-xs font-semibold">{r.vehicleNumber}</span>,
    },
    {
      key: "net",
      header: "Net Weight",
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-emerald-400">
          +{num(r.netWeight)} kg
        </span>
      ),
      sortValue: (r) => r.netWeight,
    },
    {
      key: "weights",
      header: "Gross / Tare",
      align: "right",
      cell: (r) => (
        <span className="text-[11px] text-muted-foreground font-mono">
          {num(r.grossWeight)} / {num(r.tareWeight)}
        </span>
      ),
    },
    {
      key: "time",
      header: "Receipt Date & Time",
      align: "right",
      cell: (r) => dt(r.grossTime),
    },
    {
      key: "slip",
      header: "Gate Slip",
      align: "center",
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
          onClick={() => setPrintedSlip(r)}
        >
          <Printer className="size-3.5 mr-1" />
          Print
        </Button>
      ),
    },
  ];

  // Columns for Material Consumption Tracking (OUT transactions)
  const consumptionColumns: Column<StockTransactionItem>[] = [
    {
      key: "time",
      header: "Date & Time",
      cell: (r) => dt(r.createdAt),
      sortValue: (r) => r.createdAt,
    },
    {
      key: "material",
      header: "Material",
      cell: (r) => <span className="font-semibold text-foreground">{r.materialName}</span>,
    },
    {
      key: "qty",
      header: "Quantity Deducted",
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-rose-400">
          -{num(r.quantity)} {r.unit}
        </span>
      ),
      sortValue: (r) => r.quantity,
    },
    {
      key: "ref",
      header: "Batch Sheet",
      cell: (r) => <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">{r.reference}</span>,
    },
    {
      key: "note",
      header: "Where Used (Trip, PO & Site Details)",
      cell: (r) => (
        <span className="text-xs text-muted-foreground font-medium">
          {r.note || "Production Batching Weighment"}
        </span>
      ),
    },
    {
      key: "by",
      header: "Logged By",
      align: "center",
      cell: (r) => <span className="text-[11px] text-slate-400">{r.createdBy}</span>,
    },
  ];

  // DPR Table Columns
  const dprColumns: Column<DprRecord>[] = [
    { key: "date", header: "Date", cell: (r) => <span className="font-semibold">{r.date}</span> },
    { key: "batches", header: "Batches", align: "right", cell: (r) => r.totalBatches },
    { key: "cum", header: "Total Vol (Cum)", align: "right", cell: (r) => <span className="font-bold text-foreground">{r.totalCum} m³</span> },
    { key: "cement", header: "Cement (MT)", align: "right", cell: (r) => num(r.cementConsumedMt) },
    { key: "flyash", header: "Fly Ash (MT)", align: "right", cell: (r) => num(r.flyAshConsumedMt) },
    { key: "ggbs", header: "GGBS (MT)", align: "right", cell: (r) => num(r.ggbsConsumedMt) },
    { key: "sand", header: "Sand (MT)", align: "right", cell: (r) => num(r.sandConsumedMt) },
    { key: "agg", header: "Aggregates (MT)", align: "right", cell: (r) => num(r.aggregateConsumedMt) },
    { key: "water", header: "Water (kL)", align: "right", cell: (r) => num(r.waterConsumedKl) },
    { key: "diesel", header: "Diesel (L)", align: "right", cell: (r) => <span className="text-amber-400 font-semibold">{r.dieselConsumedLtr} L</span> },
  ];

  // Expense Table Columns
  const expenseColumns: Column<ExpenseRecord>[] = [
    { key: "bill", header: "Bill No.", cell: (r) => <span className="font-mono font-medium">{r.billNo}</span> },
    { key: "cat", header: "Category", cell: (r) => <span className="px-2 py-0.5 rounded text-xs bg-muted font-medium">{r.category}</span> },
    { key: "vendor", header: "Vendor / Supplier", cell: (r) => r.vendor },
    { key: "desc", header: "Particulars", cell: (r) => <span className="text-muted-foreground text-xs">{r.description}</span> },
    { key: "date", header: "Date", cell: (r) => r.date },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="font-bold text-foreground">{inr(r.amount)}</span> },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status === "PAID" ? "APPROVED" : "IN_PROGRESS"} /> },
  ];

  // Attendance Columns
  const attColumns: Column<AttendanceRecord>[] = [
    { key: "name", header: "Staff / Driver Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <span className="text-xs px-2 py-0.5 rounded bg-muted">{r.type}</span> },
    { key: "role", header: "Designation / TM", cell: (r) => r.designationOrVehicle },
    { key: "shift", header: "Shift", cell: (r) => r.shift },
    { key: "source", header: "Source", cell: (r) => <span className="font-mono text-xs text-blue-400">{r.syncSource}</span> },
    { key: "trips", header: "Trips Completed", align: "right", cell: (r) => r.tripsOrTasks },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status === "PRESENT" || r.status === "ON_TRIP" ? "APPROVED" : "REJECTED"} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Store & Inventory Management"
            subtitle="Sai ReadyMix Concrete · Live Silo Stock, Inward Gate Receipts, Batching Deductions & Material Flow"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedMaterialName("Cement (OPC 53)");
                setInwardOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-md"
            >
              <Plus className="mr-1.5 size-4" />
              Record Inward Material (Gate Entry)
            </Button>
          )}
        </div>
      </div>

      {/* Dynamic KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Available Stock"
          value={`${(totalStockKg / 1000).toFixed(1)} MT`}
          icon={Box}
          comparison="across 8 plant silos & bays"
        />
        <KpiCard
          label="Total Inward Received"
          value={`+${(totalInwardKg / 1000).toFixed(1)} MT`}
          icon={ArrowDownLeft}
          comparison={`${inwardTickets.length} supplier delivery trucks`}
        />
        <KpiCard
          label="Total Batched & Consumed"
          value={`-${(totalConsumedKg / 1000).toFixed(1)} MT`}
          icon={ArrowUpRight}
          comparison={`${consumptionLogs.length} production batch sheet runs`}
        />
        <KpiCard
          label="Today's Production"
          value={`${dpr.data?.[0]?.totalCum ?? 24} m³`}
          icon={Layers}
          comparison={`${dpr.data?.[0]?.totalBatches ?? 3} TM trips mixed`}
        />
      </div>

      {/* Main Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 max-w-6xl h-auto p-1 gap-1">
          <TabsTrigger value="inventory" className="flex items-center gap-1.5 text-xs py-2 cursor-pointer font-medium">
            <PackageSearch className="size-3.5 text-primary" />
            Materials & Silos
          </TabsTrigger>
          <TabsTrigger value="inward-register" className="flex items-center gap-1.5 text-xs py-2 cursor-pointer font-medium">
            <ArrowDownLeft className="size-3.5 text-emerald-500" />
            Gate Inward Receipts ({inwardTickets.length})
          </TabsTrigger>
          <TabsTrigger value="consumption" className="flex items-center gap-1.5 text-xs py-2 cursor-pointer font-medium">
            <ArrowUpRight className="size-3.5 text-rose-500" />
            Batching Deductions ({consumptionLogs.length})
          </TabsTrigger>
          <TabsTrigger value="material-flow" className="flex items-center gap-1.5 text-xs py-2 cursor-pointer font-medium">
            <GitFork className="size-3.5 text-cyan-400" />
            Flow & Waste
          </TabsTrigger>
          <TabsTrigger value="dpr" className="flex items-center gap-1.5 text-xs py-2 cursor-pointer font-medium">
            <Layers className="size-3.5 text-indigo-400" />
            DPR Reports
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-1.5 text-xs py-2 cursor-pointer font-medium">
            <Receipt className="size-3.5 text-amber-400" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-1.5 text-xs py-2 cursor-pointer font-medium">
            <Users className="size-3.5 text-blue-400" />
            Staff Attendance
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MATERIALS & SILO STOCK */}
        <TabsContent value="inventory" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Live Silo & Raw Material Inventory</h3>
              <p className="text-xs text-muted-foreground">
                Current stock balances automatically increase with Gate Inward entries and decrease with Production batching.
              </p>
            </div>
            <FilterBar
              search={params.q}
              onSearchChange={(q) => updateParams({ q })}
              searchPlaceholder="Filter materials..."
            />
          </div>

          <DataTable
            columns={inventoryColumns}
            rows={filteredInventory}
            rowKey={(r) => r.id}
            emptyTitle="No materials found"
            emptyDescription="Raw material inventory items will appear here."
          />
        </TabsContent>

        {/* TAB 2: INWARD GATE RECEIPTS */}
        <TabsContent value="inward-register" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Gate Inward Material Receipts (Goods Inward Note)</h3>
              <p className="text-xs text-muted-foreground">
                Manual gate entries recorded for incoming aggregate dumpers, cement tankers, and admixtures.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setInwardOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shrink-0"
            >
              <Plus className="mr-1.5 size-4" />
              New Inward Receipt
            </Button>
          </div>

          <DataTable
            columns={inwardColumns}
            rows={inwardTickets}
            rowKey={(r) => r.id}
            emptyTitle="No inward receipts recorded"
            emptyDescription="Incoming raw material delivery trucks will appear here once logged at the gate."
          />
        </TabsContent>

        {/* TAB 3: MATERIAL CONSUMPTION TRACKER */}
        <TabsContent value="consumption" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Production Batching Consumption Tracker</h3>
              <p className="text-xs text-muted-foreground">
                Live audit trail showing exactly which batch, trip, customer, and grade consumed each material.
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Total Batches Logged: <strong>{consumptionLogs.length}</strong>
            </span>
          </div>

          <DataTable
            columns={consumptionColumns}
            rows={consumptionLogs}
            rowKey={(r) => r.id}
            emptyTitle="No consumption transactions logged yet"
            emptyDescription="Material consumption entries are automatically recorded whenever the Production department batches an order."
          />
        </TabsContent>

        {/* TAB 4: MATERIAL FLOW & WASTE */}
        <TabsContent value="material-flow" className="mt-4">
          <MaterialFlowDiagram />
        </TabsContent>

        {/* TAB 5: DPR REPORTS */}
        <TabsContent value="dpr" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Daily Production Reports (DPR / MPR)</h3>
              <p className="text-xs text-muted-foreground">Daily volume produced, power, diesel and cement consumption.</p>
            </div>
          </div>
          <DataTable
            columns={dprColumns}
            rows={dpr.data || []}
            rowKey={(r) => r.id}
            emptyTitle="No DPR records"
            emptyDescription="Production summaries will appear here daily."
          />
        </TabsContent>

        {/* TAB 6: EXPENSES */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Store & Plant Operating Expenses</h3>
              <p className="text-xs text-muted-foreground">Diesel procurement, spare parts, and maintenance bills.</p>
            </div>
          </div>
          <DataTable
            columns={expenseColumns}
            rows={expenses.data || []}
            rowKey={(r) => r.id}
            emptyTitle="No expenses logged"
            emptyDescription="Plant operating bills will appear here."
          />
        </TabsContent>

        {/* TAB 7: ATTENDANCE */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Driver & Plant Staff Attendance</h3>
              <p className="text-xs text-muted-foreground">Biometric sync, shifts, and TM trips completed.</p>
            </div>
          </div>
          <DataTable
            columns={attColumns}
            rows={attendance.data || []}
            rowKey={(r) => r.id}
            emptyTitle="No attendance records"
            emptyDescription="Shift attendance will appear here."
          />
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* MODAL: MANUAL INWARD MATERIAL GATE ENTRY */}
      {/* ============================================================== */}
      <Dialog open={inwardOpen} onOpenChange={setInwardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <ArrowDownLeft className="size-4.5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold">Record Inward Material (Gate Entry)</DialogTitle>
                <DialogDescription className="text-xs">
                  Manually log incoming raw material delivery from suppliers. Stock increases immediately upon saving.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Material Dropdown */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Material Received *</Label>
                <Select value={selectedMaterialName} onValueChange={setSelectedMaterialName}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(inventory.data || []).map((m: InventoryItem) => (
                      <SelectItem key={m.id} value={m.material}>
                        {m.material} ({m.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Storage Silo / Bay */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Destination Silo / Storage Bay</Label>
                <Input
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="e.g. Silo #1 / Bay #2"
                  className="h-8 text-xs"
                />
              </div>

              {/* Supplier / Vendor Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Supplier / Vendor Name *</Label>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. UltraTech Cement / Narmada Sands"
                  className="h-8 text-xs"
                  required
                />
              </div>

              {/* Vehicle Number */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Truck / Dumper Vehicle No. *</Label>
                <Input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  placeholder="e.g. MH-12-RN-8899"
                  className="h-8 text-xs font-mono uppercase"
                  required
                />
              </div>

              {/* Supplier Delivery Challan / Gate Pass */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Supplier Challan / Gate Pass No.</Label>
                <Input
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                  placeholder="e.g. CH-99021"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Weighment Entry Mode */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Weighment Mode</Label>
                <Select value={weightMode} onValueChange={(v: "tare_gross" | "direct") => setWeightMode(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tare_gross">Gross & Tare Weight (Calculated Net)</SelectItem>
                    <SelectItem value="direct">Direct Net Quantity (Kg / Litres)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* WEIGHT INPUTS */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Scale className="size-3.5 text-primary" />
                Weight / Quantity Entry (in Kilograms / Litres)
              </span>

              {weightMode === "tare_gross" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Gross Weight (Loaded Truck)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 42000"
                      value={grossWeight || ""}
                      onChange={(e) => setGrossWeight(Number(e.target.value))}
                      className="h-8 text-xs font-mono text-right"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tare Weight (Empty Truck)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 12500"
                      value={tareWeight || ""}
                      onChange={(e) => setTareWeight(Number(e.target.value))}
                      className="h-8 text-xs font-mono text-right"
                    />
                  </div>
                  <div className="space-y-1 bg-background/80 p-2 rounded border border-border text-right">
                    <Label className="text-[11px] text-muted-foreground block">Net Material Added</Label>
                    <span className="font-mono font-bold text-base text-emerald-400">
                      +{num(calculatedNetWeight)} kg
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Direct Net Quantity</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 29500"
                      value={directNetWeight || ""}
                      onChange={(e) => setDirectNetWeight(Number(e.target.value))}
                      className="h-8 text-xs font-mono text-right"
                    />
                  </div>
                  <div className="space-y-1 bg-background/80 p-2 rounded border border-border text-right">
                    <Label className="text-[11px] text-muted-foreground block">Net Material Added</Label>
                    <span className="font-mono font-bold text-base text-emerald-400">
                      +{num(calculatedNetWeight)} kg/L
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Extra Personnel Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Truck Driver Name</Label>
                <Input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Gate Security / Received By</Label>
                <Input
                  value={watchmanName}
                  onChange={(e) => setWatchmanName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setInwardOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saveInwardMutation.isPending || calculatedNetWeight <= 0 || !supplierName.trim() || !vehicleNo.trim()}
              onClick={() => saveInwardMutation.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
            >
              <CheckCircle2 className="mr-1.5 size-4" />
              Save Inward & Update Silo Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL: PRINTABLE GATE PASS SLIP */}
      {/* ============================================================== */}
      {printedSlip && (
        <Dialog open={!!printedSlip} onOpenChange={() => setPrintedSlip(null)}>
          <DialogContent className="max-w-md font-mono text-xs">
            <DialogHeader>
              <DialogTitle className="text-center font-bold text-sm tracking-wider uppercase border-b pb-2">
                SAI READYMIX CONCRETE · MULKHED
              </DialogTitle>
              <DialogDescription className="text-center text-[10px]">
                OFFICIAL INWARD WEIGHMENT GATE PASS SLIP
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 border border-dashed p-3 rounded bg-muted/20">
              <div className="flex justify-between">
                <span>Gate Pass No:</span>
                <span className="font-bold">{printedSlip.gatePassNo || printedSlip.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Ticket No:</span>
                <span>{printedSlip.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{dt(printedSlip.grossTime)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span>Material:</span>
                <span className="font-bold text-foreground">{printedSlip.material}</span>
              </div>
              <div className="flex justify-between">
                <span>Supplier / Vendor:</span>
                <span>{printedSlip.supplierOrCustomer}</span>
              </div>
              <div className="flex justify-between">
                <span>Vehicle No:</span>
                <span className="font-bold">{printedSlip.vehicleNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Driver:</span>
                <span>{printedSlip.driverName || "Driver"}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span>Gross Weight:</span>
                <span>{num(printedSlip.grossWeight)} kg</span>
              </div>
              <div className="flex justify-between">
                <span>Tare Weight:</span>
                <span>{num(printedSlip.tareWeight)} kg</span>
              </div>
              <div className="flex justify-between border-t pt-1 text-sm font-bold text-emerald-500">
                <span>NET WEIGHT:</span>
                <span>{num(printedSlip.netWeight)} kg</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-[10px] text-muted-foreground">
                <span>Weighbridge: {printedSlip.wbName || "Scale #1"}</span>
                <span>Officer: {printedSlip.watchmanName || "Security"}</span>
              </div>
            </div>

            <DialogFooter className="pt-2 flex justify-between sm:justify-between">
              <Button variant="outline" size="sm" onClick={() => setPrintedSlip(null)}>
                Close
              </Button>
              <Button size="sm" onClick={() => window.print()} className="font-semibold">
                <Printer className="size-3.5 mr-1" />
                Print Gate Pass Slip
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
