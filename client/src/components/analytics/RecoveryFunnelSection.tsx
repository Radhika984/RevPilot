import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts";
import { Gauge, TrendingUp } from "lucide-react";
import type { FunnelStage } from "@/hooks/useAnalytics";
import { MetricCard } from "@/components/revenue/MetricCard";
import { ChartSkeleton, EmptyState, ErrorState } from "@/components/revenue/QueryState";
import { formatCurrency, formatPercent } from "@/lib/format";

const STAGE_COLORS: Record<string, string> = {
  detected: "#3b82f6",
  playbook_generated: "#8b5cf6",
  attempted: "#f59e0b",
  recovered: "#10b981",
};

interface RecoveryFunnelSectionProps {
  funnel: FunnelStage[] | undefined;
  recoveryRate: number | null | undefined;
  conversionRate: number | null | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function FunnelTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const stage = payload[0].payload as FunnelStage;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{stage.label}</p>
      <p className="text-muted-foreground">
        {stage.count} · {formatCurrency(stage.amount)}
      </p>
    </div>
  );
}

export function RecoveryFunnelSection({
  funnel,
  recoveryRate,
  conversionRate,
  isLoading,
  isError,
  onRetry,
}: RecoveryFunnelSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartSkeleton heightClassName="h-72" />
        </div>
        <div className="space-y-4">
          <ChartSkeleton heightClassName="h-20" />
          <ChartSkeleton heightClassName="h-20" />
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Couldn't load the recovery funnel." onRetry={onRetry} />;
  }

  if (!funnel || funnel.length === 0 || funnel[0].count === 0) {
    return (
      <EmptyState
        title="No risk events yet"
        description="The recovery funnel fills in once RevPilot detects its first risk event."
      />
    );
  }

  const data = funnel.map((stage) => ({ ...stage, fill: STAGE_COLORS[stage.stage] ?? "#94a3b8" }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <FunnelChart>
            <Tooltip content={FunnelTooltip} />
            <Funnel dataKey="count" data={data} isAnimationActive>
              <LabelList
                position="right"
                dataKey="label"
                fill="currentColor"
                stroke="none"
                className="fill-foreground text-xs"
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-4">
        <MetricCard
          label="Recovery rate"
          value={formatPercent(recoveryRate ?? null)}
          helpText="Recovered vs. all resolved attempts"
          icon={Gauge}
        />
        <MetricCard
          label="Conversion rate"
          value={formatPercent(conversionRate ?? null)}
          helpText="Recovered vs. all risk events detected"
          icon={TrendingUp}
          tone="positive"
        />
      </div>
    </div>
  );
}