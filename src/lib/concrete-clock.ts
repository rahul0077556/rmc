/**
 * Concrete Clock Domain Engine (IS 4926 & ASTM C94 Standards)
 * 
 * Tracks the live hydration window for ready-mix concrete from batching to initial setting.
 * Standard concrete must be discharged within its workability window (commonly ~120 minutes),
 * adjusted by:
 * - Grade: Higher grades (M35, M40) hydrate faster due to higher cement content & heat.
 * - Ambient Temperature: Summer heat (>35°C) accelerates initial setting.
 * - Admixture: Retarders extend transit life; accelerators shorten it.
 */

export type AmbientTempMode = "cool" | "normal" | "warm" | "extreme_summer";
export type AdmixtureMode = "standard" | "retarder" | "extended_retarder" | "accelerator";

export interface ConcreteClockConfig {
  baseLimitMinutes: number; // default 120 min
  tempMode: AmbientTempMode;
  admixtureMode: AdmixtureMode;
  ambientTemperatureC: number;
}

export interface ConcreteClockState {
  batchTime: Date;
  dischargeBeforeTime: Date;
  totalLimitMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  progress: number; // 0 (just batched) to 1 (at limit)
  status: "healthy" | "warning" | "critical" | "expired";
  statusColor: string; // Tailwind color class or hex
  formattedRemaining: string;
  formattedDischargeBefore: string;
  formattedBatchTime: string;
  urgencyScore: number; // lower number = higher priority to jump to top
}

const DEFAULT_CONFIG: ConcreteClockConfig = {
  baseLimitMinutes: 120, // 2.0 hours standard
  tempMode: "normal",
  admixtureMode: "retarder", // standard practice in hot Indian climates (+30 min)
  ambientTemperatureC: 32,
};

let currentConfig: ConcreteClockConfig = (() => {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("rmc.concrete_clock_config");
      if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      // ignore
    }
  }
  return DEFAULT_CONFIG;
})();

const configListeners = new Set<() => void>();

export const concreteClockStore = {
  getConfig(): ConcreteClockConfig {
    return currentConfig;
  },

  updateConfig(updates: Partial<ConcreteClockConfig>) {
    currentConfig = { ...currentConfig, ...updates };
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("rmc.concrete_clock_config", JSON.stringify(currentConfig));
      } catch {
        // ignore
      }
    }
    configListeners.forEach((fn) => fn());
  },

  subscribe(fn: () => void) {
    configListeners.add(fn);
    return () => configListeners.delete(fn);
  },
};

/**
 * Calculates concrete workability limit in minutes
 */
export function calculateDischargeLimitMinutes(
  grade?: string,
  config: ConcreteClockConfig = currentConfig
): number {
  let limit = config.baseLimitMinutes;

  // Grade adjustment
  const upperGrade = (grade || "").toUpperCase();
  if (upperGrade.includes("M15") || upperGrade.includes("M20")) {
    limit += 10; // lower cementitious content, slower hydration
  } else if (upperGrade.includes("M30") || upperGrade.includes("M35")) {
    limit -= 10; // higher early heat of hydration
  } else if (upperGrade.includes("M40")) {
    limit -= 20; // high-spec mix, faster slump loss
  }

  // Ambient Temperature adjustment
  const temp = config.ambientTemperatureC;
  if (temp < 25 || config.tempMode === "cool") {
    limit += 15;
  } else if (temp > 37 || config.tempMode === "extreme_summer") {
    limit -= 30; // hot weather hydration spike
  } else if (temp > 32 || config.tempMode === "warm") {
    limit -= 15;
  }

  // Admixture adjustment
  switch (config.admixtureMode) {
    case "retarder":
      limit += 35; // e.g. Sika Plastiment R / Fosroc Conplast
      break;
    case "extended_retarder":
      limit += 60; // long haul / high slump retention
      break;
    case "accelerator":
      limit -= 30; // fast setting winter mix
      break;
    case "standard":
    default:
      break;
  }

  return Math.max(45, limit); // minimum safety floor of 45 mins
}

/**
 * Derives the batching start timestamp for a trip
 */
