import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, AlertTriangle, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/auth/auth-context";
import { generateInsights, type Insight } from "@/insights";
import { LoadingState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights · RMC Command Center" },
      { name: "description", content: "Smart, contextual AI-driven insights for your role." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role) {
      generateInsights(user.role).then((data) => {
        setInsights(data);
        setLoading(false);
      });
    }
  }, [user?.role]);

  if (loading) {
    return <LoadingState rows={3} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="AI Insights" 
        subtitle={`Smart operational intelligence tailored for ${user?.role.replace("_", " ")}`} 
      />

      <div className="grid gap-4 md:grid-cols-2">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const isWarning = insight.type === "warning";
  const isAction = insight.type === "action";
  const isSuccess = insight.type === "success";

  const Icon = isWarning ? AlertTriangle : isAction ? Sparkles : isSuccess ? CheckCircle2 : Info;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-5 transition-shadow hover:shadow-md",
      isWarning ? "border-amber-500/30 bg-amber-500/5" :
      isAction ? "border-primary/30 bg-primary/5" :
      isSuccess ? "border-emerald-500/30 bg-emerald-500/5" :
      "border-border bg-surface"
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          isWarning ? "bg-amber-500/20 text-amber-500" :
          isAction ? "brand-gradient text-primary-foreground" :
          isSuccess ? "bg-emerald-500/20 text-emerald-500" :
          "bg-secondary text-secondary-foreground"
        )}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="font-semibold">{insight.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
          
          {insight.metric && (
            <div className="mt-3 inline-block rounded-md bg-background px-2.5 py-1 text-xs font-medium border border-border/50">
              {insight.metric}
            </div>
          )}
        </div>
      </div>
      
      {isAction && (
        <div className="mt-5 flex justify-end">
          <Button variant="outline" size="sm" className="gap-2">
            Review Action <ArrowRight className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
