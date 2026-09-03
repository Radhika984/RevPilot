import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts";
import type {
  StrategyPerformance,
  RootCausePerformance,
  ChainDepthBucket,
} from "@/hooks/useAnalytics";
import { ChartSkeleton, EmptyState, ErrorState } from "@/components/revenue/QueryState";
import { formatCurrency, formatPercent, formatRootCause, formatStrategy } from "@/lib/format";

interface PlaybookPerformanceChartsProps {
  byStrategy: StrategyPerformance[] | undefined;
  byRootCause: RootCausePerformance[] | undefined;
  chainDepthDistribution: ChainDepthBucket[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function StrategyTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as StrategyPerformance;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{formatStrategy(row.strategy)}</p>
      <p className="text-muted-foreground">
        {row.attempts} attempt{row.attempts === 1 ? "" : "s"} · {formatPercent(row.success_rate)} success
      </p>
      <p className="text-emerald-600 dark:text-emerald-400">
        Recovered: {formatCurrency(row.total_recovered_amount)}
      </p>
    </div>
  );
}

function RootCauseTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as RootCausePerformance;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{formatRootCause(row.root_cause)}</p>
      <p className="text-muted-foreground">
        {row.playbooks} playbook{row.playbooks === 1 ? "" : "s"} · {formatPercent(row.success_rate)} success
      </p>
    </div>
  );
}

export function PlaybookPerformanceCharts({
  byStrategy,
  byRootCause,
  chainDepthDistribution,
  isLoading,
  isError,
  onRetry,
}: PlaybookPerformanceChartsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton heightClassName="h-64" />
        <ChartSkeleton heightClassName="h-64" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Couldn't load playbook performance." onRetry={onRetry} />;
  }

  const totalAttempts = (byStrategy ?? []).reduce((sum, row) => sum + row.attempts, 0);
  const hasRootCauseData = (byRootCause ?? []).length > 0;
  const hasChainDepthData = (chainDepthDistribution ?? []).length > 0;

  if (totalAttempts === 0 && !hasRootCauseData && !hasChainDepthData) {
    return (
      <EmptyState
        title="No playbook activity yet"
        description="Strategy, root cause, and chain-depth breakdowns will appear once playbooks start running."
      />
    );
  }

  const strategyData = (byStrategy ?? []).map((row) => ({
    ...row,
    strategyLabel: formatStrategy(row.strategy),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          By strategy
        </h4>
        {totalAttempts === 0 ? (
          <EmptyState title="No recovery attempts yet" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={strategyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="strategyLabel"
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis className="text-xs fill-muted-foreground" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={StrategyTooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="succeeded" name="Succeeded" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          By root cause
        </h4>
        {!hasRootCauseData ? (
          <EmptyState title="No playbooks yet" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byRootCause} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="root_cause"
                tickFormatter={(value) => formatRootCause(value)}
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis className="text-xs fill-muted-foreground" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={RootCauseTooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="playbooks" name="Playbooks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recovered" name="Recovered" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          By chain depth
        </h4>
        {!hasChainDepthData ? (
          <EmptyState title="No playbooks yet" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chainDepthDistribution}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="chain_depth"
                tickFormatter={(value) => `Depth ${value}`}
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis className="text-xs fill-muted-foreground" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(value) => [value, "Playbooks"] as [number, string]}
                labelFormatter={(label) => `Depth ${label}`}
              />
              <Bar dataKey="count" name="Playbooks" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}