import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Clock,
  Truck,
  Layers,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Flame,
  ArrowLeft,
  Volume2,
  VolumeX,
  Factory,
  CheckCircle2,
  Radio,
  Thermometer,
} from "lucide-react";
import { ConcreteClock } from "@/components/common/ConcreteClock";
import { concreteClockStore } from "@/lib/concrete-clock";
import { PLANT_NAME } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tv")({
  component: ControlRoomTvPage,
});

const ROTATION_SECONDS = 12;

interface DeliveryTrip {
  id: string;
  tm: string;
  driver: string;
  po: string;
  customer: string;
  site: string;
  grade: string;
  qty: number;
  status: "IN_TRANSIT" | "DISCHARGING" | "QC_APPROVED" | "BATCHING";
  batchTime: string;
}

const LIVE_DELIVERIES: DeliveryTrip[] = [
  {
    id: "TRIP-01",
    tm: "MH-12-RN-1002",
    driver: "Ritesh Shinde",
    po: "PO-01",
    customer: "Wagh Infra Projects",
    site: "Metro Line 3 Pier P14",
    grade: "M35 PUMP",
    qty: 8,
    status: "IN_TRANSIT",
    batchTime: "13:20",
  },
  {
    id: "TRIP-02",
    tm: "MH-12-RN-1003",
    driver: "Santosh Patil",
    po: "PO-02",
    customer: "Kirloskar Infra",
    site: "Hinjewadi IT Park Ph-1",
    grade: "M35 PUMP",
    qty: 8,
    status: "IN_TRANSIT",
    batchTime: "13:45",
  },
  {
    id: "TRIP-03",
    tm: "MH-12-RN-1006",
    driver: "Vikram Sawant",
    po: "PO-03",
    customer: "VTP Realty",
    site: "Pegasus Tower Raft",
    grade: "M25",
    qty: 8,
    status: "DISCHARGING",
    batchTime: "13:10",
  },
  {
    id: "TRIP-04",
    tm: "MH-12-RN-1004",
    driver: "Ganesh Kadam",
    po: "PO-01",
    customer: "Wagh Infra Projects",
    site: "Metro Line 3 Pier P14",
    grade: "M35 PUMP",
    qty: 8,
    status: "QC_APPROVED",
    batchTime: "14:10",
  },
  {
    id: "TRIP-05",
    tm: "MH-12-RN-1001",
    driver: "Dinesh Pawar",
    po: "PO-02",
    customer: "Kirloskar Infra",
    site: "Hinjewadi IT Park Ph-1",
    grade: "M35 PUMP",
    qty: 8,
    status: "BATCHING",
    batchTime: "14:22",
  },
];

const SILO_DATA = [
  { name: "Silo 1: OPC 53 Cement", type: "binder", currentMt: 76.4, capacityMt: 100, unit: "MT", color: "from-blue-600 to-cyan-500", temp: "42°C" },
  { name: "Silo 2: Fly Ash Class F", type: "binder", currentMt: 26.8, capacityMt: 100, unit: "MT", color: "from-amber-500 to-orange-500", warning: true, temp: "38°C" },
  { name: "Silo 3: GGBS (Slag)", type: "binder", currentMt: 44.5, capacityMt: 60, unit: "MT", color: "from-emerald-500 to-teal-500", temp: "36°C" },
  { name: "Bin 1: Aggregate 10mm", type: "aggregate", currentMt: 345, capacityMt: 500, unit: "MT", color: "from-indigo-500 to-blue-500" },
  { name: "Bin 2: Aggregate 20mm", type: "aggregate", currentMt: 492, capacityMt: 600, unit: "MT", color: "from-purple-500 to-indigo-500" },
  { name: "Bin 3: Crushed M-Sand", type: "sand", currentMt: 310, capacityMt: 450, unit: "MT", color: "from-amber-600 to-yellow-500", moisture: "3.2%" },
  { name: "Tank 1: Sika Retarder", type: "admixture", currentMt: 3200, capacityMt: 5000, unit: "L", color: "from-rose-500 to-pink-500" },
  { name: "Tank 2: Water Reservoir", type: "water", currentMt: 86000, capacityMt: 100000, unit: "L", color: "from-cyan-500 to-blue-600" },
];

