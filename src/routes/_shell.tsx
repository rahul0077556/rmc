import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PlantEventTicker } from "@/components/common/PlantEventTicker";
import { RmcChatbot } from "@/components/chatbot/RmcChatbot";
import { useAuth } from "@/auth/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) void navigate({ to: "/" });
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading plant data…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden lg:block">
        <AppSidebar role={user.role} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">
            <AppSidebar role={user.role} collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
          <button
            aria-label="Close navigation"
            className="flex-1 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className={cn("flex min-w-0 flex-1 flex-col")}>
        <Topbar onMenu={() => setMobileOpen(true)} />
        <PlantEventTicker />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-20">
          <Outlet />
        </main>
      </div>

      {/* Floating AI Plant Copilot */}
      <RmcChatbot />
    </div>
  );
}
