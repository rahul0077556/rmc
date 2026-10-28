import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/api/client";
import type { Role } from "@/types";

export type QueueUrgency = "urgent" | "attention" | "standard" | "scheduled";

export interface QueueItem {
  id: string;
  role: Role;
  title: string;
  subtitle: string;
  category: string;
  urgency: QueueUrgency;
  urgencyLabel: string;
  badgeText?: string;
  badgeVariant?: "destructive" | "warning" | "success" | "outline" | "default";
  metrics?: { label: string; value: string }[];
  actionLabel: string;
  actionTo: string;
  actionState?: Record<string, any>;
  waitingTime: string;
  status: "pending" | "completed";
  dueTime?: string;
}

const STORAGE_KEY = "rmc.my_queue.completed";

function getCompletedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCompletedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export const QUEUE_CATALOG: Record<Role, QueueItem[]> = {
  sales: [],
  sales_manager: [],
  dispatcher: [],
  supervisor: [],
  production: [],
  qa: [],
  store: [],
  account: [],
  owner: [],
  customer: [],
};

/**
 * Hook to manage live role queue connected directly to operational backend
 */
export function useRoleQueue(role: Role) {
  const [completedIds, setCompletedIds] = useState<string[]>(getCompletedIds);

  const query = useQuery({
    queryKey: ["live-queue", role],
    queryFn: async () => {
      try {
        const res = await request<QueueItem[]>({
          url: `/queue?role=${role}`,
          method: "GET",
        });
        return res.data || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 3000,
  });

  const rawItems = query.data || [];

  const toggleComplete = (id: string) => {
    setCompletedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      saveCompletedIds(next);
      return next;
    });
  };

  const activeItems = rawItems.map((item) => ({
    ...item,
    status: completedIds.includes(item.id) ? ("completed" as const) : ("pending" as const),
  }));

  const pendingCount = activeItems.filter((i) => i.status === "pending").length;
  const urgentCount = activeItems.filter((i) => i.status === "pending" && i.urgency === "urgent").length;

  return {
    items: activeItems,
    isLoading: query.isLoading,
    pendingCount,
    urgentCount,
    completedCount: completedIds.length,
    toggleComplete,
  };
}
