import { RefreshCw, ShieldAlert, ShieldCheck, Inbox, Gauge } from "lucide-react";
import {
  useRevenueSummary,
  useAtRiskRevenue,
  useRecoveredRevenue,
} from "@/hooks/useRevenue";
import { MetricCard } from "@/components/revenue/MetricCard";
import { MetricSkeleton, ErrorState } from "@/components/revenue/QueryState";
import { AtRiskTable } from "@/components/revenue/AtRiskTable";
import { RecoveredTable } from "@/components/revenue/RecoveredTable";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";

export function RevenueWarRoom() {
  const summary = useRevenueSummary();
  const atRisk = useAtRiskRevenue();
  const recovered = useRecoveredRevenue();

  const isRefreshing =
    summary.isFetching || atRisk.isFetching || recovered.isFetching;

  const handleRefresh = () => {
    summary.refetch();
    atRisk.refetch();
    recovered.refetch();
  };

  const lastUpdated = summary.dataUpdatedAt
    ? formatDateTime(new Date(summary.dataUpdatedAt))
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Revenue War Room
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lastUpdated
              ? `Live view of at-risk and recovered revenue · Updated ${lastUpdated}`
              : "Live view of at-risk and recovered revenue"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Summary metrics */}
      {summary.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      ) : summary.isError ? (
        <div className="rounded-lg border border-border bg-card">
          <ErrorState
            message="Couldn't load revenue summary."
            onRetry={() => summary.refetch()}
          />
        </div>
      ) : summary.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total revenue at risk"
            value={formatCurrency(summary.data.total_at_risk)}
            helpText={`${summary.data.open_risk_event_count} open risk event${summary.data.open_risk_event_count === 1 ? "" : "s"}`}
            icon={ShieldAlert}
            tone="risk"
          />
          <MetricCard
            label="Total revenue recovered"
            value={formatCurrency(summary.data.total_recovered)}
            helpText={`${summary.data.recovered_risk_event_count} recovered event${summary.data.recovered_risk_event_count === 1 ? "" : "s"}`}
            icon={ShieldCheck}
            tone="positive"
          />
          <MetricCard
            label="Recovery rate"
            value={formatPercent(summary.data.recovery_rate)}
            helpText="Recovered vs. all resolved attempts"
            icon={Gauge}
            tone="info"
          />
          <MetricCard
            label="Pending approvals"
            value={String(summary.data.pending_approvals_count)}
            helpText="Awaiting a manual decision"
            icon={Inbox}
            tone="brand"
          />
        </div>
      ) : null}

      {/* At-risk revenue */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Revenue at risk
            </h3>
            <p className="text-xs text-muted-foreground">
              Open risk events, highest amount first
            </p>
          </div>
        </div>
        <AtRiskTable
          items={atRisk.data?.items}
          isLoading={atRisk.isLoading}
          isError={atRisk.isError}
          onRetry={() => atRisk.refetch()}
        />
      </section>

      {/* Recovered revenue */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Recently recovered
            </h3>
            <p className="text-xs text-muted-foreground">
              Risk events closed out by a successful playbook
            </p>
          </div>
        </div>
        <RecoveredTable
          items={recovered.data?.items}
          isLoading={recovered.isLoading}
          isError={recovered.isError}
          onRetry={() => recovered.refetch()}
        />
      </section>
    </div>
  );
}