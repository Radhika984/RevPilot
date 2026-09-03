import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts";
import type { RecoveryTimelinePoint } from "@/hooks/useAnalytics";
import { ChartSkeleton, EmptyState, ErrorState } from "@/components/revenue/QueryState";
import { formatCurrency, formatShortDate } from "@/lib/format";

interface RecoveryTimelineChartProps {
  timeline: RecoveryTimelinePoint[] | undefined;
  hasAnyData: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function TimelineTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as RecoveryTimelinePoint;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{formatShortDate(label !== undefined ? String(label) : undefined)}</p>
      <p className="text-blue-600 dark:text-blue-400">Detected: {formatCurrency(point.detected_amount)}</p>
      <p className="text-emerald-600 dark:text-emerald-400">
        Recovered: {formatCurrency(point.recovered_amount)}
      </p>
    </div>
  );
}

export function RecoveryTimelineChart({
  timeline,
  hasAnyData,
  isLoading,
  isError,
  onRetry,
}: RecoveryTimelineChartProps) {
  if (isLoading) return <ChartSkeleton heightClassName="h-72" />;

  if (isError) {
    return <ErrorState message="Couldn't load the recovery timeline." onRetry={onRetry} />;
  }

  if (!hasAnyData || !timeline || timeline.length === 0) {
    return (
      <EmptyState
        title="No timeline data yet"
        description="Detected and recovered amounts will chart here once risk events start coming in."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={timeline} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="detectedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="recoveredGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => formatShortDate(value)}
          className="text-xs fill-muted-foreground"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          className="text-xs fill-muted-foreground"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCurrency(value)}
          width={72}
        />
        <Tooltip content={TimelineTooltip} />
        <Area
          type="monotone"
          dataKey="detected_amount"
          name="Detected"
          stroke="#3b82f6"
          fill="url(#detectedGradient)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="recovered_amount"
          name="Recovered"
          stroke="#10b981"
          fill="url(#recoveredGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}