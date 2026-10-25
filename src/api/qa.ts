import { request } from "./client";
import { decorateTrip, type TripRow } from "./trips";
import type { ApiResponse, CubeTest, Grade, MaterialTest, QcCheck } from "@/types";

export interface QcQueueRow {
  batchSheetId: string;
  trip: TripRow;
}

export interface QcInput {
  physicalInspection: "PASS" | "FAIL";
  slump: number;
  bleeding: "PASS" | "FAIL";
  wrongMix: "PASS" | "FAIL";
  admixtureType: string;
  admixtureQuantity: number;
  remarks: string;
  decision: "APPROVED" | "REJECTED";
  rejectionAction?: "CORRECT" | "REPLACE";
}

export const qaApi = {
  async summary(): Promise<
    ApiResponse<{
      pending: number;
      approved: number;
      rejected: number;
      recheck: number;
      cubeDue: number;
      overdue: number;
    }>
  > {
    const queueRes = await this.queue();
    const cubeRes = await this.cubeTests();
    const queue = queueRes.data || [];
    const cubes = cubeRes.data || [];

    const pending = queue.filter((q) => q.trip.status === "QC_PENDING").length;
    const recheck = queue.filter((q) => q.trip.status === "CORRECTING").length;
    const rejected = queue.filter((q) => q.trip.status === "QC_REJECTED").length;
    const cubeDue = cubes.filter((c) => c.result === "PENDING").length;
    const overdue = cubes.filter((c) => c.result === "OVERDUE").length;
    const approved = cubes.filter((c) => c.result === "PASS").length;

    return {
      data: {
        pending,
        approved,
        rejected,
        recheck,
        cubeDue,
        overdue,
      },
    };
  },

  async queue(): Promise<ApiResponse<QcQueueRow[]>> {
    try {
      const res = await request<any[]>({ url: "/qa/queue", method: "GET" });
      const trips = res.data || [];
      const rows: QcQueueRow[] = trips.map((t: any) => ({
        batchSheetId: t.batchSheetId || t.id,
        trip: decorateTrip(t),
      }));
      return { data: rows };
    } catch {
      return { data: [] };
    }
  },

  async submitCheck(batchSheetId: string, input: QcInput, _actor?: string): Promise<ApiResponse<QcCheck | null>> {
    const queueRes = await this.queue();
    const item = (queueRes.data || []).find((q) => q.batchSheetId === batchSheetId);
    const tripId = item?.trip?.id;

    const res = await request<any>({
      url: "/qa/checks",
      method: "POST",
      data: {
        tripId: tripId || batchSheetId,
        batchSheetId,
        physicalInspection: input.physicalInspection,
        slump: input.slump,
        bleeding: input.bleeding,
        wrongMix: input.wrongMix,
        admixtureType: input.admixtureType,
        admixtureQty: input.admixtureQuantity,
        decision: input.decision === "APPROVED" ? "APPROVE" : "REJECT",
        rejectAction: input.rejectionAction,
        remarks: input.remarks,
      },
    });

    const qcData = res.data?.qcCheck || res.data;
    const check: QcCheck | null = qcData
      ? {
          id: qcData.id,
          batchSheetId: qcData.batchSheetId || batchSheetId,
          tripId: qcData.tripId || tripId || "",
          physicalInspection: qcData.physicalInspection || input.physicalInspection,
          slump: qcData.slump ?? input.slump,
          bleeding: qcData.bleeding || input.bleeding,
          wrongMix: qcData.wrongMix || input.wrongMix,
          admixtureType: qcData.admixtureType || input.admixtureType,
          admixtureQuantity: qcData.admixtureQuantity ?? input.admixtureQuantity,
          remarks: qcData.remarks || input.remarks,
          decision: (qcData.decision === "APPROVE" ? "APPROVED" : qcData.decision) || input.decision,
          rejectionAction: qcData.rejectAction || input.rejectionAction,
          checkedBy: qcData.qcSign || qcData.checkedBy || "QC Engineer",
          checkedAt: qcData.checkedAt || new Date().toISOString(),
        }
      : null;

    return {
      data: check,
      message:
        input.decision === "APPROVED"
          ? "QC approved"
          : input.rejectionAction === "REPLACE"
            ? "Trip rejected — replacement trip created"
            : "Trip rejected — correction requested",
    };
  },

  async cubeTests(): Promise<ApiResponse<CubeTest[]>> {
    const res = await request<any[]>({ url: "/qa/cube-sets", method: "GET" });
    const sets = res.data || [];
    const flattened: CubeTest[] = [];

    sets.forEach((set: any) => {
      const tests = set.tests || [];
      tests.forEach((t: any) => {
        flattened.push({
          id: t.id,
          batchSheetId: set.batchSheetId,
          grade: (set.grade || "M25") as Grade,
          castDate: set.castDate,
          cubeCount: set.cubeCount || 6,
          age: t.ageDays as 3 | 7 | 28,
          dueDate: t.dueDate,
          testedOn: t.testedOn,
          strength: t.strengthMpa,
          result: t.result as "PENDING" | "PASS" | "FAIL" | "OVERDUE",
        });
      });
    });

    return { data: flattened.sort((a, b) => a.dueDate.localeCompare(b.dueDate)) };
  },

  async recordCube(id: string, strength: number, _actor?: string): Promise<ApiResponse<CubeTest | null>> {
    const res = await request<any>({
      url: `/qa/cube-tests/${id}/result`,
      method: "POST",
      data: {
        strengthMpa: strength,
      },
    });

    const t = res.data;
    const test: CubeTest | null = t
      ? {
          id: t.id,
          batchSheetId: t.batchSheetId || "",
          grade: (t.grade || "M25") as Grade,
          castDate: t.castDate || new Date().toISOString().slice(0, 10),
          cubeCount: 6,
          age: t.ageDays as 3 | 7 | 28,
          dueDate: t.dueDate,
          testedOn: t.testedOn,
          strength: t.strengthMpa,
          result: t.result,
        }
      : null;

    return { data: test, message: "Cube test result recorded" };
  },

  async materialTests(): Promise<ApiResponse<MaterialTest[]>> {
    const res = await request<any[]>({ url: "/qa/material-tests", method: "GET" });
    const tests = (res.data || []).map((m: any) => ({
      id: m.id,
      material: m.material,
      test: m.testName || m.test || "",
      result: m.result,
      testDate: m.testedOn || m.testDate || "",
      remarks: m.remarks || "",
    }));
    return { data: tests.sort((a, b) => b.testDate.localeCompare(a.testDate)) };
  },

  async addMaterialTest(input: Omit<MaterialTest, "id">, _actor?: string): Promise<ApiResponse<MaterialTest>> {
    const res = await request<any>({
      url: "/qa/material-tests",
      method: "POST",
      data: {
        material: input.material,
        testName: input.test,
        result: input.result,
        testedOn: input.testDate,
        remarks: input.remarks,
      },
    });
    const m = res.data;
    return {
      data: {
        id: m.id,
        material: m.material,
        test: m.testName || input.test,
        result: m.result,
        testDate: m.testedOn || input.testDate,
        remarks: m.remarks || "",
      },
      message: "Material test recorded successfully",
    };
  },
};

