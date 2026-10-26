import { useState, useEffect } from "react";
import type { Role } from "@/types";

export type EventSeverity = "info" | "success" | "warning" | "critical";

export interface PlantEvent {
  id: string;
  time: string;
  text: string;
  roles: Role[];
  severity: EventSeverity;
  linkTo?: string;
  tag?: string;
}

// Initial realistic baseline event stream for the plant shift
export const INITIAL_PLANT_EVENTS: PlantEvent[] = [
  {
    id: "evt-01",
    time: "10:42",
    text: "TM 3511 loaded 8 cum M35 at Batch Plant 1 (CRB-75)",
    roles: ["dispatcher", "production", "owner"],
    severity: "info",
    linkTo: "/dispatcher",
    tag: "Batching",
  },
  {
    id: "evt-02",
    time: "10:45",
    text: "BS-0042 QC approved: Slump 135mm (Pass · Target 140±25mm)",
    roles: ["qa", "dispatcher", "owner"],
    severity: "success",
    linkTo: "/qa",
    tag: "QC Pass",
  },
  {
    id: "evt-03",
    time: "10:48",
    text: "TM MH-12-RN-1002 e-Challan CH-1002 issued · Gate exit to Hinjewadi",
    roles: ["dispatcher", "store", "owner"],
    severity: "info",
    linkTo: "/dispatcher",
    tag: "Dispatch",
  },
  {
    id: "evt-04",
    time: "10:52",
    text: "Weighbridge 1: Tipper MH-14-AZ-4412 Tare captured (14,220 kg · Net: 28,630 kg Aggregate 20mm)",
    roles: ["store", "owner"],
    severity: "success",
    linkTo: "/store",
    tag: "Weighbridge",
  },
  {
    id: "evt-05",
    time: "11:05",
    text: "Silo Bin 2 (OPC 53 Cement) level below 28 MT threshold · Refill bulker at gate",
    roles: ["production", "store", "owner"],
    severity: "warning",
    linkTo: "/store",
    tag: "Silo Stock",
  },
  {
    id: "evt-06",
    time: "11:18",
    text: "Commercial Approval: PO #PO-04 (Rohan Builders · 200 cum M40) approved by Sales Manager",
    roles: ["sales", "sales_manager", "owner"],
    severity: "success",
    linkTo: "/sales/orders",
    tag: "Commercial",
  },
  {
    id: "evt-07",
    time: "11:28",
    text: "Concrete Clock Warning: TM MH-12-RN-1002 remaining workability: 24 mins",
    roles: ["dispatcher", "owner"],
    severity: "warning",
    linkTo: "/dispatcher",
    tag: "Concrete Clock",
  },
  {
    id: "evt-08",
    time: "11:35",
    text: "IS 516 Lab: Set CUBE-104 (M25 7-Day) broke at 22.8 MPa (88% of 28D · Specification Pass)",
    roles: ["qa", "owner"],
    severity: "success",
    linkTo: "/qa",
    tag: "Cube Test",
  },
  {
    id: "evt-09",
    time: "11:42",
    text: "Driver Payroll: October trip incentives tallied for 14 drivers (462 completed trips)",
    roles: ["account", "owner"],
    severity: "info",
    linkTo: "/account",
    tag: "Payroll",
  },
  {
    id: "evt-10",
    time: "11:50",
    text: "Customer Portal: Kirloskar Infra Metro Pier P14 pour verified (Signed Challan CH-0994)",
    roles: ["customer", "dispatcher", "owner"],
    severity: "success",
    linkTo: "/portal",
    tag: "Delivery",
  },
];

class PlantEventStore {
  private events: PlantEvent[] = [...INITIAL_PLANT_EVENTS];
  private listeners: (() => void)[] = [];

  constructor() {
    // Periodically append simulated plant events to give a living, breathing pulse
    if (typeof window !== "undefined") {
      setInterval(() => {
        this.addRandomEvent();
      }, 35000);
    }
  }

  public getEvents(userRole?: Role): PlantEvent[] {
    if (!userRole || userRole === "owner") return this.events;
    return this.events.filter((e) => e.roles.includes(userRole));
  }

  public addEvent(event: Omit<PlantEvent, "id">) {
    const newEvent: PlantEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    this.events = [newEvent, ...this.events].slice(0, 30);
    this.notify();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private addRandomEvent() {
    const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    const nowTime = new Date().toLocaleTimeString([], timeOptions);

    const simulationBank: Omit<PlantEvent, "id" | "time">[] = [
      {
        text: "TM MH-12-RN-1003 slump inspection passed (140mm) · Gate pass issued",
        roles: ["dispatcher", "qa", "owner"],
        severity: "success",
        linkTo: "/dispatcher",
        tag: "QC Pass",
      },
      {
        text: "UltraTech OPC 53 Cement Bulker (32.4 MT) commenced pneumatic decanting into Silo 2",
        roles: ["store", "production", "owner"],
        severity: "info",
        linkTo: "/store",
        tag: "Silo Refill",
      },
      {
        text: "Batch Plant 1: Recipe M30_FLYASH_PUMP batch completed in 3m 48s",
        roles: ["production", "dispatcher", "owner"],
        severity: "info",
        linkTo: "/production",
        tag: "Batch Done",
      },
      {
        text: "Weighbridge 2: Inward M-Sand (Crushed Sand) gross weighed 38,400 kg",
        roles: ["store", "owner"],
        severity: "info",
        linkTo: "/store",
        tag: "Weighbridge",
      },
      {
        text: "Trip TRIP-03 marked delivered by receiver at VTP Pegasus Site (8 cum M25)",
        roles: ["dispatcher", "account", "owner", "customer"],
        severity: "success",
        linkTo: "/dispatcher",
        tag: "Delivered",
      },
    ];

    const pick = simulationBank[Math.floor(Math.random() * simulationBank.length)]!;
    this.addEvent({
      ...pick,
      time: nowTime,
    });
  }
}

export const plantEventStore = new PlantEventStore();

export function usePlantEvents(role?: Role) {
  const [events, setEvents] = useState<PlantEvent[]>(() => plantEventStore.getEvents(role));

  useEffect(() => {
    setEvents(plantEventStore.getEvents(role));
    const unsub = plantEventStore.subscribe(() => {
      setEvents(plantEventStore.getEvents(role));
    });
    return unsub;
  }, [role]);

  return events;
}
