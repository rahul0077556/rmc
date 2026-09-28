import type { ApiError, ApiResponse, PaginatedResponse } from "@/types";

export const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "/api/v1";

/**
 * Mock transport. Every api/* module talks only through these helpers, so the
 * whole app can be pointed at a real Flask REST API by swapping this file for
 * an axios/fetch implementation against API_BASE_URL — no UI changes needed.
 */
const LATENCY_MS = 220;

export function respond<T>(data: T, message?: string): Promise<ApiResponse<T>> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data, message }), LATENCY_MS);
  });
}

export function fail<T>(status: number, message: string): Promise<ApiResponse<T>> {
  const error: ApiError = { status, message };
  return new Promise((_, reject) => {
    setTimeout(() => reject(error), LATENCY_MS);
  });
}

export function paginate<T>(items: T[], page = 1, pageSize = 25): PaginatedResponse<T> {
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
  };
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "status" in value && "message" in value;
}
