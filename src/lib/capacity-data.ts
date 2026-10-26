import { addDays, format, isSameDay } from "date-fns";
import { db } from "@/lib/store";
import type { Grade } from "@/types";

export interface DayCapacity {
  date: string; // yyyy-MM-dd
  displayDate: string; // e.g. "27 Oct"
  dayName: string; // e.g. "Mon"
  isToday: boolean;
  isTomorrow: boolean;
  totalCapacityCum: number; // Nominal plant capacity (e.g. 850 cum)
  bookedCum: number;
  availableCum: number;
  utilizationPercent: number;
  status: "open" | "tight" | "overbooked"; // green (<70%), amber (70-90%), red (>90%)
  slots: {
    timeWindow: "Morning (07:00 - 12:00)" | "Afternoon (12:00 - 17:00)" | "Night (17:00 - 22:00)";
    capacityCum: number;
    bookedCum: number;
    availableCum: number;
    status: "open" | "tight" | "overbooked";
  }[];
}

export interface DeliveryCheckResult {
  canDeliver: boolean;
  status: "confirmed" | "tight" | "overbooked";
  requestedDate: string;
  requestedQty: number;
  currentBooked: number;
  newBooked: number;
  capacity: number;
  currentUtilization: number;
  newUtilization: number;
  message: string;
  recommendedSlotWindow: string;
  nearestOpenSlots: {
    date: string;
    displayDate: string;
    dayName: string;
    availableCum: number;
    utilizationPercent: number;
    status: "open" | "tight";
  }[];
}

const PLANT_DAILY_CAPACITY = 850; // 75 cum/hr (CRB-75) + 30 cum/hr (SP-30) across 2 shifts

// Deterministic seed offsets for 14-day rolling schedule
const SEED_BOOKINGS = [720, 480, 810, 560, 780, 350, 620, 840, 410, 530, 710, 390, 280, 490];

export function get14DayCapacity(): DayCapacity[] {
  const today = new Date();
  const schedule: DayCapacity[] = [];

  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    const dateStr = format(d, "yyyy-MM-dd");
    const displayDate = format(d, "d MMM");
    const dayName = format(d, "EEE");

    // Gather actual booked orders for this date if present
    const actualOrders = db.purchaseOrders.filter((po) => po.deliveryDate === dateStr);
    const actualBooked = actualOrders.reduce((sum, po) => sum + po.quantity, 0);

    // Baseline from realistic shift simulation
    const simulatedBooked = SEED_BOOKINGS[i % SEED_BOOKINGS.length]!;
    const totalBooked = Math.min(PLANT_DAILY_CAPACITY + 80, Math.max(actualBooked, simulatedBooked));
    const available = Math.max(0, PLANT_DAILY_CAPACITY - totalBooked);
    const util = Math.round((totalBooked / PLANT_DAILY_CAPACITY) * 100);

    let status: "open" | "tight" | "overbooked" = "open";
    if (util >= 90) status = "overbooked";
    else if (util >= 70) status = "tight";

    // Split into 3 shift windows
    const morningBooked = Math.round(totalBooked * 0.45);
    const afternoonBooked = Math.round(totalBooked * 0.35);
    const nightBooked = totalBooked - morningBooked - afternoonBooked;

    schedule.push({
      date: dateStr,
      displayDate,
      dayName,
      isToday: i === 0,
      isTomorrow: i === 1,
      totalCapacityCum: PLANT_DAILY_CAPACITY,
      bookedCum: totalBooked,
      availableCum: available,
      utilizationPercent: util,
      status,
      slots: [
        {
          timeWindow: "Morning (07:00 - 12:00)",
          capacityCum: 380,
          bookedCum: morningBooked,
          availableCum: Math.max(0, 380 - morningBooked),
          status: morningBooked >= 340 ? "overbooked" : morningBooked >= 265 ? "tight" : "open",
        },
        {
          timeWindow: "Afternoon (12:00 - 17:00)",
          capacityCum: 300,
          bookedCum: afternoonBooked,
          availableCum: Math.max(0, 300 - afternoonBooked),
          status: afternoonBooked >= 270 ? "overbooked" : afternoonBooked >= 210 ? "tight" : "open",
        },
        {
          timeWindow: "Night (17:00 - 22:00)",
          capacityCum: 170,
          bookedCum: nightBooked,
          availableCum: Math.max(0, 170 - nightBooked),
          status: nightBooked >= 155 ? "overbooked" : nightBooked >= 120 ? "tight" : "open",
        },
      ],
    });
  }

  return schedule;
}

export function checkDeliveryCapacity(
  targetDate: string,
  quantityCum: number,
  preferredTimeWindow?: string
): DeliveryCheckResult {
  const schedule = get14DayCapacity();
  const day = schedule.find((s) => s.date === targetDate) ?? schedule[0]!;

  const qty = Number(quantityCum) || 0;
  const currentBooked = day.bookedCum;
  const newBooked = currentBooked + qty;
  const capacity = day.totalCapacityCum;
  const currentUtil = day.utilizationPercent;
  const newUtil = Math.round((newBooked / capacity) * 100);

  // Status calculation
  let status: "confirmed" | "tight" | "overbooked" = "confirmed";
  let canDeliver = true;
  let message = "";

  if (newUtil > 95) {
    status = "overbooked";
    canDeliver = false;
    message = `⚠️ Plant Over Capacity! Adding ${qty} cum on ${day.displayDate} pushes load to ${newUtil}% (${newBooked}/${capacity} cum). Batching delay risk is severe.`;
  } else if (newUtil > 75) {
    status = "tight";
    canDeliver = true;
    message = `🟡 Tight Delivery Window. ${day.displayDate} will reach ${newUtil}% capacity (${newBooked}/${capacity} cum). Mixer dispatch must be strictly pre-booked.`;
  } else {
    status = "confirmed";
    canDeliver = true;
    message = `✅ Slot Available! We can deliver ${qty} cum on ${day.displayDate}. Load will be an optimal ${newUtil}% (${newBooked}/${capacity} cum).`;
  }

  // Recommended slot
  const openSlot = day.slots.find((s) => s.availableCum >= qty) ?? day.slots[0]!;
  const recommendedSlotWindow = `${openSlot.timeWindow} (Batch Plant 1 CRB-75 Chute)`;

  // Find nearest open alternative dates (status === "open" and enough remaining capacity)
  const nearestOpenSlots = schedule
    .filter((s) => s.date !== targetDate && s.availableCum >= qty && s.status !== "overbooked")
    .slice(0, 3)
    .map((s) => ({
      date: s.date,
      displayDate: s.displayDate,
      dayName: s.dayName,
      availableCum: s.availableCum,
      utilizationPercent: s.utilizationPercent,
      status: s.status as "open" | "tight",
    }));

  return {
    canDeliver,
    status,
    requestedDate: targetDate,
    requestedQty: qty,
    currentBooked,
    newBooked,
    capacity,
    currentUtilization: currentUtil,
    newUtilization: newUtil,
    message,
    recommendedSlotWindow,
    nearestOpenSlots,
  };
}
