import { request } from "./client";
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

export const productionApi = {
  async queue(): Promise<ApiResponse<TripRow[]>> {
    try {
      const res = await request<any[]>({ url: "/production/queue", method: "GET" });
      const rows = res.data || [];
      return { data: rows.map(decorateTrip) };
    } catch {
      return { data: [] };
    }
  },

  async materialCheck(tripId: string): Promise<ApiResponse<MaterialCheckRow[]>> {
    try {
      const res = await request<any>({
        url: `/production/trips/${tripId}/check-materials`,
        method: "POST",
      });
      const data = res.data;
      if (data && data.requiredMaterials) {
        const rows: MaterialCheckRow[] = data.requiredMaterials.map((rm: any) => {
          const sf = (data.shortfalls || []).find((s: any) => s.material === rm.material);
          const shortfall = sf ? sf.shortfall : 0;
          return {
            material: rm.material,
            required: rm.required,
            available: rm.available,
            unit: rm.unit,
            sufficient: shortfall === 0,
            shortfall,
          };
        });
        return { data: rows };
      }
    } catch {
      // Fallback
    }
    return { data: [] };
  },

  async startBatching(tripId: string, _actor?: string): Promise<ApiResponse<TripRow | null>> {
    const res = await request<any>({
      url: `/production/trips/${tripId}/start-batching`,
      method: "POST",
    });
    const trip = res.data?.trip || res.data;
    return { data: trip ? decorateTrip(trip) : null, message: "Batching started in plant" };
  },

  async confirmLoaded(tripId: string, _actor?: string): Promise<ApiResponse<BatchSheet | null>> {
    const res = await request<any>({
      url: `/production/trips/${tripId}/confirm-loaded`,
      method: "POST",
      data: {},
    });
    const sheet = res.data?.batchSheet || res.data;
    return { data: sheet, message: "Batch sheet generated and truck loaded" };
  },

  async batchSheet(id: string): Promise<ApiResponse<(BatchSheet & { trip: TripRow }) | null>> {
    const res = await request<any>({ url: `/batch-sheets/${id}`, method: "GET" });
    const data = res.data;
    if (!data) return { data: null };

    const trip = data.trip ? decorateTrip(data.trip) : ({ id: data.tripId } as TripRow);
    const materials: MaterialLine[] = (data.materials || []).map((m: any) => ({
      material: m.material,
      unit: m.unit,
      theoretical: m.theoretical,
      actual: m.actual,
    }));

    const sheet: BatchSheet & { trip: TripRow } = {
      id: data.id,
      batchNumber: data.batchNumber || data.id,
      tripId: data.tripId,
      materials,
      batchTime: data.batchTime || new Date().toISOString(),
      operator: data.operator || "Auto AJAX Batcher",
      qcStatus: data.qcStatus || "PENDING",
      trip,
    };

    return { data: sheet };
  },

  async stock(): Promise<ApiResponse<any[]>> {
    const res = await request<any>({ url: "/store/inventory", method: "GET" });
    const raw = res.data?.materials || res.data || [];
    const stockList = Array.isArray(raw)
      ? raw.map((m: any) => ({
          material: m.name || m.material,
          available: m.available ?? m.stock ?? 0,
          unit: m.unit || "kg",
        }))
      : [];
    return { data: stockList };
  },
};
