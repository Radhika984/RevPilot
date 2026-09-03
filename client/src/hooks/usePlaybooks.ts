import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { apiClient } from "@/lib/apiClient";

export interface PlaybookRiskEventSummary {
  id: string;
  source_type: string;
  root_cause: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface PlaybookListItem {
  id: string;
  root_cause: string;
  status: string;
  recovery_probability: number;
  recovery_value: number;
  chain_depth: number;
  created_at: string;
  risk_event: PlaybookRiskEventSummary;
}

export interface RecoveryActionItem {
  id: string;
  step_number: number;
  strategy: string;
  confidence: number;
  expected_value: number;
  outcome: string;
  razorpay_reference_id: string | null;
  executed_at: string | null;
}

export interface StoppingRule {
  max_attempts?: number;
  stop_condition?: string;
  [key: string]: unknown;
}

export interface PlaybookDetail extends PlaybookListItem {
  waiting_period_seconds: number;
  stopping_rule: StoppingRule;
  explainable_reasoning: string;
  recovery_actions: RecoveryActionItem[];
}

interface PlaybooksResponse {
  playbooks: PlaybookListItem[];
}

interface PlaybookResponse {
  playbook: PlaybookDetail;
}

/**
 * Shared plumbing for every /api/playbooks* query: resolves a fresh
 * Clerk session token per request and only fires once a session
 * actually exists — same pattern as useRevenue.ts's
 * useAuthedRevenueQuery, kept separate since playbooks and revenue
 * are independent query key namespaces.
 */
function useAuthedPlaybookQuery<T>(
  queryKey: readonly unknown[],
  path: string,
  enabled = true
): UseQueryResult<T> {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<T>({
    queryKey,
    enabled: Boolean(isSignedIn) && enabled,
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

/** GET /api/playbooks — every playbook for the authenticated merchant, newest first. */
export function usePlaybooks(): UseQueryResult<PlaybooksResponse> {
  return useAuthedPlaybookQuery<PlaybooksResponse>(["playbooks"], "/api/playbooks");
}

/** GET /api/playbooks/:id — a single playbook with its ordered recovery actions. */
export function usePlaybook(id: string | undefined): UseQueryResult<PlaybookResponse> {
  return useAuthedPlaybookQuery<PlaybookResponse>(
    ["playbooks", id],
    `/api/playbooks/${id}`,
    Boolean(id)
  );
}