import { useNavigate } from "@tanstack/react-router";
import { Bell, Building2, LogOut, Menu, UserRound } from "lucide-react";
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

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const notifications = db.notifications.filter((n) => n.roles.includes(user.role));
  const unread = notifications.filter((n) => !n.read).length;
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

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4.5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <p className="border-b border-border px-3 py-2.5 text-sm font-semibold">Notifications</p>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id} className="border-b border-border/60 px-3 py-2.5 last:border-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      n.kind === "success" && "bg-success",
                      n.kind === "warning" && "bg-warning",
                      n.kind === "error" && "bg-destructive",
                      n.kind === "info" && "bg-info",
                    )}
                  />
                  <p className="text-sm font-medium">{n.title}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{dt(n.at)}</p>
              </li>
            ))}
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
