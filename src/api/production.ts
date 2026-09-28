import { respond } from "./client";
import { db, poById, recordAudit } from "@/lib/store";
import { MIX_DESIGN } from "@/lib/mock-data";
import { decorateTrip, type TripRow } from "./trips";
import type { ApiResponse, BatchSheet, Grade, MaterialLine } from "@/types";

export interface MaterialCheckRow {
  material: string;
  required: number;
  available: number;
  unit: string;
  sufficient: boolean;
  shortfall: number;
}

export function requirementFor(grade: Grade, quantity: number): MaterialCheckRow[] {
  return MIX_DESIGN[grade].map((m) => {
    const required = Math.round(m.perCum * quantity * 10) / 10;
    const stock = db.materialStock.find((s) => s.material === m.material);
    const available = stock?.available ?? 0;
    return {
      material: m.material,
      required,
      available,
      unit: m.unit,
      sufficient: available >= required,
      shortfall: Math.max(0, Math.round((required - available) * 10) / 10),
    };
  });
}

export const productionApi = {
  queue(): Promise<ApiResponse<TripRow[]>> {
    return respond(
      db.trips
        .filter((t) => ["SENT_TO_PRODUCTION", "BATCHING", "LOADED", "QC_PENDING", "PLANNED"].includes(t.status))
        .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime))
        .map(decorateTrip),
    );
  },

  materialCheck(tripId: string): Promise<ApiResponse<MaterialCheckRow[]>> {
    const trip = db.trips.find((t) => t.id === tripId);
    const po = trip ? poById(trip.poId) : undefined;
    if (!trip || !po) return respond([]);
    return respond(requirementFor(po.grade, trip.quantity));
  },

  startBatching(tripId: string, actor: string): Promise<ApiResponse<TripRow | null>> {
    const trip = db.trips.find((t) => t.id === tripId);
    if (trip) {
      trip.status = "BATCHING";
      trip.lastUpdate = new Date().toISOString();
      recordAudit(actor, `started batching for ${trip.tripNumber}`, trip.tripNumber);
    }
    return respond(trip ? decorateTrip(trip) : null, "Batching started");
  },

  confirmLoaded(tripId: string, actor: string): Promise<ApiResponse<BatchSheet | null>> {
    const trip = db.trips.find((t) => t.id === tripId);
    const po = trip ? poById(trip.poId) : undefined;
    if (!trip || !po) return respond(null);

    const materials: MaterialLine[] = MIX_DESIGN[po.grade].map((m) => {
      const theoretical = Math.round(m.perCum * trip.quantity * 10) / 10;
      const actual = Math.round(theoretical * (1 + (Math.random() * 0.014 - 0.006)) * 10) / 10;
      return { material: m.material, unit: m.unit, theoretical, actual };
    });

    const batchNumber = `BS-2026-${String(db.batchSheets.length + 1).padStart(5, "0")}`;
    const sheet: BatchSheet = {
      id: batchNumber,
      batchNumber,
      tripId,
      materials,
      batchTime: new Date().toISOString(),
      operator: actor,
      qcStatus: "PENDING",
    };
    db.batchSheets.push(sheet);
    trip.batchSheetId = batchNumber;
    trip.status = "QC_PENDING";
    trip.lastUpdate = new Date().toISOString();

    materials.forEach((m) => {
      const stock = db.materialStock.find((s) => s.material === m.material);
      if (stock) stock.available = Math.max(0, Math.round((stock.available - m.actual) * 10) / 10);
    });

    recordAudit(actor, `generated Batch Sheet ${batchNumber}`, batchNumber);
    return respond(sheet, "Batch sheet generated");
  },

  batchSheet(id: string): Promise<ApiResponse<(BatchSheet & { trip: TripRow }) | null>> {
    const sheet = db.batchSheets.find((b) => b.id === id);
    const trip = sheet ? db.trips.find((t) => t.id === sheet.tripId) : undefined;
    if (!sheet || !trip) return respond(null);
    return respond({ ...sheet, trip: decorateTrip(trip) });
  },

  stock(): Promise<ApiResponse<typeof db.materialStock>> {
    return respond(db.materialStock);
  },
};
