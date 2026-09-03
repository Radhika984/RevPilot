import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { apiClient } from "@/lib/apiClient";

/** Mirrors schema.prisma's RecoveryActionStrategy enum. */
export type RecoveryActionStrategy =
  | "retry"
  | "wait"
  | "payment_link"
  | "escalate"
  | "human_approval"
  | "ignore";

/** Mirrors schema.prisma's PolicyModule enum. */
export type PolicyModule =
  | "subscription"
  | "payment"
  | "payment_link"
  | "settlement";

export type StrategyToggles = Record<RecoveryActionStrategy, boolean>;

export interface MerchantPolicyItem {
  module: PolicyModule;
  configured: boolean;
  ceiling_amount: number | null;
  daily_cap: number | null;
  min_confidence: number | null;
  strategy_toggles: StrategyToggles;
  updated_at: string | null;
}

interface PoliciesResponse {
  policies: MerchantPolicyItem[];
}

export interface PolicyUpdateInput {
  module: PolicyModule;
  ceiling_amount: number;
  daily_cap: number;
  min_confidence: number;
  strategy_toggles: StrategyToggles;
}

interface PolicyUpdateResponse {
  policy: MerchantPolicyItem;
}

/**
 * Shared plumbing for /api/policies queries: resolves a fresh Clerk
 * session token per request and only fires once a session exists.
 */
function useAuthedPoliciesQuery<T>(
  queryKey: readonly unknown[],
  path: string,
): UseQueryResult<T> {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<T>({
    queryKey,
    enabled: Boolean(isSignedIn),
    queryFn: async () => {
      const token = await getToken();

      const { data } = await apiClient.get<T>(path, {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : undefined,
      });

      return data;
    },
    staleTime: 30_000,
  });
}

/** GET /api/policies — one entry per PolicyModule, configured or not. */
export function useMerchantPolicies(): UseQueryResult<PoliciesResponse> {
  return useAuthedPoliciesQuery<PoliciesResponse>(
    ["policies"],
    "/api/policies",
  );
}

/**
 * PUT /api/policies/:module — upserts one module's policy.
 */
export function useUpdateMerchantPolicy(): UseMutationResult<
  PolicyUpdateResponse,
  Error,
  PolicyUpdateInput
> {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<PolicyUpdateResponse, Error, PolicyUpdateInput>({
    mutationFn: async ({ module, ...body }) => {
      const token = await getToken();

      const { data } = await apiClient.put<PolicyUpdateResponse>(
        `/api/policies/${module}`,
        body,
        {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : undefined,
        },
      );

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["policies"],
      });
    },
  });
}