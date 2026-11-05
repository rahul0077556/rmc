import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/tv")({
  component: TvRedirect,
});

function TvRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/queue" });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">
      Redirecting to Command Center Queue...
    </div>
  );
}