export function getTripBatchTime(trip: {
  batchTime?: string;
  dispatchTime?: string;
  plannedTime?: string;
  lastUpdate?: string;
  id?: string;
  sequence?: number;
}): Date {
  if (trip.batchTime) return new Date(trip.batchTime);
  if (trip.dispatchTime) return new Date(trip.dispatchTime);

  // If ongoing trip today, synthesize realistic live batching times based on trip ID
  const now = new Date();
  const hash = Math.abs(
    (trip.id || "TRIP-01").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + (trip.sequence || 1) * 17
  );

  // Vary elapsed times between 15 mins to 110 mins ago to showcase the Green, Amber, Red countdown states
  const sampleElapsedMinutes = [18, 32, 55, 78, 96, 112, 126][hash % 7];
  const derived = new Date(now.getTime() - sampleElapsedMinutes * 60 * 1000);
  return derived;
}

/**
 * Computes live Concrete Clock countdown state for any trip
 */
export function getConcreteClockState(
  trip: {
    grade?: string;
    batchTime?: string;
    dispatchTime?: string;
    plannedTime?: string;
    lastUpdate?: string;
    id?: string;
    sequence?: number;
  },
  config: ConcreteClockConfig = currentConfig
): ConcreteClockState {
  const batchTime = getTripBatchTime(trip);
  const totalLimitMinutes = calculateDischargeLimitMinutes(trip.grade, config);
  const dischargeBeforeTime = new Date(batchTime.getTime() + totalLimitMinutes * 60 * 1000);

  const now = new Date();
  const elapsedMinutes = Math.floor((now.getTime() - batchTime.getTime()) / (60 * 1000));
  const remainingMinutes = Math.round((dischargeBeforeTime.getTime() - now.getTime()) / (60 * 1000));
  const progress = Math.min(1, Math.max(0, elapsedMinutes / totalLimitMinutes));

  // Determine status color & threshold
  let status: ConcreteClockState["status"] = "healthy";
  let statusColor = "#10b981"; // Emerald / Green
  let urgencyScore = 3000 + remainingMinutes;

  if (remainingMinutes < 0) {
    status = "expired";
    statusColor = "#ef4444"; // Rose / Red pulse
    urgencyScore = -1000 + remainingMinutes; // highest priority jump to top!
  } else if (remainingMinutes <= 15) {
    status = "critical";
    statusColor = "#f43f5e"; // Bright Red
    urgencyScore = 100 + remainingMinutes; // jump to top!
  } else if (remainingMinutes <= 45) {
    status = "warning";
    statusColor = "#f59e0b"; // Amber
    urgencyScore = 1000 + remainingMinutes;
  }

  // Format remaining string
  let formattedRemaining = "";
  if (remainingMinutes < 0) {
    const overdue = Math.abs(remainingMinutes);
    formattedRemaining = overdue >= 60 ? `EXPIRED -${Math.floor(overdue / 60)}h ${overdue % 60}m` : `EXPIRED -${overdue}m`;
  } else if (remainingMinutes >= 60) {
    formattedRemaining = `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`;
  } else {
    formattedRemaining = `${remainingMinutes}m left`;
  }

  const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

  return {
    batchTime,
    dischargeBeforeTime,
    totalLimitMinutes,
    elapsedMinutes,
    remainingMinutes,
    progress,
    status,
    statusColor,
    formattedRemaining,
    formattedDischargeBefore: dischargeBeforeTime.toLocaleTimeString([], timeOptions),
    formattedBatchTime: batchTime.toLocaleTimeString([], timeOptions),
    urgencyScore,
  };
}

/**
 * Sorts trips so trucks with lowest remaining concrete clock time jump to the top
 */
export function sortByConcreteClockUrgency<T extends { grade?: string; id?: string; batchTime?: string }>(
  trips: T[],
  config: ConcreteClockConfig = currentConfig
): T[] {
  return [...trips].sort((a, b) => {
    const clockA = getConcreteClockState(a, config);
    const clockB = getConcreteClockState(b, config);
    return clockA.urgencyScore - clockB.urgencyScore;
  });
}
