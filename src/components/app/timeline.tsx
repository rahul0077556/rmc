import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  time: string;
  actor: string;
  message: string;
  tone?: "default" | "success" | "warning" | "error";
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No activity recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 pl-4">
      <span className="absolute left-[3px] top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={cn(
              "absolute -left-4 top-1.5 size-[7px] rounded-full",
              item.tone === "success" && "bg-success",
              item.tone === "warning" && "bg-warning",
              item.tone === "error" && "bg-destructive",
              (!item.tone || item.tone === "default") && "bg-primary",
            )}
          />
          <p className="text-xs text-muted-foreground">{item.time}</p>
          <p className="text-sm">
            <span className="font-medium">{item.actor}</span> <span className="text-muted-foreground">{item.message}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
