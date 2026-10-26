import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Filter,
  Check,
  RotateCcw,
  Building2,
  Truck,
  Package,
  FlaskConical,
  Warehouse,
  Landmark,
  FileText,
  ClipboardCheck,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/auth/auth-context";
import { useRoleQueue, QUEUE_CATALOG, type QueueItem, type QueueUrgency } from "@/lib/queue-data";
import { ROLE_LABEL } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

export const Route = createFileRoute("/_shell/queue")({
  component: MyQueuePage,
});

const ROLE_ICONS: Record<Role, any> = {
  sales: FileText,
  sales_manager: ClipboardCheck,
  dispatcher: Truck,
  production: Package,
  qa: FlaskConical,
  store: Warehouse,
  account: Landmark,
  owner: Building2,
  customer: Building2,
};

const ROLE_COLORS: Record<Role, { bg: string; text: string; border: string; activeGradient: string }> = {
  sales: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
    activeGradient: "from-purple-600 to-indigo-600",
  },
  sales_manager: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
    activeGradient: "from-blue-600 to-cyan-600",
  },
  dispatcher: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
    activeGradient: "from-cyan-600 to-blue-600",
  },
  production: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    activeGradient: "from-emerald-600 to-teal-600",
  },
  qa: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    activeGradient: "from-amber-600 to-orange-600",
  },
  store: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    activeGradient: "from-yellow-600 to-amber-600",
  },
  account: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
    activeGradient: "from-rose-600 to-red-600",
  },
  owner: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
    activeGradient: "from-primary to-blue-600",
  },
  customer: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
    activeGradient: "from-indigo-600 to-violet-600",
  },
};

function MyQueuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active selected role for view (defaults to authenticated role, but allows previewing others)
  const [selectedRole, setSelectedRole] = useState<Role>(user?.role || "dispatcher");
  const [activeTab, setActiveTab] = useState<"all" | "urgent" | "completed">("all");
  const [search, setSearch] = useState("");

  const { items, pendingCount, urgentCount, completedCount, toggleComplete } = useRoleQueue(selectedRole);

  const filteredItems = items.filter((item) => {
    if (activeTab === "urgent" && (item.urgency !== "urgent" || item.status === "completed")) return false;
    if (activeTab === "completed" && item.status !== "completed") return false;
    if (activeTab === "all" && item.status === "completed") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAction = (item: QueueItem) => {
    void navigate({ to: item.actionTo });
  };

  const roleStyles = ROLE_COLORS[selectedRole] || ROLE_COLORS.dispatcher;
  const RoleIcon = ROLE_ICONS[selectedRole] || Truck;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Inbox className="size-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My Operational Queue</h1>
            <Badge
              variant="outline"
              className={cn("gap-1.5 font-semibold text-xs py-0.5 px-2.5", roleStyles.bg, roleStyles.text, roleStyles.border)}
            >
              <RoleIcon className="size-3.5" />
              {ROLE_LABEL[selectedRole]} Desk
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Zero-fluff actionable inbox. Every item is waiting for your step — tap any task to jump straight to the action screen.
          </p>
        </div>

        {/* Live Metrics Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-3.5 py-2 shadow-xs">
            <span className="flex size-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">Urgent:</span>
            <span className="text-sm font-bold text-rose-500 tabular-nums">{urgentCount}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-3.5 py-2 shadow-xs">
            <span className="flex size-2 rounded-full bg-amber-400" />
            <span className="text-xs font-medium text-muted-foreground">Pending:</span>
            <span className="text-sm font-bold text-foreground tabular-nums">{pendingCount}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-3.5 py-2 shadow-xs">
            <span className="flex size-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-muted-foreground">Done:</span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Role Switcher Pills (Allows Owner or testing operators to quickly view queues across departments) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Department Queues:
          </span>
          {user?.role === "owner" && (
            <span className="text-[11px] text-primary font-medium">Executive Multi-Desk Access</span>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(Object.keys(QUEUE_CATALOG) as Role[]).map((r) => {
            const isSelected = selectedRole === r;
            const Icon = ROLE_ICONS[r] || Truck;
            const colors = ROLE_COLORS[r];
            const count = QUEUE_CATALOG[r]?.length || 0;

            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all shrink-0 border cursor-pointer",
                  isSelected
                    ? cn("bg-gradient-to-r text-white shadow-sm border-transparent", colors.activeGradient)
                    : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{ROLE_LABEL[r]}</span>
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                    isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/50 max-w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              activeTab === "all" ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active Tasks ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("urgent")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              activeTab === "urgent" ? "bg-card text-rose-500 shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="size-1.5 rounded-full bg-rose-500" />
            Urgent Only ({urgentCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              activeTab === "completed" ? "bg-card text-emerald-400 shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Completed ({completedCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter queue by customer, PO, truck..."
            className="h-9 text-xs pl-8 bg-card/60"
          />
          <Filter className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Task Cards List */}
      <div className="space-y-3.5">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/30">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-3">
              <CheckCircle2 className="size-6" />
            </span>
            <h3 className="text-base font-semibold text-foreground">You're completely caught up!</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {activeTab === "completed"
                ? "No completed tasks yet in this session."
                : `No pending action items waiting for the ${ROLE_LABEL[selectedRole]} desk right now.`}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isCompleted = item.status === "completed";
            const isUrgent = item.urgency === "urgent";

            return (
              <div
                key={item.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border transition-all duration-200 p-4 sm:p-5",
                  isCompleted
                    ? "bg-card/40 border-border/40 opacity-70"
                    : isUrgent
                    ? "bg-gradient-to-r from-card via-card to-rose-950/10 border-rose-500/40 shadow-sm hover:border-rose-500/70 hover:shadow-md"
                    : "bg-card/70 border-border/70 shadow-xs hover:border-primary/50 hover:shadow-sm"
                )}
              >
                {/* Left Urgency Color Stripe */}
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1.5 transition-all",
                    isCompleted
                      ? "bg-muted"
                      : isUrgent
                      ? "bg-rose-500"
                      : item.urgency === "attention"
                      ? "bg-amber-400"
                      : "bg-primary"
                  )}
                />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Content Block */}
                  <div className="space-y-2.5 flex-1 min-w-0 pl-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                          isUrgent
                            ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                            : item.urgency === "attention"
                            ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                            : "border-border text-muted-foreground bg-muted/40"
                        )}
                      >
                        {item.category}
                      </Badge>

                      {item.badgeText && (
                        <Badge
                          variant={item.badgeVariant || "secondary"}
                          className="text-[10px] font-semibold px-2 py-0.5"
                        >
                          {item.badgeText}
                        </Badge>
                      )}

                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <Clock className="size-3 text-muted-foreground" />
                        {item.waitingTime}
                      </span>

                      {item.dueTime && (
                        <span className="text-[11px] text-amber-400 font-semibold">
                          · {item.dueTime}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3
                        className={cn(
                          "text-base font-bold tracking-tight text-foreground transition-colors",
                          isCompleted && "line-through text-muted-foreground"
                        )}
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                        {item.subtitle}
                      </p>
                    </div>

                    {/* Operational Metrics Chips */}
                    {item.metrics && item.metrics.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {item.metrics.map((m) => (
                          <div
                            key={m.label}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-raised/70 px-2.5 py-1 text-xs"
                          >
                            <span className="text-muted-foreground text-[11px]">{m.label}:</span>
                            <span className="font-semibold text-foreground text-xs tabular-nums">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Block */}
                  <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50 justify-between lg:justify-end">
                    <button
                      type="button"
                      onClick={() => toggleComplete(item.id)}
                      title={isCompleted ? "Mark pending" : "Mark completed"}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-xl border transition-all cursor-pointer",
                        isCompleted
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      {isCompleted ? <Check className="size-4" /> : <CheckCircle2 className="size-4" />}
                    </button>

                    <Button
                      size="sm"
                      onClick={() => handleAction(item)}
                      className={cn(
                        "h-10 px-4 text-xs font-semibold gap-1.5 transition-all shadow-sm cursor-pointer",
                        isUrgent
                          ? "bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-900/20"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      )}
                    >
                      <span>{item.actionLabel}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* RMC Copilot Plant Guidance Footer Bar */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-blue-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-foreground">Need help completing a task in your queue?</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ask RMC Copilot anything about recipes, IS 4926 concrete limits, weighbridge tickets, or driver payroll.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const button = document.querySelector('button[aria-label="Open Sai RMC Plant Copilot"]') as HTMLButtonElement | null;
            button?.click();
          }}
          className="border-primary/30 text-primary hover:bg-primary/10 text-xs shrink-0"
        >
          Open AI Copilot →
        </Button>
      </div>
    </div>
  );
}
