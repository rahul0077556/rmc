import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  label: string;
  at?: string;
}

export function Stepper({
  steps,
  current,
  failed,
}: {
  steps: Step[];
  current: number;
  failed?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-0 md:flex-row md:items-start md:gap-0">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.label} className="relative flex flex-1 gap-3 md:flex-col md:items-center md:text-center">
            <div className="flex flex-col items-center md:w-full md:flex-row">
              <span className="hidden flex-1 md:block">
                {i > 0 && <span className={cn("block h-px w-full", done || active ? "bg-primary/60" : "bg-border")} />}
              </span>
              <span
                className={cn(
                  "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-success/40 bg-success/15 text-success",
                  active && !failed && "border-primary bg-primary text-primary-foreground",
                  active && failed && "border-destructive bg-destructive/15 text-destructive",
                  !done && !active && "border-border bg-surface-raised text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="hidden flex-1 md:block">
                {i < steps.length - 1 && <span className={cn("block h-px w-full", done ? "bg-primary/60" : "bg-border")} />}
              </span>
              {i < steps.length - 1 && (
                <span className={cn("absolute left-3.5 top-7 h-full w-px md:hidden", done ? "bg-primary/60" : "bg-border")} />
              )}
            </div>
            <div className="pb-6 md:pb-0 md:pt-2">
              <p className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>{step.label}</p>
              {step.at && <p className="mt-0.5 text-[11px] text-muted-foreground">{step.at}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
