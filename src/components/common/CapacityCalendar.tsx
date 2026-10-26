import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Layers,
  Truck,
  Plus,
  RefreshCw,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  get14DayCapacity,
  checkDeliveryCapacity,
  type DayCapacity,
  type DeliveryCheckResult,
} from "@/lib/capacity-data";
import { GRADES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function CapacityCalendar({
  compact = false,
  onSelectSlot,
}: {
  compact?: boolean;
  onSelectSlot?: (date: string, qty: number) => void;
}) {
  const navigate = useNavigate();
  const schedule = useMemo(() => get14DayCapacity(), []);

  // Form State for "Can we deliver this?"
  const [selectedDate, setSelectedDate] = useState<string>(schedule[0]?.date ?? "");
  const [quantity, setQuantity] = useState<number>(32);
  const [grade, setGrade] = useState<string>("M25");
  const [timeWindow, setTimeWindow] = useState<string>("Morning (07:00 - 12:00)");

  // Run live delivery check
  const checkResult: DeliveryCheckResult = useMemo(() => {
    return checkDeliveryCapacity(selectedDate, quantity, timeWindow);
  }, [selectedDate, quantity, timeWindow]);

  const selectedDay = useMemo(() => {
    return schedule.find((s) => s.date === selectedDate) ?? schedule[0]!;
  }, [schedule, selectedDate]);

  // Quick quantity buttons
  const quickQuantities = [16, 24, 32, 48, 64, 96];

  const handleApplySlot = (date: string) => {
    setSelectedDate(date);
  };

  const handleBookOrder = () => {
    if (onSelectSlot) {
      onSelectSlot(selectedDate, quantity);
    } else {
      void navigate({
        to: "/sales/orders/new",
        search: () => ({
          date: selectedDate,
          qty: quantity,
          grade,
        }),
      });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
      {/* Header Bar */}
      <div className="border-b border-border bg-surface-raised/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  14-Day Capacity Calendar & Delivery Slot Planner
                </h3>
                <Badge variant="outline" className="text-[11px] font-semibold border-primary/30 text-primary bg-primary/5">
                  CRB-75 + SP-30 (850 cum/day)
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time plant slot allocation: booked cubic metres against rated capacity with live slot recommendations.
              </p>
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500 shadow-xs" />
              <span className="text-muted-foreground">Open (&lt;70%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500 shadow-xs" />
              <span className="text-muted-foreground">Tight (70-90%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500 shadow-xs" />
              <span className="text-muted-foreground font-semibold">Overbooked (&gt;90%)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {/* ============================================================== */}
        {/* 14-DAY CALENDAR GRID */}
        {/* ============================================================== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Delivery Date (Next 14 Days Rolling Window)
            </h4>
            <span className="text-xs text-muted-foreground">
              Tap any date to check capacity or inspect shift slots
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {schedule.map((day) => {
              const isSelected = day.date === selectedDate;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={cn(
                    "text-left p-3 rounded-xl border transition-all duration-200 relative flex flex-col justify-between group",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40 -translate-y-0.5"
                      : "border-border/80 bg-background hover:bg-surface-raised hover:border-border"
                  )}
                >
                  {/* Relative Badge */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-primary text-primary-foreground">
                        Today
                      </span>
                    )}
                    {day.isTomorrow && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-primary/15 text-primary">
                        Tomorrow
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-sm sm:text-base font-bold text-foreground">
                      {day.displayDate}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                        day.status === "open" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                        day.status === "tight" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                        day.status === "overbooked" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-extrabold animate-pulse"
                      )}
                    >
                      {day.utilizationPercent}%
                    </span>
                  </div>

                  {/* Meter Bar */}
                  <div className="mt-2.5 space-y-1">
                    <div className="w-full bg-border/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          day.status === "open" && "bg-emerald-500",
                          day.status === "tight" && "bg-amber-500",
                          day.status === "overbooked" && "bg-rose-500"
                        )}
                        style={{ width: `${Math.min(100, day.utilizationPercent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>{day.bookedCum} cum</span>
                      <span className={cn(
                        day.availableCum > 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-500 font-bold"
                      )}>
                        {day.availableCum > 0 ? `+${day.availableCum}` : "0"} open
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* INTERACTIVE "CAN WE DELIVER THIS?" VALIDATOR */}
        {/* ============================================================== */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                ?
              </span>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  Can we deliver this? (Live Slot Validator)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Test quantity and grade against live booked capacity for {selectedDay.dayName}, {selectedDay.displayDate}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Selected Date:</span>
              <Badge variant="outline" className="font-bold border-primary/40 bg-background text-foreground">
                {selectedDay.dayName}, {selectedDay.displayDate} ({selectedDay.bookedCum}/850 cum booked)
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Quantity Input */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Concrete Quantity (cum)</Label>
              <div className="mt-1.5 relative">
                <Input
                  type="number"
                  min={1}
                  max={600}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                  className="bg-background text-sm font-bold pr-12"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium pointer-events-none">
                  cum
                </span>
              </div>
              {/* Quick pills */}
              <div className="mt-2 flex flex-wrap gap-1">
                {quickQuantities.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuantity(q)}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                      quantity === q
                        ? "bg-primary text-primary-foreground border-primary font-bold"
                        : "bg-background border-border text-muted-foreground hover:bg-surface-raised"
                    )}
                  >
                    {q} cum ({Math.ceil(q / 8)} TMs)
                  </button>
                ))}
              </div>
            </div>

            {/* Concrete Grade */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Mix Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="mt-1.5 bg-background text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g} className="text-xs font-medium">
                      {g} Concrete
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Target slump: 120-150mm · Batch Plant 1 (CRB-75)
              </p>
            </div>

            {/* Preferred Shift Window */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Preferred Time Window</Label>
              <Select value={timeWindow} onValueChange={setTimeWindow}>
                <SelectTrigger className="mt-1.5 bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Morning (07:00 - 12:00)">Morning (07:00 - 12:00)</SelectItem>
                  <SelectItem value="Afternoon (12:00 - 17:00)">Afternoon (12:00 - 17:00)</SelectItem>
                  <SelectItem value="Night (17:00 - 22:00)">Night (17:00 - 22:00)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Peak morning rush: 08:30 – 11:30 AM
              </p>
            </div>

            {/* Target Delivery Date */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Delivery Date</Label>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="mt-1.5 bg-background text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schedule.map((s) => (
                    <SelectItem key={s.date} value={s.date} className="text-xs">
                      {s.dayName}, {s.displayDate} ({s.status.toUpperCase()} · {s.bookedCum} cum)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                14-day rolling window
              </p>
            </div>
          </div>

          {/* ============================================================== */}
          {/* VERDICT BOX: "CAN WE DELIVER THIS?" */}
          {/* ============================================================== */}
          <div className="mt-4 pt-4 border-t border-primary/20">
            <div
              className={cn(
                "rounded-xl border p-4 transition-all duration-300",
                checkResult.status === "confirmed" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
                checkResult.status === "tight" && "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
                checkResult.status === "overbooked" && "border-rose-500/40 bg-rose-500/10 text-rose-950 dark:text-rose-100"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {checkResult.status === "confirmed" && (
                    <CheckCircle2 className="size-6 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  {checkResult.status === "tight" && (
                    <AlertTriangle className="size-6 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  {checkResult.status === "overbooked" && (
                    <XCircle className="size-6 text-rose-500 shrink-0 mt-0.5" />
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold">
                        {checkResult.status === "confirmed" && "YES! We Can Deliver This Order"}
                        {checkResult.status === "tight" && "PARTIAL / TIGHT: Pre-Booking Required"}
                        {checkResult.status === "overbooked" && "CAPACITY WARNING: Day Overbooked"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold border",
                          checkResult.status === "confirmed" && "border-emerald-500/40 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                          checkResult.status === "tight" && "border-amber-500/40 bg-amber-500/20 text-amber-600 dark:text-amber-400",
                          checkResult.status === "overbooked" && "border-rose-500/40 bg-rose-500/20 text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {checkResult.newUtilization}% Post-Booking Load
                      </Badge>
                    </div>

                    <p className="text-xs sm:text-sm mt-1 text-foreground/90 leading-relaxed font-medium">
                      {checkResult.message}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono">
                        <Truck className="size-3.5 text-primary" />
                        Requires: {Math.ceil(quantity / 8)} Transit Mixers (8 cum avg)
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5 text-primary" />
                        Recommended Chute: <strong className="text-foreground">{checkResult.recommendedSlotWindow}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={handleBookOrder}
                    className={cn(
                      "gap-2 font-semibold shadow-md",
                      checkResult.status === "overbooked"
                        ? "bg-rose-600 hover:bg-rose-700 text-white"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    )}
                  >
                    <span>{checkResult.status === "overbooked" ? "Override & Raise PO" : "Book This Slot ➔"}</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Nearest Open Slot Suggestions (Crucial requirement!) */}
              {checkResult.status !== "confirmed" && checkResult.nearestOpenSlots.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Sparkles className="size-3.5 text-amber-500" />
                      Suggested Nearest Open Slots:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {checkResult.nearestOpenSlots.map((slot) => (
                        <button
                          key={slot.date}
                          type="button"
                          onClick={() => handleApplySlot(slot.date)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors"
                        >
                          <span className="font-bold">{slot.dayName}, {slot.displayDate}</span>
                          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-mono">
                            (+{slot.availableCum} cum open · {slot.utilizationPercent}%)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SHIFT BREAKDOWN FOR SELECTED DAY */}
        {/* ============================================================== */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center justify-between">
            <span>Shift Chute Breakdown for {selectedDay.dayName}, {selectedDay.displayDate}</span>
            <span className="font-mono text-xs text-foreground font-semibold">
              Total {selectedDay.bookedCum} / {selectedDay.totalCapacityCum} cum ({selectedDay.utilizationPercent}%)
            </span>
          </h4>

          <div className="grid gap-3 sm:grid-cols-3">
            {selectedDay.slots.map((slot) => (
              <div
                key={slot.timeWindow}
                className={cn(
                  "p-3.5 rounded-xl border bg-background/80",
                  slot.status === "open" && "border-emerald-500/20",
                  slot.status === "tight" && "border-amber-500/20",
                  slot.status === "overbooked" && "border-rose-500/30 bg-rose-500/5"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-foreground">{slot.timeWindow}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1.5 py-0.2 uppercase font-bold",
                      slot.status === "open" && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5",
                      slot.status === "tight" && "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5",
                      slot.status === "overbooked" && "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/5"
                    )}
                  >
                    {slot.status}
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-mono font-bold text-foreground">
                    {slot.bookedCum} <span className="text-xs text-muted-foreground font-normal">/ {slot.capacityCum} cum</span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    +{slot.availableCum} cum open
                  </span>
                </div>

                <Progress
                  value={Math.round((slot.bookedCum / slot.capacityCum) * 100)}
                  className={cn(
                    "mt-2 h-1.5",
                    slot.status === "open" && "[&>div]:bg-emerald-500",
                    slot.status === "tight" && "[&>div]:bg-amber-500",
                    slot.status === "overbooked" && "[&>div]:bg-rose-500"
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
