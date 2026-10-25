import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { ApiError, ApiResponse, PaginatedResponse } from "@/types";
export type { ApiError, ApiResponse, PaginatedResponse };

function normalizeBaseUrl(url?: string): string {
  if (!url) return "/api/v1";
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api/v1")) return trimmed;
  if (trimmed === "/api" || trimmed.endsWith("/api")) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env["VITE_API_BASE_URL"]);
export const TOKEN_STORAGE_KEY = "rmc.jwt_token";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle errors gracefully
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Token expired or invalid
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem("rmc.session");
    }
    return Promise.reject(error);
  }
);

export async function request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
  try {
    const res: AxiosResponse<{ data: T; meta?: Record<string, unknown> }> = await apiClient.request(config);
    return {
      data: res.data.data,
      meta: res.data.meta,
    };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      const errPayload = err.response.data.error;
      const apiErr: ApiError = {
        status: err.response.status,
        message: errPayload.message || "An API error occurred",
      };
      throw apiErr;
    }
    throw {
      status: 500,
      message: err instanceof Error ? err.message : "Network error connecting to backend",
    } as ApiError;
  }
}

/**
 * Fallback/Mock transport helpers to preserve compatibility across existing components.
 */
const LATENCY_MS = 150;

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
