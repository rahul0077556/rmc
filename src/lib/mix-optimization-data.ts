import { GRADES, GRADE_RATE, MIX_DESIGN } from "@/lib/mock-data";
import type { Grade } from "@/types";

export interface BatchMixRecord {
  id: string; // BS-2026-00412
  tripNumber: string;
  grade: Grade;
  fck: number; // 25
  targetStrength: number; // 31.6 MPa
  cementContentKg: number; // kg/cum (X-axis)
  flyAshContentKg: number; // kg/cum
  waterCementRatio: number; // 0.44
  slumpMm: number; // 135 mm
  strength28d: number; // Achieved 28-day strength in MPa (Y-axis)
  strength7d: number; // 7-day strength in MPa
  overStrengthDelta: number; // strength28d - targetStrength
  status: "potential-saving" | "optimal" | "standard" | "understrength";
  potentialCementSavingKg: number; // e.g. 20 kg/cum
  potentialRupeeSavingPerCum: number; // e.g. ₹150/cum (OPC @ ₹7.5/kg)
  customerName: string;
  siteName: string;
  testedOn: string;
  notes: string;
}

export interface MixOptimizationSummary {
  totalBatches: number;
  savingsBatchesCount: number;
  savingsBatchesPercent: number;
  avgOverStrengthMpa: number;
  avgCementSavingKg: number;
  avgRupeeSavingPerCum: number;
  potentialMonthlySavingInr: number;
}

// Characteristic & target mean strengths under IS 456 / IS 10262
export const GRADE_STRENGTH_STANDARDS: Record<
  Grade,
  { fck: number; targetStrength: number; nominalCement: number; stdDev: number }
> = {
  M15: { fck: 15, targetStrength: 20.8, nominalCement: 290, stdDev: 3.5 },
  M20: { fck: 20, targetStrength: 26.6, nominalCement: 320, stdDev: 4.0 },
  M25: { fck: 25, targetStrength: 31.6, nominalCement: 350, stdDev: 4.0 },
  M30: { fck: 30, targetStrength: 38.3, nominalCement: 380, stdDev: 5.0 },
  M35: { fck: 35, targetStrength: 43.3, nominalCement: 410, stdDev: 5.0 },
  M40: { fck: 40, targetStrength: 48.3, nominalCement: 440, stdDev: 5.0 },
};

// Seed 80 realistic batches tested over last 90 days
const SEED_CUSTOMERS = [
  "ABC Constructions",
  "Shree Developers",
  "Metro Infra",
  "BuildWell Projects",
  "Skyline Builders",
  "Urban Infra",
];

export function getMixOptimizationData(): {
  batches: BatchMixRecord[];
  summary: MixOptimizationSummary;
} {
  const batches: BatchMixRecord[] = [];
  const grades: Grade[] = ["M20", "M25", "M30", "M35", "M40"];

  let idSeq = 101;

  grades.forEach((grade) => {
    const std = GRADE_STRENGTH_STANDARDS[grade];
    // Generate 16 batches per grade
    for (let i = 0; i < 16; i++) {
      idSeq++;
      // Seed variation: some batches have nominal cement, some higher cement
      const cementOffset = (i % 5 === 0) ? 25 : (i % 3 === 0) ? 15 : (i % 2 === 0) ? -5 : 5;
      const cement = std.nominalCement + cementOffset;
      const flyAsh = Math.round(cement * 0.28);
      const wcRatio = Math.round((0.48 - (cement - std.nominalCement) * 0.001) * 100) / 100;

      // Realistic 28-day strength achieved
      // Strong correlation with cement content, plus lab variance
      const expectedStrength = std.targetStrength + (cement - std.nominalCement) * 0.18 + ((i * 7) % 5) - 1.5;
      const strength28d = Math.round(expectedStrength * 10) / 10;
      const strength7d = Math.round(strength28d * 0.72 * 10) / 10;
      const delta = Math.round((strength28d - std.targetStrength) * 10) / 10;

      let status: BatchMixRecord["status"] = "optimal";
      let savingKg = 0;
      let rupeeSaving = 0;

      if (strength28d < std.fck) {
        status = "understrength";
      } else if (delta >= 4.5 && cement >= std.nominalCement) {
        status = "potential-saving";
        savingKg = Math.min(30, Math.max(12, Math.round(delta * 3.8)));
        // OPC 53 @ ₹7.50 / kg
        rupeeSaving = Math.round(savingKg * 7.5);
      } else if (strength28d >= std.targetStrength) {
        status = "optimal";
      } else {
        status = "standard";
      }

      const cust = SEED_CUSTOMERS[i % SEED_CUSTOMERS.length]!;

      batches.push({
        id: `BS-2026-0${idSeq}`,
        tripNumber: `TRIP-2026-00${idSeq + 120}`,
        grade,
        fck: std.fck,
        targetStrength: std.targetStrength,
        cementContentKg: cement,
        flyAshContentKg: flyAsh,
        waterCementRatio: wcRatio,
        slumpMm: 125 + ((i * 11) % 30),
        strength28d,
        strength7d,
        overStrengthDelta: delta,
        status,
        potentialCementSavingKg: savingKg,
        potentialRupeeSavingPerCum: rupeeSaving,
        customerName: cust,
        siteName: `${cust} Pier Phase ${((i % 4) + 1)}`,
        testedOn: `2026-10-${String((i % 25) + 1).padStart(2, "0")}`,
        notes:
          status === "potential-saving"
            ? `Achieved ${strength28d} MPa (+${delta} MPa over target ${std.targetStrength} MPa). High safety margin allows trial reduction of ${savingKg} kg cement.`
            : `Compliant with IS 456: achieved ${strength28d} MPa vs characteristic ${std.fck} MPa.`,
      });
    }
  });

  const savingsBatches = batches.filter((b) => b.status === "potential-saving");
  const totalSavingsKg = savingsBatches.reduce((sum, b) => sum + b.potentialCementSavingKg, 0);
  const totalRupeeSaving = savingsBatches.reduce((sum, b) => sum + b.potentialRupeeSavingPerCum, 0);

  const avgCementSaving = savingsBatches.length > 0 ? Math.round(totalSavingsKg / savingsBatches.length) : 0;
  const avgRupeeSaving = savingsBatches.length > 0 ? Math.round(totalRupeeSaving / savingsBatches.length) : 0;
  const avgOverStrength =
    savingsBatches.length > 0
      ? Math.round((savingsBatches.reduce((sum, b) => sum + b.overStrengthDelta, 0) / savingsBatches.length) * 10) / 10
      : 0;

  // Assuming plant produces 2,400 cum of M20-M40 per month
  const potentialMonthlySaving = Math.round((savingsBatches.length / batches.length) * 2400 * avgRupeeSaving);

  return {
    batches,
    summary: {
      totalBatches: batches.length,
      savingsBatchesCount: savingsBatches.length,
      savingsBatchesPercent: Math.round((savingsBatches.length / batches.length) * 100),
      avgOverStrengthMpa: avgOverStrength,
      avgCementSavingKg: avgCementSaving,
      avgRupeeSavingPerCum: avgRupeeSaving,
      potentialMonthlySavingInr: potentialMonthlySaving,
    },
  };
}
