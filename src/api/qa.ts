import { addDays, format } from "date-fns";
import { respond } from "./client";
import { db, recordAudit } from "@/lib/store";
import { decorateTrip, type TripRow } from "./trips";
import type { ApiResponse, CubeTest, MaterialTest, QcCheck, Trip } from "@/types";

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
  summary(): Promise<
    ApiResponse<{
      pending: number;
      approved: number;
      rejected: number;
      recheck: number;
      cubeDue: number;
      overdue: number;
    }>
  > {
    return respond({
      pending: db.trips.filter((t) => t.status === "QC_PENDING").length,
      approved: db.qcChecks.filter((q) => q.decision === "APPROVED").length,
      rejected: db.qcChecks.filter((q) => q.decision === "REJECTED").length,
      recheck: db.trips.filter((t) => t.status === "CORRECTING").length,
      cubeDue: db.cubeTests.filter((c) => c.result === "PENDING").length,
      overdue: db.cubeTests.filter((c) => c.result === "OVERDUE").length,
    });
  },

  queue(): Promise<ApiResponse<QcQueueRow[]>> {
    const rows = db.batchSheets
      .filter((b) => b.qcStatus === "PENDING")
      .map((b) => {
        const trip = db.trips.find((t) => t.id === b.tripId);
        return trip ? { batchSheetId: b.id, trip: decorateTrip(trip) } : null;
      })
      .filter((r): r is QcQueueRow => r !== null);
    return respond(rows);
  },

  submitCheck(batchSheetId: string, input: QcInput, actor: string): Promise<ApiResponse<QcCheck | null>> {
    const sheet = db.batchSheets.find((b) => b.id === batchSheetId);
    const trip = sheet ? db.trips.find((t) => t.id === sheet.tripId) : undefined;
    if (!sheet || !trip) return respond(null);

    const check: QcCheck = {
      id: `QC-${batchSheetId}`,
      batchSheetId,
      tripId: trip.id,
      ...input,
      checkedBy: actor,
      checkedAt: new Date().toISOString(),
    };
    db.qcChecks.push(check);

    if (input.decision === "APPROVED") {
      sheet.qcStatus = "APPROVED";
      trip.status = "QC_APPROVED";
      const po = db.purchaseOrders.find((p) => p.id === trip.poId);
      if (po) {
        const castDate = new Date();
        ([3, 7, 28] as const).forEach((age) => {
          const test: CubeTest = {
            id: `CT-${batchSheetId}-${age}`,
            batchSheetId,
            grade: po.grade,
            castDate: format(castDate, "yyyy-MM-dd"),
            cubeCount: 9,
            age,
            dueDate: format(addDays(castDate, age), "yyyy-MM-dd"),
            result: "PENDING",
          };
          db.cubeTests.push(test);
        });
      }
      recordAudit(actor, `approved ${trip.tripNumber}`, trip.tripNumber);
    } else {
      sheet.qcStatus = "REJECTED";
      trip.status = "QC_REJECTED";
      if (input.rejectionAction === "REPLACE") {
        const replacement: Trip = {
          id: `TRIP-2026-${String(db.trips.length + 1).padStart(5, "0")}`,
          tripNumber: `TRIP-2026-${String(db.trips.length + 1).padStart(5, "0")}`,
          poId: trip.poId,
          sequence: trip.sequence,
          quantity: trip.quantity,
          tmId: trip.tmId,
          driverId: trip.driverId,
          plannedTime: new Date().toISOString(),
          status: "SENT_TO_PRODUCTION",
          lastUpdate: new Date().toISOString(),
        };
        trip.status = "REPLACED";
        trip.replacedByTripId = replacement.id;
        db.trips.push(replacement);
      } else {
        trip.status = "CORRECTING";
      }
      recordAudit(actor, `rejected ${trip.tripNumber}`, trip.tripNumber);
    }
    trip.lastUpdate = new Date().toISOString();

    return respond(
      check,
      input.decision === "APPROVED"
        ? "QC approved"
        : input.rejectionAction === "REPLACE"
          ? "Trip rejected — replacement trip created"
          : "Trip rejected — correction requested",
    );
  },

  cubeTests(): Promise<ApiResponse<CubeTest[]>> {
    return respond([...db.cubeTests].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
  },

  recordCube(id: string, strength: number, actor: string): Promise<ApiResponse<CubeTest | null>> {
    const test = db.cubeTests.find((c) => c.id === id);
    if (test) {
      test.strength = strength;
      test.testedOn = format(new Date(), "yyyy-MM-dd");
      const target = Number(test.grade.slice(1)) * (test.age === 3 ? 0.45 : test.age === 7 ? 0.65 : 1);
      test.result = strength >= target ? "PASS" : "FAIL";
      recordAudit(actor, `recorded ${test.age}-day cube result for ${test.batchSheetId}`, test.batchSheetId);
    }
    return respond(test ?? null, "Cube test recorded");
  },

  materialTests(): Promise<ApiResponse<MaterialTest[]>> {
    return respond([...db.materialTests].sort((a, b) => b.testDate.localeCompare(a.testDate)));
  },

  addMaterialTest(input: Omit<MaterialTest, "id">, actor: string): Promise<ApiResponse<MaterialTest>> {
    const test: MaterialTest = { ...input, id: `MT-${String(db.materialTests.length + 1).padStart(3, "0")}` };
    db.materialTests.unshift(test);
    recordAudit(actor, `logged ${input.test} test for ${input.material}`, test.id);
    return respond(test, "Material test recorded");
  },
};
