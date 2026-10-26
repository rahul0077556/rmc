import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, Flame, ShieldAlert, Sparkles, Settings2, CheckCircle2, Info } from "lucide-react";
import {
  getConcreteClockState,
  calculateDischargeLimitMinutes,
  concreteClockStore,
  type ConcreteClockConfig,
  type ConcreteClockState,
  type AmbientTempMode,
  type AdmixtureMode,
} from "@/lib/concrete-clock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ConcreteClockProps {
  trip: {
    id?: string;
    grade?: string;
    batchTime?: string;
    dispatchTime?: string;
    plannedTime?: string;
    lastUpdate?: string;
    sequence?: number;
    tmCode?: string;
  };
  variant?: "compact" | "card" | "mini";
  showPopover?: boolean;
  className?: string;
}

export function ConcreteClock({
  trip,
  variant = "compact",
  showPopover = true,
  className,
}: ConcreteClockProps) {
  // Live tick state to recalculate every 5 seconds
  const [now, setNow] = useState(Date.now());
  const [config, setConfig] = useState<ConcreteClockConfig>(concreteClockStore.getConfig());

  useEffect(() => {
    const unsub = concreteClockStore.subscribe(() => {
      setConfig(concreteClockStore.getConfig());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const clock = getConcreteClockState(trip, config);

  // SVG Radial Ring Metrics
  const radius = variant === "card" ? 44 : variant === "mini" ? 12 : 16;
  const stroke = variant === "card" ? 7 : variant === "mini" ? 2.5 : 3.5;
  const circumference = 2 * Math.PI * radius;
  // Invert progress so ring depletes as time elapses
  const strokeDashoffset = circumference * clock.progress;

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-2 select-none",
        clock.status === "expired" && "animate-pulse",
        className
      )}
    >
      {/* Radial Countdown Ring */}
      <div className="relative inline-flex items-center justify-center">
        <svg
          className={cn(
            "transform -rotate-90",
            variant === "card" ? "h-26 w-26" : variant === "mini" ? "h-7 w-7" : "h-9 w-9"
          )}
        >
          {/* Track background */}
          <circle
            cx={variant === "card" ? 52 : variant === "mini" ? 14 : 18}
            cy={variant === "card" ? 52 : variant === "mini" ? 14 : 18}
            r={radius}
            className="stroke-muted/40"
            strokeWidth={stroke}
            fill="transparent"
          />
          {/* Dynamic Progress Meter */}
          <circle
            cx={variant === "card" ? 52 : variant === "mini" ? 14 : 18}
            cy={variant === "card" ? 52 : variant === "mini" ? 14 : 18}
            r={radius}
            stroke={clock.statusColor}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-in-out"
          />
        </svg>

        {/* Center icon / countdown */}
        <div className="absolute inset-0 flex items-center justify-center">
          {variant === "card" ? (
            <div className="text-center">
              <span
                className="text-sm font-bold tracking-tight block"
                style={{ color: clock.statusColor }}
              >
                {clock.formattedRemaining}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                {clock.status === "expired" ? "Overdue" : "Discharge"}
              </span>
            </div>
          ) : clock.status === "expired" ? (
            <ShieldAlert className="h-3.5 w-3.5 text-rose-500 animate-bounce" />
          ) : clock.status === "critical" ? (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          ) : clock.status === "warning" ? (
            <Flame className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <Clock className="h-3 w-3 text-emerald-500" />
          )}
        </div>
      </div>

      {/* Text Label Pill (for compact and card variants) */}
      {variant !== "mini" && (
        <div className="flex flex-col text-left min-w-[130px] shrink-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={cn(
                "text-xs font-semibold tabular-nums tracking-tight whitespace-nowrap",
                clock.status === "expired" && "text-rose-500 font-bold",
                clock.status === "critical" && "text-rose-500 font-bold",
                clock.status === "warning" && "text-amber-500",
                clock.status === "healthy" && "text-emerald-500"
              )}
            >
              {clock.formattedRemaining}
            </span>

            {clock.status === "critical" && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[9px] font-bold uppercase tracking-wider animate-pulse whitespace-nowrap shrink-0 bg-rose-600/90 text-white">
                Expiring
              </Badge>
            )}
            {clock.status === "expired" && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 bg-rose-600 text-white shadow-sm border border-rose-400/40">
                Flash Set Risk
              </Badge>
            )}
          </div>

          <span className="text-[10px] text-muted-foreground/80 leading-tight whitespace-nowrap">
            Before {clock.formattedDischargeBefore}
          </span>
        </div>
      )}
    </div>
  );

  if (!showPopover) return content;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded-lg p-0.5 hover:bg-muted/50 focus:outline-none transition-colors"
          title="Click to view Concrete Clock & Hydration details"
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-80 p-4 shadow-xl border-border bg-card/95 backdrop-blur-md">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${clock.statusColor}20` }}
              >
                <Clock className="h-4 w-4" style={{ color: clock.statusColor }} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Concrete Clock (IS 4926)</h4>
                <p className="text-[10px] text-muted-foreground">Workability & Initial Setting Timer</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ borderColor: `${clock.statusColor}40`, color: clock.statusColor }}
            >
              {clock.status}
            </Badge>
          </div>

          {/* Time Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/40">
            <div>
              <span className="text-[10px] text-muted-foreground block">Batched at Plant</span>
              <span className="font-semibold text-foreground">{clock.formattedBatchTime}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Discharge Deadline</span>
              <span className="font-semibold" style={{ color: clock.statusColor }}>
                {clock.formattedDischargeBefore}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Elapsed Time</span>
              <span className="font-mono text-muted-foreground">{clock.elapsedMinutes} mins</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Remaining Safe Window</span>
              <span className="font-mono font-semibold" style={{ color: clock.statusColor }}>
                {clock.remainingMinutes} mins
              </span>
            </div>
          </div>

          {/* Technical Adjustment Factors */}
          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Mix Grade:</span>
              <span className="font-medium text-foreground">{trip.grade || "M25 Standard"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Ambient Temp:</span>
              <span className="font-medium text-foreground">{config.ambientTemperatureC}°C ({config.tempMode})</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Admixture:</span>
              <span className="font-medium text-foreground capitalize">
                {config.admixtureMode.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-border/40 font-semibold text-foreground">
              <span>Total Safe Window:</span>
              <span>{clock.totalLimitMinutes} minutes</span>
            </div>
          </div>

          {/* IS Standard Note */}
          <p className="text-[10px] text-muted-foreground/75 leading-tight italic bg-primary/5 p-2 rounded border border-primary/10">
            IS 4926 Clause 7.2 requires concrete discharge within 120 minutes of batching (extendable with approved retarders). Discharging past limit causes severe slump loss and cold joints.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Plant Climate & Admixture Adjuster Panel
 * Allows Dispatchers and Lab Techs to configure ambient temperature and admixture offsets globally
 */
export function ConcreteClockConfigModal() {
  const [config, setConfig] = useState<ConcreteClockConfig>(concreteClockStore.getConfig());
  const [open, setOpen] = useState(false);

  const handleTempChange = (temp: number) => {
    let mode: AmbientTempMode = "normal";
    if (temp < 25) mode = "cool";
    else if (temp > 37) mode = "extreme_summer";
    else if (temp > 32) mode = "warm";
    
    concreteClockStore.updateConfig({ ambientTemperatureC: temp, tempMode: mode });
    setConfig(concreteClockStore.getConfig());
  };

  const handleAdmixtureChange = (mode: AdmixtureMode) => {
    concreteClockStore.updateConfig({ admixtureMode: mode });
    setConfig(concreteClockStore.getConfig());
  };

  const sampleLimit = calculateDischargeLimitMinutes("M25", config);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs font-medium border-border/80 bg-surface-raised hover:bg-muted"
          title="Configure Concrete Clock parameters (ambient temp, admixture, base limit)"
        >
          <Settings2 className="h-3.5 w-3.5 text-primary" />
          <span>Clock Settings: {config.ambientTemperatureC}°C</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-84 p-4 shadow-xl border-border bg-card">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div>
              <h4 className="text-xs font-bold text-foreground">Concrete Clock Configuration</h4>
              <p className="text-[10px] text-muted-foreground">Adjust hydration limits by climate & retarder</p>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-bold text-primary">
              ~{sampleLimit} mins limit
            </Badge>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <Label className="text-xs font-medium">Plant Ambient Temperature</Label>
              <span className="font-bold text-primary">{config.ambientTemperatureC}°C</span>
            </div>
            <Slider
              value={[config.ambientTemperatureC]}
              min={18}
              max={45}
              step={1}
              onValueChange={([val]) => handleTempChange(val)}
              className="py-1"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Cool (18°C)</span>
              <span>Baseline (30°C)</span>
              <span>Extreme Summer (45°C)</span>
            </div>
          </div>

          {/* Admixture Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Batching Admixture / Retarder</Label>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {[
                { id: "standard", label: "Normal Plasticizer", offset: "0 min" },
                { id: "retarder", label: "Set Retarder (Sika)", offset: "+35 min" },
                { id: "extended_retarder", label: "Extended Transit", offset: "+60 min" },
                { id: "accelerator", label: "Rapid Setting", offset: "-30 min" },
              ].map((adm) => (
                <button
                  key={adm.id}
                  type="button"
                  onClick={() => handleAdmixtureChange(adm.id as AdmixtureMode)}
                  className={cn(
                    "flex flex-col text-left p-2 rounded-lg border transition-all",
                    config.admixtureMode === adm.id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border/60 hover:bg-muted text-muted-foreground"
                  )}
                >
                  <span className="leading-tight">{adm.label}</span>
                  <span className="text-[10px] opacity-80">{adm.offset}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/40 flex justify-between items-center text-[10px] text-muted-foreground">
            <span>Updates all live truck rings</span>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
