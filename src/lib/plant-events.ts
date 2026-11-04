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

// Real plant event stream (no simulated or fake events)
export const INITIAL_PLANT_EVENTS: PlantEvent[] = [];

class PlantEventStore {
  private events: PlantEvent[] = [];
  private listeners: (() => void)[] = [];
  private hasFetched = false;

  constructor() {
    if (typeof window !== "undefined") {
      void this.fetchRealEvents();
    }
  }

  public async fetchRealEvents() {
    if (this.hasFetched) return;
    try {
      const token =
        (typeof window !== "undefined" &&
          (localStorage.getItem("rmc.jwt_token") || localStorage.getItem("token"))) ||
        "";
      if (!token) return;
      const res = await fetch("/api/v1/notifications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const logs = json.data || [];
        const realEvents: PlantEvent[] = [];

        for (const log of logs) {
          const payload = typeof log.payloadData === "object" ? log.payloadData : {};
          const msg = payload.message || payload.text || log.template;
          const time = log.sentAt ? new Date(log.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
          if (msg) {
            realEvents.push({
              id: log.id,
              time: time || "Recent",
              text: msg,
              roles: ["dispatcher", "production", "store", "qa", "sales", "owner", "customer"],
              severity: "info",
              linkTo: log.relatedTripId ? "/dispatcher" : (log.relatedPoId ? "/sales/orders" : undefined),
              tag: "Plant Event",
            });
          }
        }

        if (realEvents.length > 0) {
          this.events = realEvents.slice(0, 30);
          this.notify();
        }
        this.hasFetched = true;
      }
    } catch {
      // Ignore background fetch error
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
}

export const plantEventStore = new PlantEventStore();

export function recordPlantEvent(event: Omit<PlantEvent, "id" | "time"> & { time?: string }) {
  const timeStr = event.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  plantEventStore.addEvent({
    ...event,
    time: timeStr,
  });
}

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
