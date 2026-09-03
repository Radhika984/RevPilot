import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { apiClient } from "@/lib/apiClient";

export interface RevenueSummary {
  currency: string;
  total_at_risk: number;
  open_risk_event_count: number;
  total_recovered: number;
  recovered_risk_event_count: number;
  escalated_risk_event_count: number;
  recovery_rate: number | null;
  pending_approvals_count: number;
}

export interface AtRiskPlaybookSummary {
  id: string;
  status: string;
  recovery_probability: number;
  recovery_value: number;
}

export interface AtRiskItem {
  id: string;
  source_type: string;
  root_cause: string;
  amount: number;
  status: string;
  created_at: string;
  playbook: AtRiskPlaybookSummary | null;
}

export interface AtRiskRevenue {
  items: AtRiskItem[];
  total_at_risk: number;
}

export interface RecoveredItem {
  id: string;
  source_type: string;
  root_cause: string;
  amount: number;
  recovered_at: string | null;
  strategy: string | null;
  razorpay_reference_id: string | null;
}

export interface RecoveredRevenue {
  items: RecoveredItem[];
  total_recovered: number;
}

/**
 * Shared plumbing for every /api/revenue/* query: resolves a fresh
 * Clerk session token per request (Clerk tokens are short-lived and
 * must not be cached across requests) and only fires once a session
 * actually exists, so the AppShell never fires an authenticated query
 * before Clerk has finished loading.
 */
function useAuthedRevenueQuery<T>(
  queryKey: readonly unknown[],
  path: string
): UseQueryResult<T> {
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

export function useRevenueSummary(): UseQueryResult<RevenueSummary> {
  return useAuthedRevenueQuery<RevenueSummary>(
    ["revenue", "summary"],
    "/api/revenue/summary"
  );
}

export function useAtRiskRevenue(): UseQueryResult<AtRiskRevenue> {
  return useAuthedRevenueQuery<AtRiskRevenue>(
    ["revenue", "at-risk"],
    "/api/revenue/at-risk"
  );
}

export function useRecoveredRevenue(): UseQueryResult<RecoveredRevenue> {
  return useAuthedRevenueQuery<RecoveredRevenue>(
    ["revenue", "recovered"],
    "/api/revenue/recovered"
  );
}
