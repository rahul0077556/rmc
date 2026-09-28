import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

type Tone = "success" | "warning" | "error" | "info" | "neutral" | "accent";

const TONES: Record<string, Tone> = {
  // PO
  DRAFT: "neutral",
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "error",
  IN_PROGRESS: "accent",
  COMPLETED: "success",
  CANCELLED: "neutral",
  // Trip
  PLANNED: "neutral",
  SENT_TO_PRODUCTION: "info",
  BATCHING: "accent",
  LOADED: "info",
  QC_PENDING: "warning",
  QC_APPROVED: "success",
  QC_REJECTED: "error",
  CORRECTING: "warning",
  REPLACED: "neutral",
  DISPATCHED: "accent",
  IN_TRANSIT: "info",
  DELIVERED: "success",
  // Invoice / tests
  ISSUED: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "error",
  PENDING: "warning",
  PASS: "success",
  FAIL: "error",
  AVAILABLE: "success",
  ASSIGNED: "info",
  MAINTENANCE: "warning",
  UNAVAILABLE: "neutral",
  INSUFFICIENT: "error",
};

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  error: "bg-destructive/12 text-destructive border-destructive/25",
  info: "bg-info/12 text-info border-info/25",
  accent: "bg-primary/14 text-primary border-primary/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  status,
  className,
  tone,
}: {
  status: string;
  className?: string;
  tone?: Tone;
}) {
  const resolved = tone ?? TONES[status.toUpperCase().replace(/ /g, "_")] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        TONE_CLASS[resolved],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {titleCase(status)}
    </span>
  );
}