const FLEET_STATUS = [
  { category: "Available in Yard", count: 4, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", trucks: ["MH-12-RN-1005 (Pawar)", "MH-12-RN-1007 (Jadhav)", "MH-12-RN-1011 (Mane)", "MH-12-RN-1012 (Gaikwad)"] },
  { category: "Under Batching Chute", count: 2, color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10", trucks: ["MH-12-RN-1001 (CRB-75 Plant 1)", "MH-12-RN-1004 (SP-30 Plant 2)"] },
  { category: "In Transit to Site", count: 4, color: "text-amber-400 border-amber-500/30 bg-amber-500/10", trucks: ["MH-12-RN-1002 (Kharadi · 14m Clock!)", "MH-12-RN-1003 (Hinjewadi)", "MH-12-RN-1008 (Wakad)", "MH-12-RN-1010 (Baner)"] },
  { category: "Discharging at Pump", count: 2, color: "text-purple-400 border-purple-500/30 bg-purple-500/10", trucks: ["MH-12-RN-1006 (Pier P14 Pump)", "MH-12-RN-1009 (Pegasus Boom)"] },
  { category: "Returning to Plant", count: 1, color: "text-blue-400 border-blue-500/30 bg-blue-500/10", trucks: ["MH-12-RN-1013 (Empty via Expressway)"] },
  { category: "Maintenance / Wash Bay", count: 1, color: "text-rose-400 border-rose-500/30 bg-rose-500/10", trucks: ["MH-12-RN-1014 (Blade Wash & Grease)"] },
];

function ControlRoomTvPage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState<0 | 1 | 2>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Digital Clock Updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Slide Rotation Timer
  useEffect(() => {
    if (isPaused) return;

    const tickMs = 100;
    const totalTicks = (ROTATION_SECONDS * 1000) / tickMs;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentSlide((curr) => ((curr + 1) % 3) as 0 | 1 | 2);
          return 0;
        }
        return prev + 100 / totalTicks;
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const config = concreteClockStore.getConfig();

  return (
    <div className="min-h-screen w-full bg-[#05070D] text-slate-100 flex flex-col justify-between select-none overflow-hidden font-sans p-4 sm:p-6 lg:p-8">
      {/* Wallboard Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        {/* Left: Plant Name & Live Telemetry */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => void navigate({ to: "/dispatcher" })}
            className="flex size-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Exit TV Mode"
          >
            <ArrowLeft className="size-5" />
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-3 relative">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                {PLANT_NAME} · Control Room
              </h1>
              <Badge className="bg-primary/20 text-primary border-primary/40 font-bold text-xs uppercase px-2.5 py-0.5">
                Wall TV Mode
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
              <span>Plant 1: CRB-75 (ONLINE)</span>
              <span>·</span>
              <span>Plant 2: SP-30 (STANDBY)</span>
              <span>·</span>
              <span className="text-amber-400 flex items-center gap-1 font-semibold">
                <Thermometer className="size-3" />
                {config.ambientTemperatureC}°C Ambient ({config.tempMode})
              </span>
            </p>
          </div>
        </div>

        {/* Right: Big Digital Clock & TV Controls */}
        <div className="flex items-center gap-4 sm:gap-6 justify-between md:justify-end">
          {/* Big Digital Clock */}
          <div className="flex flex-col text-right">
            <span className="text-3xl sm:text-4xl font-mono font-black tracking-wider text-emerald-400 tabular-nums">
              {currentTime || "14:45:00"}
            </span>
            <span className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">
              Indian Standard Time (IST) · Shift A
            </span>
          </div>

          {/* TV Wall Controls */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
              title={isPaused ? "Resume Slide Rotation" : "Pause Rotation"}
            >
              {isPaused ? <Play className="size-4 text-emerald-400" /> : <Pause className="size-4" />}
            </button>
            <button
              onClick={() => setSoundEnabled((s) => !s)}
              className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
              title={soundEnabled ? "Mute Alarms" : "Enable Audio"}
            >
              {soundEnabled ? <Volume2 className="size-4 text-cyan-400" /> : <VolumeX className="size-4" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Rotating Slide Content */}
      <main className="flex-1 my-6 flex flex-col justify-center">
        {/* SLIDE 0: TODAY'S DELIVERY SCHEDULE & CONCRETE CLOCK */}
        {currentSlide === 0 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Clock className="size-6" />
                </span>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                    Delivery Schedule & Live Concrete Clock (IS 4926)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live transit countdown rings. Loaded trucks nearest to initial set jump to priority clearance.
                  </p>
                </div>
              </div>

              <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold px-3 py-1 animate-pulse">
                1 Truck in Flash Set Warning
              </Badge>
            </div>

            {/* Delivery Schedule Table Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {LIVE_DELIVERIES.map((trip) => {
                const isUrgent = trip.id === "TRIP-01";
                return (
                  <div
                    key={trip.id}
                    className={cn(
                      "rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all",
                      isUrgent
                        ? "bg-gradient-to-b from-rose-950/30 to-slate-900 border-rose-500/60 shadow-lg shadow-rose-950/40"
                        : "bg-slate-900/80 border-slate-800"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-white">{trip.tm}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold uppercase",
                              trip.status === "IN_TRANSIT"
                                ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                : trip.status === "DISCHARGING"
                                ? "border-purple-500/40 text-purple-400 bg-purple-500/10"
                                : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                            )}
                          >
                            {trip.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                          Driver: <span className="text-white font-semibold">{trip.driver}</span>
                        </p>
                      </div>

                      {/* Prominent Concrete Clock Ring */}
                      <ConcreteClock
                        trip={{ id: trip.id, grade: trip.grade, tmCode: trip.tm }}
                        variant="compact"
                        showPopover={false}
                      />
                    </div>

                    <div className="space-y-1.5 border-t border-slate-800/80 pt-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Customer:</span>
                        <span className="font-semibold text-white truncate max-w-[180px]">{trip.customer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Destination:</span>
                        <span className="font-medium text-slate-300 truncate max-w-[180px]">{trip.site}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Grade & Qty:</span>
                        <span className="font-bold text-cyan-400 tabular-nums">
                          {trip.grade} · {trip.qty} cum
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SLIDE 1: SILO LEVELS & RAW MATERIAL INVENTORY */}
        {currentSlide === 1 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Factory className="size-6" />
                </span>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                    Silo Telemetry & Raw Material Inventory
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live load cells, silo bins, admixture reservoirs & stockpile storage levels.
                  </p>
                </div>
              </div>

              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-bold px-3 py-1">
                Silo 2 Refill In Progress
              </Badge>
            </div>

            {/* Silo Gauges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {SILO_DATA.map((silo) => {
                const pct = Math.round((silo.currentMt / silo.capacityMt) * 100);
                const isLow = silo.warning || pct < 30;

                return (
                  <div
                    key={silo.name}
                    className={cn(
                      "rounded-2xl border p-4 flex flex-col justify-between gap-3 bg-slate-900/90",
                      isLow ? "border-amber-500/60 shadow-lg shadow-amber-950/20" : "border-slate-800"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-white leading-tight">{silo.name}</span>
                      {isLow && (
                        <Badge variant="destructive" className="text-[9px] uppercase font-bold animate-pulse">
                          Low Refill
                        </Badge>
                      )}
                    </div>

                    {/* Visual Cylinder Gauge Progress */}
                    <div className="space-y-2 py-1">
                      <div className="h-6 w-full rounded-lg bg-slate-950 p-1 border border-slate-800 overflow-hidden">
                        <div
                          className={cn("h-full rounded-md transition-all duration-700 bg-gradient-to-r", silo.color)}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-xl font-black text-white tabular-nums">
                          {silo.currentMt.toLocaleString()}{" "}
                          <span className="text-xs text-slate-400 font-semibold">{silo.unit}</span>
                        </span>
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            isLow ? "text-amber-400" : "text-emerald-400"
                          )}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                      <span>Capacity: {silo.capacityMt.toLocaleString()} {silo.unit}</span>
                      {silo.temp && <span className="font-mono text-cyan-400">{silo.temp}</span>}
                      {silo.moisture && <span className="font-mono text-amber-400">Moist: {silo.moisture}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SLIDE 2: TRANSIT MIXER (TM) FLEET BOARD */}
        {currentSlide === 2 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Truck className="size-6" />
                </span>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                    Transit Mixer (TM) Fleet Board & Availability
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live position of 14 mixers: yard standby, batching, transit, pumping, returning.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-400">12 / 14 Mixers Active</span>
              </div>
            </div>

            {/* Fleet Status Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FLEET_STATUS.map((status) => (
                <div
                  key={status.category}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{status.category}</span>
                    <Badge variant="outline" className={cn("text-xs font-bold px-2 py-0.5", status.color)}>
                      {status.count} TM{status.count > 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <ul className="space-y-2 text-xs">
                    {status.trucks.map((truck) => (
                      <li
                        key={truck}
                        className="flex items-center gap-2 rounded-lg bg-slate-950/70 border border-slate-800/80 px-3 py-2 font-mono text-slate-200"
                      >
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="font-semibold">{truck}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Wallboard Footer & Auto-Rotation Progress Bar */}
      <footer className="space-y-3 border-t border-slate-800/80 pt-4">
        {/* Progress Bar indicating time to next slide */}
        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary via-cyan-400 to-emerald-400 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          {/* Slide Buttons */}
          <div className="flex items-center gap-2">
            {[
              { id: 0, label: "1. Delivery Schedule & Concrete Clock" },
              { id: 1, label: "2. Silos & Inventory" },
              { id: 2, label: "3. Fleet Mixer Status" },
            ].map((slide) => (
              <button
                key={slide.id}
                onClick={() => {
                  setCurrentSlide(slide.id as 0 | 1 | 2);
                  setProgress(0);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                  currentSlide === slide.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                )}
              >
                {slide.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono text-slate-500">
              Auto-rotating every {ROTATION_SECONDS}s · Press Space to pause
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigate({ to: "/dispatcher" })}
              className="h-8 border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs"
            >
              Exit to Dispatcher
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
