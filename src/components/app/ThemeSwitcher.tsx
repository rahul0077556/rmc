import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectTheme = "amber" | "indigo" | "emerald";

export const THEMES: { id: ProjectTheme; label: string; dotColor: string; bg: string }[] = [
  { id: "amber", label: "Safety Amber (Construction)", dotColor: "bg-amber-400", bg: "hover:bg-amber-500/10" },
  { id: "indigo", label: "Executive Indigo (Corporate)", dotColor: "bg-indigo-400", bg: "hover:bg-indigo-500/10" },
  { id: "emerald", label: "Eco Emerald (Green Plant)", dotColor: "bg-emerald-400", bg: "hover:bg-emerald-500/10" },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const [theme, setTheme] = useState<ProjectTheme>("amber");

  useEffect(() => {
    const saved = localStorage.getItem("rmc.theme") as ProjectTheme | null;
    const initial = saved && ["amber", "indigo", "emerald"].includes(saved) ? saved : "amber";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function selectTheme(newTheme: ProjectTheme) {
    setTheme(newTheme);
    localStorage.setItem("rmc.theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/90 backdrop-blur-sm px-2.5 py-1 text-xs shadow-xs", className)}>
      <Palette className="size-3.5 text-muted-foreground mr-0.5 shrink-0" />
      <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline mr-0.5">Theme:</span>
      <div className="flex items-center gap-1.5">
        {THEMES.map((t) => {
          const isSelected = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => selectTheme(t.id)}
              title={t.label}
              type="button"
              className={cn(
                "relative flex size-4.5 items-center justify-center rounded-full transition-all duration-150 cursor-pointer",
                t.dotColor,
                isSelected
                  ? "scale-105 ring-2 ring-white/90 shadow-sm"
                  : "opacity-60 hover:opacity-100 hover:scale-105"
              )}
            >
              {isSelected && <Check className="size-2.5 text-slate-950 stroke-[3]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
