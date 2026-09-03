import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { apiClient } from "@/lib/apiClient";
import type { RecoveryActionStrategy } from "@/hooks/usePolicies";

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  amount: number;
}

export interface RecoveryTimelinePoint {
  date: string;
  detected_amount: number;
  recovered_amount: number;
  recovered_count: number;
}

export interface RecoveryRateReport {
  funnel: FunnelStage[];
  recovery_rate: number | null;
  conversion_rate: number | null;
  timeline: RecoveryTimelinePoint[];
}

export interface StrategyPerformance {
  strategy: RecoveryActionStrategy;
  attempts: number;
  succeeded: number;
  failed: number;
  pending: number;
  skipped: number;
  success_rate: number | null;
  total_recovered_amount: number;
}

export interface RootCausePerformance {
  root_cause: string;
  playbooks: number;
  recovered: number;
  escalated: number;
  total_recovery_value: number;
  success_rate: number | null;
}

export interface ChainDepthBucket {
  chain_depth: number;
  count: number;
}

export interface PlaybookPerformanceReport {
  by_strategy: StrategyPerformance[];
  by_root_cause: RootCausePerformance[];
  chain_depth_distribution: ChainDepthBucket[];
}

export interface CalibrationBucket {
  bucket_label: string;
  bucket_min: number;
  bucket_max: number;
  sample_size: number;
  avg_predicted_confidence: number | null;
  observed_success_rate: number | null;
}

export interface RecalibrationReport {
  buckets: CalibrationBucket[];
  sample_size: number;
  overall_predicted_confidence: number | null;
  overall_observed_success_rate: number | null;
  recommendation: string | null;
}

/**
 * Shared plumbing for /api/analytics/* queries: resolves a fresh
 * Clerk session token per request and only fires once a session
 * exists — same pattern as useRevenue.ts's useAuthedRevenueQuery.
 */
function useAuthedAnalyticsQuery<T>(queryKey: readonly unknown[], path: string): UseQueryResult<T> {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<T>({
    queryKey,
    enabled: Boolean(isSignedIn),
    queryFn: async () => {
      const token = await getToken();
      const { data } = await apiClient.get<T>(path, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      return data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** GET /api/analytics/recovery-rate */
export function useRecoveryRateReport(days = 30): UseQueryResult<RecoveryRateReport> {
  return useAuthedAnalyticsQuery<RecoveryRateReport>(
    ["analytics", "recovery-rate", days],
    `/api/analytics/recovery-rate?days=${days}`
  );
}

/** GET /api/analytics/playbook-performance */
export function usePlaybookPerformanceReport(): UseQueryResult<PlaybookPerformanceReport> {
  return useAuthedAnalyticsQuery<PlaybookPerformanceReport>(
    ["analytics", "playbook-performance"],
    "/api/analytics/playbook-performance"
  );
}

/** GET /api/analytics/recalibration-report */
export function useRecalibrationReport(): UseQueryResult<RecalibrationReport> {
  return useAuthedAnalyticsQuery<RecalibrationReport>(
    ["analytics", "recalibration-report"],
    "/api/analytics/recalibration-report"
  );
}