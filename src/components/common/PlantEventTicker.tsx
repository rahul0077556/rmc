import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Radio,
  Pause,
  Play,
  Filter,
  ArrowUpRight,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useAuth } from "@/auth/auth-context";
import { usePlantEvents, type PlantEvent, type EventSeverity } from "@/lib/plant-events";
import { ROLE_LABEL } from "@/lib/nav";
import { cn } from "@/lib/utils";

const SEVERITY_DOTS: Record<EventSeverity, string> = {
  info: "bg-cyan-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400 animate-pulse",
  critical: "bg-rose-500 animate-ping",
};

export function PlantEventTicker() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [filterMode, setFilterMode] = useState<"role" | "all">("role");
  const [isPaused, setIsPaused] = useState(false);

  const activeRole = filterMode === "role" ? user?.role : undefined;
  const events = usePlantEvents(activeRole);

  const handleEventClick = (event: PlantEvent) => {
    if (event.linkTo) {
      void navigate({ to: event.linkTo });
    }
  };

  if (!events || events.length === 0) return null;

  return (
    <div
      className="relative z-20 flex h-8 shrink-0 items-center border-b border-border/70 bg-card/90 px-3 text-xs backdrop-blur-md select-none overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Left Badge: Live Pulse & Filter Toggle */}
      <div className="flex items-center gap-2 border-r border-border/80 pr-2.5 mr-2 shrink-0">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>

        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline">
          Live Ticker
        </span>

        <button
          type="button"
          onClick={() => setFilterMode((m) => (m === "role" ? "all" : "role"))}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted/60 hover:bg-muted text-foreground transition-colors cursor-pointer"
          title={filterMode === "role" ? "Switch to All Plant Feed" : "Filter by My Role"}
        >
          <Filter className="size-2.5" />
          <span>{filterMode === "role" && user ? ROLE_LABEL[user.role] : "All Desk"}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          title={isPaused ? "Resume Ticker Scrolling" : "Pause Scrolling"}
        >
          {isPaused ? <Play className="size-2.5 text-primary" /> : <Pause className="size-2.5" />}
        </button>
      </div>

      {/* Scrolling Marquee Container */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className={cn(
            "flex w-max items-center gap-6 whitespace-nowrap",
            !isPaused && "animate-marquee"
          )}
          style={{
            animationDuration: `${Math.max(25, events.length * 8)}s`,
          }}
        >
          {/* Double the array for seamless endless scroll loop */}
          {[...events, ...events].map((evt, idx) => (
            <div
              key={`${evt.id}-${idx}`}
              onClick={() => handleEventClick(evt)}
              className={cn(
                "group inline-flex items-center gap-2 px-1.5 py-0.5 rounded cursor-pointer transition-colors",
                evt.linkTo && "hover:bg-muted/80"
              )}
            >
              {/* Event Time */}
              <span className="text-[11px] font-mono text-muted-foreground/80 tabular-nums">
                {evt.time}
              </span>

              {/* Status Dot */}
              <span className={cn("size-1.5 rounded-full", SEVERITY_DOTS[evt.severity])} />

              {/* Tag Badge */}
              {evt.tag && (
                <span className="rounded bg-muted/60 px-1 py-0.2 text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                  {evt.tag}
                </span>
              )}

              {/* Event Content Text */}
              <span className="text-xs text-foreground/90 font-medium group-hover:text-primary transition-colors">
                {evt.text}
              </span>

              {/* Jump Icon */}
              {evt.linkTo && (
                <ArrowUpRight className="size-2.5 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              )}

              <span className="text-muted-foreground/40 font-light select-none ml-2">·</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
