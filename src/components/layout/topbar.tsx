import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Building2, CheckCheck, LogOut, Menu, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommandSearch } from "./command-search";
import { useAuth } from "@/auth/auth-context";
import { ROLE_LABEL } from "@/lib/nav";
import { db } from "@/lib/store";
import { dt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/app/ThemeSwitcher";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("rmc.read_notifications");
        if (stored) return new Set(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
    return new Set<string>();
  });

  if (!user) return null;

  const notifications = db.notifications.filter((n) => n.roles.includes(user.role));
  const unread = notifications.filter((n) => !readIds.has(n.id) && !n.read).length;

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("rmc.read_notifications", JSON.stringify([...next]));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(new Set(allIds));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("rmc.read_notifications", JSON.stringify(allIds));
      } catch {
        // ignore
      }
    }
  };

  const handleNotificationClick = (n: typeof notifications[0]) => {
    markAsRead(n.id);
    setPopoverOpen(false);

    const titleLower = n.title.toLowerCase();
    const descLower = n.description.toLowerCase();

    if (titleLower.includes("qc") || descLower.includes("qc") || descLower.includes("slump")) {
      void navigate({ to: "/qa" });
    } else if (titleLower.includes("batch") || titleLower.includes("production")) {
      void navigate({ to: "/production" });
    } else if (titleLower.includes("po") || titleLower.includes("order")) {
      void navigate({ to: "/sales/orders" });
    } else if (titleLower.includes("trip") || titleLower.includes("delivered") || titleLower.includes("dispatch")) {
      void navigate({ to: "/dispatcher" });
    }
  };

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu className="size-5" />
      </Button>

      <div className="flex-1">
        <CommandSearch />
      </div>

      <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-muted-foreground md:flex">
        <Building2 className="size-3.5 text-primary" />
        <span className="max-w-[190px] truncate">{user.plant}</span>
      </div>

      <ThemeSwitcher className="hidden sm:flex" />

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4.5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground animate-pulse">
                {unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-84 p-0 shadow-lg border-border">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {unread} unread
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">All caught up</span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {notifications.map((n) => {
              const isUnread = !readIds.has(n.id) && !n.read;
              return (
                <li
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "cursor-pointer px-3.5 py-2.5 transition-colors hover:bg-surface-raised text-left",
                    isUnread ? "bg-primary/5 hover:bg-primary/10" : "opacity-75 hover:opacity-100"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          n.kind === "success" && "bg-success",
                          n.kind === "warning" && "bg-warning",
                          n.kind === "error" && "bg-destructive",
                          n.kind === "info" && "bg-info",
                        )}
                      />
                      <p className={cn("text-xs font-medium", isUnread && "font-semibold text-foreground")}>
                        {n.title}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="size-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">{n.description}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground/80">{dt(n.at)}</p>
                </li>
              );
            })}
            {notifications.length === 0 && (
              <li className="px-3 py-8 text-center text-xs text-muted-foreground">You are all caught up.</li>
            )}
          </ul>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised py-1.5 pl-1.5 pr-3 transition-colors hover:border-primary/40">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/15 text-xs text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-medium leading-tight">{user.name}</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            <p className="text-sm">{user.name}</p>
            <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <UserRound className="size-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              logout();
              void navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
