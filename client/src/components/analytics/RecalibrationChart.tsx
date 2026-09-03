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
import { Info, TrendingDown, TrendingUp, CircleCheckBig } from "lucide-react";
import type { CalibrationBucket } from "@/hooks/useAnalytics";
import { ChartSkeleton, EmptyState, ErrorState } from "@/components/revenue/QueryState";
import { formatPercent } from "@/lib/format";

interface RecalibrationChartProps {
  buckets: CalibrationBucket[] | undefined;
  sampleSize: number | undefined;
  recommendation: string | null | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function CalibrationTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0].payload as CalibrationBucket;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{label} predicted confidence</p>
      <p className="text-blue-600 dark:text-blue-400">
        Predicted: {formatPercent(bucket.avg_predicted_confidence)}
      </p>
      <p className="text-emerald-600 dark:text-emerald-400">
        Observed: {formatPercent(bucket.observed_success_rate)}
      </p>
      <p className="text-muted-foreground">{bucket.sample_size} decided outcome{bucket.sample_size === 1 ? "" : "s"}</p>
    </div>
  );
}

function recommendationTone(recommendation: string): { icon: typeof Info; className: string } {
  if (recommendation.includes("overconfident")) {
    return {
      icon: TrendingDown,
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400",
    };
  }
  if (recommendation.includes("underconfident")) {
    return {
      icon: TrendingUp,
      className:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400",
    };
  }
  return {
    icon: CircleCheckBig,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
  };
}

export function RecalibrationChart({
  buckets,
  sampleSize,
  recommendation,
  isLoading,
  isError,
  onRetry,
}: RecalibrationChartProps) {
  if (isLoading) return <ChartSkeleton heightClassName="h-72" />;

  if (isError) {
    return <ErrorState message="Couldn't load the recalibration report." onRetry={onRetry} />;
  }

  if (!sampleSize || sampleSize === 0) {
    return (
      <EmptyState
        title="Not enough data yet"
        description="Once recovery actions succeed or fail, this compares the Decision Engine's predicted confidence against what actually happened."
      />
    );
  }

  const tone = recommendation ? recommendationTone(recommendation) : null;
  const ToneIcon = tone?.icon ?? Info;

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="bucket_label"
            className="text-xs fill-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            className="text-xs fill-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatPercent(value)}
            domain={[0, 1]}
          />
          <Tooltip content={CalibrationTooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="avg_predicted_confidence" name="Predicted confidence" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="observed_success_rate" name="Observed success rate" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {recommendation && tone ? (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${tone.className}`}>
          <ToneIcon className="size-4 shrink-0" />
          <span>{recommendation}</span>
        </div>
      ) : null}
    </div>
  );
}