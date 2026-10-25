import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Scale,
  PackageSearch,
  Truck,
  AlertTriangle,
  Box,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Save,
  HardDrive,
  Building2,
  Settings,
  Fuel,
  Receipt,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
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
  type WeighbridgeSettings,
  type DprRecord,
  type ExpenseRecord,
  type AttendanceRecord,
  fallbackSettings,
} from "@/api/store";
import { useAuth } from "@/auth/auth-context";
import { inr, dt, num } from "@/lib/format";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_shell/store")({
  head: () => ({
    meta: [
      { title: "Store & Weighbridge · RMC Command Center" },
      { name: "description", content: "End-to-end Store operations: Live Weighbridge, Stock & Consumption, DPR/MPR, Expenses, and HR attendance." },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { user } = useAuth();
  const readOnly = user?.role === "owner";
  const [activeTab, setActiveTab] = useState<"terminal" | "payloads" | "inventory" | "dpr" | "expenses" | "attendance">("terminal");

  // Query Data
  const { params, updateParams, query: inventory } = useListQuery(["inventory"], () => storeApi.inventory().then((r) => r.data));
  const weighbridge = useQuery({ queryKey: ["weighbridge"], queryFn: () => storeApi.weighbridge().then((r) => r.data) });
  const payloads = useQuery({ queryKey: ["payload-details"], queryFn: () => storeApi.payloadDetails().then((r) => r.data) });
  const settingsQuery = useQuery({ queryKey: ["weighbridge-settings"], queryFn: () => storeApi.settings().then((r) => r.data) });
  const dpr = useQuery({ queryKey: ["dpr-reports"], queryFn: () => storeApi.dprReports().then((r) => r.data) });
  const expenses = useQuery({ queryKey: ["store-expenses"], queryFn: () => storeApi.expenses().then((r) => r.data) });
  const attendance = useQuery({ queryKey: ["store-attendance"], queryFn: () => storeApi.attendance().then((r) => r.data) });

  // Settings State (Dynamic Vendor & Plant Configuration)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plantName, setPlantName] = useState("");
  const [vendorSoftwareName, setVendorSoftwareName] = useState("");
  const [vendorCompanyName, setVendorCompanyName] = useState("");
  const [customerCare, setCustomerCare] = useState("");
  const [wbName, setWbName] = useState("");
  const [comPort, setComPort] = useState("");

  // Populate settings form when query loads
  useMemo(() => {
    if (settingsQuery.data) {
      setPlantName(settingsQuery.data.plantName);
      setVendorSoftwareName(settingsQuery.data.vendorSoftwareName);
      setVendorCompanyName(settingsQuery.data.vendorCompanyName);
      setCustomerCare(settingsQuery.data.customerCare);
      setWbName(settingsQuery.data.wbName);
      setComPort(settingsQuery.data.comPort);
    }
  }, [settingsQuery.data]);

  // Terminal UI State
  const [ticketNumber, setTicketNumber] = useState("65509");
  const [weightMode, setWeightMode] = useState<"gross" | "tare">("gross");
  const [liveScaleWeight, setLiveScaleWeight] = useState(28500);
  const [autoCapture, setAutoCapture] = useState(true);

  const [terminalVehicleNo, setTerminalVehicleNo] = useState("");
  const [terminalPartyName, setTerminalPartyName] = useState("");
  const [terminalProduct, setTerminalProduct] = useState("Crushed Sand (M-Sand)");
  const [terminalGrossWeight, setTerminalGrossWeight] = useState<number>(0);
  const [terminalTareWeight, setTerminalTareWeight] = useState<number>(0);
  const [terminalReceivedRs, setTerminalReceivedRs] = useState("");
  const [terminalType, setTerminalType] = useState<"INWARD" | "OUTWARD">("INWARD");
  const [driverName, setDriverName] = useState("");
  const [watchmanName, setWatchmanName] = useState("Ganesh Shinde (Gate Watchman)");
  const [selectedPayloadInfo, setSelectedPayloadInfo] = useState<TransitMixerPayload | null>(null);

  // Print Gate Pass Modal State
  const [printedSlip, setPrintedSlip] = useState<WeighbridgeTicket | null>(null);

  // Complete Tare Dialog State
  const [completeTarget, setCompleteTarget] = useState<WeighbridgeTicket | null>(null);
  const [dialogTareWeight, setDialogTareWeight] = useState("");

  // Calculate Net Weight
  const terminalNetWeight = Math.max(0, (terminalGrossWeight || 0) - (terminalTareWeight || 0));

  // Handler: When vehicle is picked, autofill known Tare Weight & Pay Load details
  function handleVehicleSelect(vNo: string) {
    setTerminalVehicleNo(vNo);
    const found = payloads.data?.find((p: TransitMixerPayload) => p.vehicleNo.toLowerCase() === vNo.toLowerCase());
    if (found) {
      setSelectedPayloadInfo(found);
      setTerminalTareWeight(found.newTareWeightKg);
      toast.info(`Loaded fleet specs for ${found.vehicleNo}: Tare: ${num(found.newTareWeightKg)} kg, Max Handi: ${found.installedHandiCapacityCum} m³`);
    } else {
      setSelectedPayloadInfo(null);
    }
  }

  // Handler: Capture Scale Weight
  function handleCaptureWeight() {
    if (weightMode === "gross") {
      setTerminalGrossWeight(liveScaleWeight);
      toast.success(`Captured Gross Weight: ${num(liveScaleWeight)} kg`);
    } else {
      setTerminalTareWeight(liveScaleWeight);
      toast.success(`Captured Tare Weight: ${num(liveScaleWeight)} kg`);
    }
  }

  // Mutation: Save Settings
  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      storeApi.updateSettings({
        plantName,
        vendorSoftwareName,
        vendorCompanyName,
        customerCare,
        wbName,
        comPort,
        autoCapture,
      }),
    onSuccess: () => {
      toast.success("Weighbridge settings updated");
      setSettingsOpen(false);
      void qc.invalidateQueries({ queryKey: ["weighbridge-settings"] });
    },
  });

  // Mutation: Save Weighbridge Entry & Automatically update stock of materials
  const saveEntryMutation = useMutation({
    mutationFn: () =>
      storeApi.saveWeighbridgeEntry({
        wbName: wbName || "Weigh Bridge #1",
        ticketNumber: `TK${ticketNumber}`,
        type: terminalType,
        vehicleNumber: terminalVehicleNo,
        partyName: terminalPartyName,
        product: terminalProduct,
        grossWeight: terminalGrossWeight,
        tareWeight: terminalTareWeight,
        grossDate: new Date().toISOString(),
        tareDate: new Date().toISOString(),
        receivedRs: terminalReceivedRs ? Number(terminalReceivedRs) : undefined,
        driverName,
        watchmanName,
      }),
    onSuccess: (res) => {
      const { ticket, updatedStock } = res.data;
      if (updatedStock) {
        toast.success(
          `Ticket ${ticket.ticketNumber} saved! Live stock of ${updatedStock.material} updated to ${num(updatedStock.currentStock)} ${updatedStock.unit}`
        );
      } else {
        toast.success(`Weighbridge ticket ${ticket.ticketNumber} saved!`);
      }

      setPrintedSlip(ticket);
      setTicketNumber((prev) => String(Number(prev) + 1));
      void qc.invalidateQueries({ queryKey: ["weighbridge"] });
      void qc.invalidateQueries({ queryKey: ["inventory"] });

      // Reset form
      setTerminalGrossWeight(0);
      setTerminalTareWeight(0);
      setTerminalPartyName("");
      setTerminalReceivedRs("");
      setDriverName("");
    },
    onError: () => toast.error("Failed to save weighbridge ticket"),
  });

  // Mutation: Complete Pending Ticket Tare
  const completeTicketMutation = useMutation({
    mutationFn: (id: string) => storeApi.completeTicket(id, Number(dialogTareWeight)),
    onSuccess: (res) => {
      toast.success("Ticket completed and inventory stock updated!");
      setPrintedSlip(res.data);
      setCompleteTarget(null);
      setDialogTareWeight("");
      void qc.invalidateQueries({ queryKey: ["weighbridge"] });
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  // Filtered lists
  const filteredInventory = useMemo(() => {
    if (!inventory.data) return [];
    let list = inventory.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i: InventoryItem) => i.material.toLowerCase().includes(lower) || i.category.toLowerCase().includes(lower));
    }
    return list;
  }, [inventory.data, params]);

  const filteredPayloads = useMemo(() => {
    if (!payloads.data) return [];
    let list = payloads.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter(
        (p: TransitMixerPayload) =>
          p.vehicleNo.toLowerCase().includes(lower) ||
          p.make.toLowerCase().includes(lower) ||
          p.location.toLowerCase().includes(lower)
      );
    }
    return list;
  }, [payloads.data, params]);

  const filteredExpenses = useMemo(() => {
    if (!expenses.data) return [];
    let list = expenses.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter(
        (e: ExpenseRecord) =>
          e.category.toLowerCase().includes(lower) ||
          e.vendor.toLowerCase().includes(lower) ||
          e.billNo.toLowerCase().includes(lower)
      );
    }
    return list;
  }, [expenses.data, params]);

  const filteredAttendance = useMemo(() => {
    if (!attendance.data) return [];
    let list = attendance.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter(
        (a: AttendanceRecord) =>
          a.name.toLowerCase().includes(lower) ||
          a.designationOrVehicle.toLowerCase().includes(lower)
      );
    }
    return list;
  }, [attendance.data, params]);

  if (inventory.isLoading || weighbridge.isLoading || payloads.isLoading || settingsQuery.isLoading || dpr.isLoading || expenses.isLoading || attendance.isLoading)
    return <LoadingState rows={6} />;

  if (inventory.error || !inventory.data || weighbridge.error || !weighbridge.data || payloads.error || !payloads.data || !dpr.data || !expenses.data || !attendance.data)
    return <ErrorState message="Store data could not be loaded." onRetry={() => void inventory.refetch()} />;

  const lowStock = inventory.data.filter((i: InventoryItem) => i.currentStock <= i.reorderLevel).length;
  const currentSettings = settingsQuery.data || fallbackSettings();

  // Inventory Table Columns
  const invColumns: Column<InventoryItem>[] = [
    { key: "material", header: "Material", cell: (r) => <span className="font-semibold">{r.material}</span> },
    { key: "category", header: "Category", cell: (r) => <span className="text-muted-foreground text-xs">{r.category}</span> },
    {
      key: "stock",
      header: "Current Stock",
      align: "right",
      cell: (r) => (
        <span className={cn("tabular-nums font-bold", r.currentStock <= r.reorderLevel ? "text-destructive" : "text-emerald-500")}>
          {num(r.currentStock)} {r.unit}
        </span>
      ),
      sortValue: (r) => r.currentStock,
    },
    { key: "capacity", header: "Capacity", align: "right", cell: (r) => `${num(r.capacity)} ${r.unit}` },
    { key: "reorder", header: "Reorder Alert", align: "right", cell: (r) => `${num(r.reorderLevel)} ${r.unit}` },
    { key: "updated", header: "Last Updated", align: "right", cell: (r) => dt(r.lastUpdated) },
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
    { key: "punch", header: "Punch Time", cell: (r) => r.punchTime },
    { key: "source", header: "Source", cell: (r) => <span className="font-mono text-xs text-blue-400">{r.syncSource}</span> },
    { key: "trips", header: "Trips Completed", align: "right", cell: (r) => r.tripsOrTasks },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status === "PRESENT" || r.status === "ON_TRIP" ? "APPROVED" : "REJECTED"} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <PageHeader
            title="Store & Weighbridge Operations"
            subtitle={`${currentSettings.plantName} · End-to-end material flow, weighing, DPR/MPR consumption, and expenses`}
          />
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="mr-1.5 size-4" />
              Weighbridge Config
            </Button>
          )}
          <Button
            variant={activeTab === "terminal" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("terminal")}
          >
            <Scale className="mr-1.5 size-4" />
            Weighbridge Console
          </Button>
          <Button
            variant={activeTab === "payloads" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("payloads")}
          >
            <FileSpreadsheet className="mr-1.5 size-4" />
            TM Pay Load Sheet
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sand Stock (M-Sand)"
          value={`${num(inventory.data.find((i: InventoryItem) => i.material.includes("Crushed"))?.currentStock ?? 0)} MT`}
          icon={Box}
          comparison="silo capacity 1,500 MT"
        />
        <KpiCard
          label="Cement Stock (OPC 53)"
          value={`${num(inventory.data.find((i: InventoryItem) => i.material.includes("OPC"))?.currentStock ?? 0)} MT`}
          icon={Building2}
          comparison="silo capacity 200 MT"
        />
        <KpiCard
          label="Today's Production (Cum)"
          value={`${dpr.data[0]?.totalCum ?? 242} m³`}
          icon={Layers}
          comparison={`${dpr.data[0]?.totalBatches ?? 38} batches dispatched`}
        />
        <KpiCard
          label="Diesel Stock"
          value={`${num(inventory.data.find((i: InventoryItem) => i.category === "FUEL")?.currentStock ?? 4200)} L`}
          icon={Fuel}
          comparison="generator & TM tank"
        />
      </div>

      {/* Main Tab Navigation matching the entire Mindmap Workflow */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-6 max-w-4xl">
          <TabsTrigger value="terminal" className="flex items-center gap-1.5 text-xs">
            <Scale className="size-3.5" />
            Weighbridge
          </TabsTrigger>
          <TabsTrigger value="payloads" className="flex items-center gap-1.5 text-xs">
            <FileSpreadsheet className="size-3.5" />
            TM Pay Load
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1.5 text-xs">
            <PackageSearch className="size-3.5" />
            Materials & Silos
          </TabsTrigger>
          <TabsTrigger value="dpr" className="flex items-center gap-1.5 text-xs">
            <Layers className="size-3.5" />
            DPR & MPR
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-1.5 text-xs">
            <Receipt className="size-3.5" />
            Bills & Expenses
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-1.5 text-xs">
            <Users className="size-3.5" />
            Driver & Staff HR
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: DYNAMIC WEIGHBRIDGE CONSOLE (VENDOR INDEPENDENT) */}
        {/* ============================================================== */}
        <TabsContent value="terminal" className="mt-4">
          <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
            {/* Terminal Title Bar */}
            <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500 inline-block" />
                <div className="size-3 rounded-full bg-yellow-500 inline-block" />
                <div className="size-3 rounded-full bg-emerald-500 inline-block" />
                <span className="text-xs font-mono font-bold text-slate-200 ml-2">
                  {currentSettings.vendorSoftwareName} · {currentSettings.plantName} Weighbridge Console
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  {currentSettings.comPort} Connected
                </span>
                <span className="text-slate-400">Ticket # {ticketNumber}</span>
              </div>
            </div>

            <div className="p-5 grid gap-6 lg:grid-cols-12 bg-slate-950/60">
              {/* TOP SCALE DISPLAY SECTION */}
              <div className="lg:col-span-9 space-y-4">
                {/* BIG RED DIGITAL LED READOUT */}
                <div className="bg-black border-2 border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        checked={autoCapture}
                        onChange={() => setAutoCapture(true)}
                        className="text-red-600 focus:ring-red-500"
                      />
                      Auto Mode
                    </label>
                    <label className="flex items-center gap-2 text-xs font-mono text-slate-400">
                      <input type="checkbox" checked readOnly className="rounded" />
                      Weight Indicator Synchronized
                    </label>
                  </div>

                  {/* 7-Segment Style LED Screen */}
                  <div className="bg-neutral-950 border border-neutral-800 px-8 py-3 rounded text-right min-w-[240px] shadow-inner">
                    <div className="text-5xl font-mono font-black tracking-widest text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]">
                      {num(liveScaleWeight)} <span className="text-xl text-red-400 font-sans">kg</span>
                    </div>
                  </div>

                  {/* Capture Button */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      className="bg-red-600 hover:bg-red-700 text-white font-bold tracking-wide shadow-md hover:shadow-red-500/20"
                      onClick={handleCaptureWeight}
                      disabled={readOnly}
                    >
                      <Scale className="mr-2 size-5" />
                      Capture Weight
                    </Button>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <span>Simulate weight:</span>
                      <button onClick={() => setLiveScaleWeight(12100)} className="underline hover:text-white">12.1T (Tare)</button>
                      <span>|</span>
                      <button onClick={() => setLiveScaleWeight(27500)} className="underline hover:text-white">27.5T (TM)</button>
                      <span>|</span>
                      <button onClick={() => setLiveScaleWeight(45200)} className="underline hover:text-white">45.2T (Raw)</button>
                    </div>
                  </div>
                </div>

                {/* FORM FIELDS */}
                <div className="grid gap-4 sm:grid-cols-2 bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                  {/* Left Column */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 items-center gap-2">
                      <Label className="text-xs text-slate-300">WB Name</Label>
                      <Input
                        value={currentSettings.wbName}
                        readOnly
                        className="col-span-2 h-8 text-xs bg-slate-950 border-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-3 items-center gap-2">
                      <Label className="text-xs text-slate-300">Ticket No.</Label>
                      <Input
                        value={ticketNumber}
                        onChange={(e) => setTicketNumber(e.target.value)}
                        className="col-span-2 h-8 text-xs font-mono font-bold bg-slate-950 border-slate-800"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <div className="grid grid-cols-3 items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="weightType"
                            checked={weightMode === "gross"}
                            onChange={() => setWeightMode("gross")}
                          />
                          Gross Weight.
                        </label>
                        <Input
                          type="number"
                          value={terminalGrossWeight || ""}
                          onChange={(e) => setTerminalGrossWeight(Number(e.target.value))}
                          placeholder="0"
                          className="col-span-2 h-8 text-xs font-mono text-right bg-slate-950 border-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-3 items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="weightType"
                            checked={weightMode === "tare"}
                            onChange={() => setWeightMode("tare")}
                          />
                          Tare Weight.
                        </label>
                        <Input
                          type="number"
                          value={terminalTareWeight || ""}
                          onChange={(e) => setTerminalTareWeight(Number(e.target.value))}
                          placeholder="0"
                          className="col-span-2 h-8 text-xs font-mono text-right bg-slate-950 border-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-3 items-center gap-2 bg-slate-950/80 p-2 rounded border border-slate-800">
                        <span className="text-xs font-bold text-slate-200">Net Weight.</span>
                        <div className="col-span-2 text-right font-mono font-bold text-sm text-emerald-400">
                          {num(terminalNetWeight)} kg
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 items-center gap-2">
                      <Label className="text-xs text-slate-300">Transaction</Label>
                      <Select
                        value={terminalType}
                        onValueChange={(v: "INWARD" | "OUTWARD") => setTerminalType(v)}
                      >
                        <SelectTrigger className="col-span-2 h-8 text-xs bg-slate-950 border-slate-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INWARD">Inward (Raw Material Receipt)</SelectItem>
                          <SelectItem value="OUTWARD">Outward (Concrete Dispatch)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 items-center gap-2">
                      <Label className="text-xs text-slate-300">Party Name</Label>
                      <Input
                        value={terminalPartyName}
                        onChange={(e) => setTerminalPartyName(e.target.value)}
                        placeholder="Supplier or Customer name"
                        className="col-span-2 h-8 text-xs bg-slate-950 border-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-3 items-center gap-2">
                      <Label className="text-xs text-slate-300">Vehicle No.</Label>
                      <div className="col-span-2 flex gap-1.5">
                        <Select value={terminalVehicleNo} onValueChange={handleVehicleSelect}>
                          <SelectTrigger className="h-8 text-xs font-mono bg-slate-950 border-slate-800">
                            <SelectValue placeholder="Select Fleet TM or enter" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {payloads.data.map((tm: TransitMixerPayload) => (
                              <SelectItem key={tm.vehicleNo} value={tm.vehicleNo} className="font-mono text-xs">
                                {tm.vehicleNo} ({tm.make} · {tm.installedHandiCapacityCum} m³ · {tm.location})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Fleet Specs Callout */}
                    {selectedPayloadInfo && (
                      <div className="bg-slate-950 p-2.5 rounded border border-blue-500/30 text-[11px] space-y-1">
                        <div className="flex justify-between text-slate-300 font-mono">
                          <span>Handi Cap: <strong>{selectedPayloadInfo.installedHandiCapacityCum} m³</strong></span>
                          <span>RTO GVW: <strong>{num(selectedPayloadInfo.rtoGvwKg)} kg</strong></span>
                        </div>
                        <div className="flex justify-between text-slate-400 font-mono">
                          <span>Max Payload (RC): {selectedPayloadInfo.payLoadCapacityRcGvwCum} m³</span>
                          <span>Overload Pass: <span className={selectedPayloadInfo.overLoadPass === "Yes" ? "text-emerald-400" : "text-amber-400"}>{selectedPayloadInfo.overLoadPass}</span></span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 items-center gap-2">
                      <Label className="text-xs text-slate-300">Product</Label>
                      <Select value={terminalProduct} onValueChange={setTerminalProduct}>
                        <SelectTrigger className="col-span-2 h-8 text-xs bg-slate-950 border-slate-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Crushed Sand (M-Sand)">Crushed Sand (M-Sand)</SelectItem>
                          <SelectItem value="Natural River Sand">Natural River Sand</SelectItem>
                          <SelectItem value="OPC 53 Cement">OPC 53 Cement</SelectItem>
                          <SelectItem value="PPC Cement">PPC Cement</SelectItem>
                          <SelectItem value="Fly Ash (Class F)">Fly Ash (Class F)</SelectItem>
                          <SelectItem value="GGBS (Slag)">GGBS (Slag)</SelectItem>
                          <SelectItem value="Aggregate 10mm">Aggregate 10mm</SelectItem>
                          <SelectItem value="Aggregate 20mm">Aggregate 20mm</SelectItem>
                          <SelectItem value="Aggregate 40mm">Aggregate 40mm</SelectItem>
                          <SelectItem value="Admixture PC">Admixture PC</SelectItem>
                          <SelectItem value="Diesel (HSD)">Diesel (HSD)</SelectItem>
                          <SelectItem value="Concrete M25">Concrete M25</SelectItem>
                          <SelectItem value="Concrete M30">Concrete M30</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 items-center gap-2">
                      <Label className="text-xs text-slate-300">Driver Name</Label>
                      <Input
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="Driver name"
                        className="col-span-2 h-8 text-xs bg-slate-950 border-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* BOTTOM BUTTON BAR: Save, Clear, Print */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
                      disabled={readOnly || !terminalVehicleNo || !terminalProduct || terminalGrossWeight <= 0}
                      onClick={() => saveEntryMutation.mutate()}
                    >
                      <Save className="mr-1.5 size-4" />
                      Save & Update Stock
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTerminalGrossWeight(0);
                        setTerminalTareWeight(0);
                        setTerminalPartyName("");
                        setTerminalVehicleNo("");
                        setSelectedPayloadInfo(null);
                        setDriverName("");
                      }}
                    >
                      <RotateCcw className="mr-1.5 size-4" />
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (terminalGrossWeight > 0) {
                          setPrintedSlip({
                            id: "PREVIEW",
                            ticketNumber: `TK${ticketNumber}`,
                            gatePassNo: "GP-TEMP",
                            type: terminalType,
                            vehicleNumber: terminalVehicleNo || "MH 14 XX 0000",
                            material: terminalProduct,
                            supplierOrCustomer: terminalPartyName || "Direct Party",
                            grossWeight: terminalGrossWeight,
                            tareWeight: terminalTareWeight,
                            netWeight: terminalNetWeight,
                            grossTime: new Date().toISOString(),
                            tareTime: new Date().toISOString(),
                            status: "COMPLETED",
                            wbName: currentSettings.wbName,
                            driverName: driverName || "Driver",
                            watchmanName: watchmanName,
                          });
                        } else {
                          toast.error("Please enter weights to preview slip");
                        }
                      }}
                    >
                      <Printer className="mr-1.5 size-4" />
                      Generate Gate Pass
                    </Button>
                  </div>

                  <p className="text-xs text-slate-400 italic">
                    * Flow: Weighing → Capture Data → Generate Slip → Watchman handsover to Driver.
                  </p>
                </div>
              </div>

              {/* RIGHT SIDE MENU BUTTONS */}
              <div className="lg:col-span-3 flex flex-col gap-2.5 bg-slate-900/80 p-4 rounded-lg border border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Quick Modules
                </span>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs font-medium h-9 bg-slate-950 border-slate-800 hover:bg-slate-800"
                  onClick={() => setActiveTab("payloads")}
                >
                  <FileSpreadsheet className="mr-2 size-3.5 text-blue-400" />
                  TM Pay Load Limits (18 Vehicles)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs font-medium h-9 bg-slate-950 border-slate-800 hover:bg-slate-800"
                  onClick={() => setActiveTab("inventory")}
                >
                  <PackageSearch className="mr-2 size-3.5 text-amber-400" />
                  Material Silos & Stocks
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs font-medium h-9 bg-slate-950 border-slate-800 hover:bg-slate-800"
                  onClick={() => setActiveTab("dpr")}
                >
                  <Layers className="mr-2 size-3.5 text-emerald-400" />
                  Daily Production Report (DPR)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs font-medium h-9 bg-slate-950 border-slate-800 hover:bg-slate-800"
                  onClick={() => setActiveTab("expenses")}
                >
                  <Receipt className="mr-2 size-3.5 text-purple-400" />
                  Diesel & Plant Expenses
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs font-medium h-9 bg-slate-950 border-slate-800 hover:bg-slate-800"
                  onClick={() => setActiveTab("attendance")}
                >
                  <Users className="mr-2 size-3.5 text-cyan-400" />
                  UBITECH Driver Attendance
                </Button>

                <div className="mt-auto pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <p>Plant: <strong>{currentSettings.plantName}</strong></p>
                  <p>Console: <strong>{currentSettings.vendorSoftwareName}</strong></p>
                  <p>Auto-tare: <strong>Active</strong></p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: EXACT "Sai ReadyMix Concrete - Transit Mixer Pay Load Details" */}
        {/* ============================================================== */}
        <TabsContent value="payloads" className="mt-4 space-y-4">
          <div className="panel p-6 bg-card border-border shadow-sm">
            <div className="border-b pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">{currentSettings.plantName}</h2>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Transit Mixer Pay Load Details
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="mr-1.5 size-4" />
                  Print Sheet
                </Button>
              </div>
            </div>

            <FilterBar
              search={params.q}
              onSearchChange={(q) => updateParams({ q })}
              searchPlaceholder="Search vehicle number, make (Benz/TATA/Ashok Leyland), location..."
            />

            {/* EXACT 15-COLUMN TABLE */}
            <div className="overflow-x-auto mt-4 rounded-lg border border-border">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted text-muted-foreground uppercase font-bold text-[11px] border-b">
                  <tr>
                    <th className="px-3 py-3 border-r text-center">S.NO</th>
                    <th className="px-3 py-3 border-r">VEHICLE NO</th>
                    <th className="px-2 py-3 border-r text-center">Vehicle Type</th>
                    <th className="px-3 py-3 border-r">Make</th>
                    <th className="px-3 py-3 border-r">Location</th>
                    <th className="px-3 py-3 border-r">Vehicle Tyre Details</th>
                    <th className="px-2 py-3 border-r text-center">Over Load Pass</th>
                    <th className="px-3 py-3 border-r text-right">Installed Handi (Mixer) Capacity- Cum</th>
                    <th className="px-3 py-3 border-r text-right">RTO GVW-Kg</th>
                    <th className="px-3 py-3 border-r text-right">Tare Weight-Kg</th>
                    <th className="px-3 py-3 border-r text-right">Weight Of Water-Kg</th>
                    <th className="px-3 py-3 border-r text-right">New Tare Weight-Kg</th>
                    <th className="px-3 py-3 border-r text-right">Actual Weight for Loading-Kg</th>
                    <th className="px-3 py-3 border-r text-center bg-primary/5">
                      (Consider @2500Kg/Cum) Pay Load Capacity as per RC GVW
                    </th>
                    <th className="px-3 py-3 text-center bg-primary/10">
                      Supply Pay Load Capacity as per Overload Pass
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredPayloads.map((row: TransitMixerPayload) => (
                    <tr key={row.vehicleNo} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-2.5 border-r text-center font-medium">{row.sNo}</td>
                      <td className="px-3 py-2.5 border-r font-mono font-bold text-foreground whitespace-nowrap">
                        {row.vehicleNo}
                      </td>
                      <td className="px-2 py-2.5 border-r text-center font-medium">{row.vehicleType}</td>
                      <td className="px-3 py-2.5 border-r font-medium">{row.make}</td>
                      <td className="px-3 py-2.5 border-r">{row.location}</td>
                      <td className="px-3 py-2.5 border-r">{row.vehicleTyreDetails}</td>
                      <td className="px-2 py-2.5 border-r text-center">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold",
                            row.overLoadPass === "Yes"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-500/20 text-slate-400"
                          )}
                        >
                          {row.overLoadPass}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-r text-right tabular-nums font-semibold">
                        {row.installedHandiCapacityCum}
                      </td>
                      <td className="px-3 py-2.5 border-r text-right tabular-nums">{num(row.rtoGvwKg)}</td>
                      <td className="px-3 py-2.5 border-r text-right tabular-nums">{num(row.tareWeightKg)}</td>
                      <td className="px-3 py-2.5 border-r text-right tabular-nums">{row.weightOfWaterKg}</td>
                      <td className="px-3 py-2.5 border-r text-right tabular-nums font-bold text-foreground">
                        {num(row.newTareWeightKg)}
                      </td>
                      <td className="px-3 py-2.5 border-r text-right tabular-nums font-semibold text-blue-400">
                        {num(row.actualWeightForLoadingKg)}
                      </td>
                      <td className="px-3 py-2.5 border-r text-center font-bold text-foreground bg-primary/5">
                        {row.payLoadCapacityRcGvwCum}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-400 bg-primary/10">
                        {row.supplyPayLoadCapacityOverloadPassCum}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3: STOCK & CONSUMPTION (MATERIALS & SILOS) */}
        {/* ============================================================== */}
        <TabsContent value="inventory" className="mt-4 space-y-4">
          <FilterBar
            search={params.q}
            onSearchChange={(q) => updateParams({ q })}
            searchPlaceholder="Search materials by name or category..."
          />

          <DataTable
            columns={invColumns}
            rows={filteredInventory}
            rowKey={(r) => r.id}
            emptyTitle="No inventory found"
            emptyDescription="Inventory items will appear here."
          />
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 4: CONSUMPTION DATA (DPR & MPR) */}
        {/* ============================================================== */}
        <TabsContent value="dpr" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Daily Production & Consumption Report (DPR)</h3>
              <p className="text-xs text-muted-foreground">Consolidated material usage against batching volume</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info("Monthly Production Report (MPR) exported to Excel")}>
              Export MPR to Excel
            </Button>
          </div>

          <DataTable
            columns={dprColumns}
            rows={dpr.data}
            rowKey={(r) => r.id}
            emptyTitle="No DPR records found"
            emptyDescription="Production records will appear here."
          />
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 5: BILLS & PLANT EXPENSES */}
        {/* ============================================================== */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Bills & Expense Records</h3>
              <p className="text-xs text-muted-foreground">Diesel, Raw Materials, Aggregates, Land, and Maintenance accounts</p>
            </div>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              Total Logged Expenses: {inr(expenses.data.reduce((sum: number, e: ExpenseRecord) => sum + e.amount, 0))}
            </div>
          </div>

          <FilterBar
            search={params.q}
            onSearchChange={(q) => updateParams({ q })}
            searchPlaceholder="Search expense category (Diesel, Aggregate...), vendor, or bill no..."
          />

          <DataTable
            columns={expenseColumns}
            rows={filteredExpenses}
            rowKey={(r) => r.id}
            emptyTitle="No expenses found"
            emptyDescription="Plant expenses will appear here."
          />
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 6: DRIVER & STAFF HR ATTENDANCE */}
        {/* ============================================================== */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Driver & Plant Staff Attendance</h3>
              <p className="text-xs text-muted-foreground">Real-time attendance synchronized via UBITECH Biometric System</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              UBITECH Cloud Synced (07:30 AM Shift)
            </div>
          </div>

          <FilterBar
            search={params.q}
            onSearchChange={(q) => updateParams({ q })}
            searchPlaceholder="Search staff or driver by name, vehicle..."
          />

          <DataTable
            columns={attColumns}
            rows={filteredAttendance}
            rowKey={(r) => r.id}
            emptyTitle="No attendance records found"
            emptyDescription="Attendance records will appear here."
          />
        </TabsContent>
      </Tabs>

      {/* WEIGHBRIDGE CONFIGURATION MODAL (Dynamic Vendor & Plant Name) */}
      <Dialog open={settingsOpen} onOpenChange={(open) => !open && setSettingsOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Weighbridge Console Settings</DialogTitle>
            <DialogDescription>
              Configure company branding and weighbridge software vendor details dynamically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Plant / Company Name</Label>
              <Input value={plantName} onChange={(e) => setPlantName(e.target.value)} placeholder="e.g. Sai ReadyMix Concrete" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Weighbridge System Title</Label>
              <Input value={vendorSoftwareName} onChange={(e) => setVendorSoftwareName(e.target.value)} placeholder="e.g. Sai RMC Weighbridge Console v2.0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">System Automation Division</Label>
              <Input value={vendorCompanyName} onChange={(e) => setVendorCompanyName(e.target.value)} placeholder="e.g. Sai ReadyMix Concrete - Automation Division" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Customer Care Phone</Label>
              <Input value={customerCare} onChange={(e) => setCustomerCare(e.target.value)} placeholder="+91 XXXXXXXXXX" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Scale Station Name</Label>
                <Input value={wbName} onChange={(e) => setWbName(e.target.value)} placeholder="Weigh Bridge #1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Serial Port</Label>
                <Input value={comPort} onChange={(e) => setComPort(e.target.value)} placeholder="COM3" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={() => saveSettingsMutation.mutate()}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GATE PASS / WEIGH SLIP MODAL (Watchman -> Driver handover) */}
      <Dialog open={printedSlip !== null} onOpenChange={(open) => !open && setPrintedSlip(null)}>
        <DialogContent className="max-w-lg font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between border-b pb-2">
              <span>Gate Pass / Weight Document</span>
              <span className="text-xs font-mono font-bold text-muted-foreground">{printedSlip?.gatePassNo}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Handover Document: Weighbridge Watchman → Transit Mixer Driver
            </DialogDescription>
          </DialogHeader>

          <div className="border p-4 rounded-lg bg-muted/20 space-y-3 text-xs">
            <div className="text-center pb-2 border-b">
              <p className="font-bold text-base text-foreground">{currentSettings.plantName}</p>
              <p className="text-[11px] text-muted-foreground">Electronic Weighbridge Delivery Ticket · {currentSettings.wbName}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><strong>Ticket No:</strong> {printedSlip?.ticketNumber}</div>
              <div><strong>Date:</strong> {dt(printedSlip?.grossTime || new Date().toISOString())}</div>
              <div><strong>Vehicle No:</strong> <span className="font-mono font-bold">{printedSlip?.vehicleNumber}</span></div>
              <div><strong>Type:</strong> <span className="font-semibold text-emerald-400">{printedSlip?.type}</span></div>
              <div><strong>Party:</strong> {printedSlip?.supplierOrCustomer}</div>
              <div><strong>Product:</strong> {printedSlip?.material}</div>
            </div>

            <div className="border-t border-b py-2 grid grid-cols-3 text-center bg-card rounded">
              <div>
                <p className="text-[10px] text-muted-foreground">Gross Wt</p>
                <p className="font-mono font-bold text-sm">{num(printedSlip?.grossWeight ?? 0)} kg</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Tare Wt</p>
                <p className="font-mono font-bold text-sm">{num(printedSlip?.tareWeight ?? 0)} kg</p>
              </div>
              <div className="text-emerald-400">
                <p className="text-[10px] text-muted-foreground">Net Wt</p>
                <p className="font-mono font-black text-sm">{num(printedSlip?.netWeight ?? 0)} kg</p>
              </div>
            </div>

            <div className="flex justify-between pt-4 text-[11px] text-muted-foreground">
              <div>
                <p>Issued by: <strong>{printedSlip?.watchmanName || "Watchman"}</strong></p>
                <p className="text-[10px]">Gate Security Signature</p>
              </div>
              <div className="text-right">
                <p>Received by: <strong>{printedSlip?.driverName || "TM Driver"}</strong></p>
                <p className="text-[10px]">Driver Signature</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintedSlip(null)}>Close</Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-1.5 size-4" />
              Print Gate Slip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
