import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";

interface FilterBarProps {
  search?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  
  // Generic filters
  filters?: {
    key: string;
    placeholder: string;
    value?: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
  }[];

  // Date presets (if applicable)
  datePreset?: string;
  onDatePresetChange?: (preset: string) => void;
  datePresets?: { label: string; value: string }[];
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  datePreset,
  onDatePresetChange,
  datePresets = [
    { label: "Today", value: "today" },
    { label: "Last 7 Days", value: "7d" },
    { label: "Last 30 Days", value: "30d" },
    { label: "This Month", value: "this_month" },
    { label: "All Time", value: "all" },
  ]
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(search ?? "");
  const debouncedSearch = useDebounce(localSearch, 300);

  // Sync prop to local state if changed externally
  useEffect(() => {
    if (search !== undefined && search !== localSearch) {
      setLocalSearch(search);
    }
  }, [search]);

  // Bubble up debounced search
  useEffect(() => {
    if (onSearchChange && debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange, search]);

  const hasActiveFilters = 
    (localSearch.trim().length > 0) || 
    filters.some(f => f.value && f.value !== "all") ||
    (datePreset && datePreset !== "all");

  const handleClear = () => {
    setLocalSearch("");
    if (onSearchChange) onSearchChange("");
    if (onDatePresetChange) onDatePresetChange("all");
    filters.forEach(f => f.onChange("all"));
  };

  return (
    <div className="panel flex flex-wrap items-center gap-2 p-3">
      {onSearchChange && (
        <div className="relative min-w-[200px] flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            value={localSearch} 
            onChange={(e) => setLocalSearch(e.target.value)} 
            placeholder={searchPlaceholder} 
            className="pl-9 pr-9" 
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setLocalSearch("")}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      )}

      {onDatePresetChange && (
        <Select value={datePreset || "all"} onValueChange={onDatePresetChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            {datePresets.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filters.map((filter) => (
        <Select key={filter.key} value={filter.value || "all"} onValueChange={filter.onChange}>
          <SelectTrigger className="min-w-32 max-w-xs">
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {filter.placeholder.toLowerCase()}</SelectItem>
            {filter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {hasActiveFilters && (
        <Button variant="ghost" onClick={handleClear} className="text-muted-foreground ml-auto h-9 px-3">
          Clear filters
        </Button>
      )}
    </div>
  );
}
