import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  useRecoveryRateReport,
  usePlaybookPerformanceReport,
  useRecalibrationReport,
} from "@/hooks/useAnalytics";
import { RecoveryFunnelSection } from "@/components/analytics/RecoveryFunnelSection";
import { RecoveryTimelineChart } from "@/components/analytics/RecoveryTimelineChart";
import { PlaybookPerformanceCharts } from "@/components/analytics/PlaybookPerformanceCharts";
import { RecalibrationChart } from "@/components/analytics/RecalibrationChart";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export function Analytics() {
  const [days, setDays] = useState(30);

  const recoveryRate = useRecoveryRateReport(days);
  const playbookPerformance = usePlaybookPerformanceReport();
  const recalibration = useRecalibrationReport();

  const isRefreshing =
    recoveryRate.isFetching || playbookPerformance.isFetching || recalibration.isFetching;

  const handleRefresh = () => {
    recoveryRate.refetch();
    playbookPerformance.refetch();
    recalibration.refetch();
  };

  const lastUpdated = recoveryRate.dataUpdatedAt
    ? formatDateTime(new Date(recoveryRate.dataUpdatedAt))
    : null;

  const hasFunnelData = Boolean(recoveryRate.data && recoveryRate.data.funnel[0]?.count > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Recovery Analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lastUpdated
              ? `Funnel, distributions, and confidence calibration · Updated ${lastUpdated}`
              : "Funnel, distributions, and confidence calibration"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="Timeline window"
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option} days
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Recovery funnel + rates */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Recovery funnel</h3>
        <RecoveryFunnelSection
          funnel={recoveryRate.data?.funnel}
          recoveryRate={recoveryRate.data?.recovery_rate}
          conversionRate={recoveryRate.data?.conversion_rate}
          isLoading={recoveryRate.isLoading}
          isError={recoveryRate.isError}
          onRetry={() => recoveryRate.refetch()}
        />
      </section>

      {/* Timeline */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Detected vs. recovered — last {days} days
        </h3>
        <div className="rounded-lg border border-border bg-card p-4">
          <RecoveryTimelineChart
            timeline={recoveryRate.data?.timeline}
            hasAnyData={hasFunnelData}
            isLoading={recoveryRate.isLoading}
            isError={recoveryRate.isError}
            onRetry={() => recoveryRate.refetch()}
          />
        </div>
      </section>

      {/* Playbook performance distributions */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Playbook performance</h3>
        <PlaybookPerformanceCharts
          byStrategy={playbookPerformance.data?.by_strategy}
          byRootCause={playbookPerformance.data?.by_root_cause}
          chainDepthDistribution={playbookPerformance.data?.chain_depth_distribution}
          isLoading={playbookPerformance.isLoading}
          isError={playbookPerformance.isError}
          onRetry={() => playbookPerformance.refetch()}
        />
      </section>

      {/* Recalibration report */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Confidence recalibration</h3>
          <p className="text-xs text-muted-foreground">
            Predicted confidence vs. observed outcomes, bucketed — informs Merchant Policies'
            min_confidence thresholds
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <RecalibrationChart
            buckets={recalibration.data?.buckets}
            sampleSize={recalibration.data?.sample_size}
            recommendation={recalibration.data?.recommendation}
            isLoading={recalibration.isLoading}
            isError={recalibration.isError}
            onRetry={() => recalibration.refetch()}
          />
        </div>
      </section>
    </div>
  );
}