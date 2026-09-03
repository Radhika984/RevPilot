import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { apiClient } from "@/lib/apiClient";

export interface ApprovalRiskEventSummary {
  id: string;
  source_type: string;
  root_cause: string;
  amount: number;
  status: string;
}

export interface ApprovalPlaybookSummary {
  id: string;
  root_cause: string;
  status: string;
  recovery_probability: number;
  recovery_value: number;
  chain_depth: number;
  risk_event: ApprovalRiskEventSummary;
}

export interface ApprovalRecommendedAction {
  strategy: string;
  confidence: number;
  expected_value: number;
}

export interface ApprovalListItem {
  id: string;
  playbook_id: string;
  trigger_reason: string;
  recommended_action: ApprovalRecommendedAction;
  approver_email: string;
  decision: string;
  modified_amount: number | null;
  decided_at: string | null;
  playbook: ApprovalPlaybookSummary;
}

interface ApprovalsResponse {
  approvals: ApprovalListItem[];
}

interface ApprovalActionResponse {
  approval: {
    id: string;
    decision: string;
    modified_amount: number | null;
    decided_at: string | null;
  };
}

/**
 * Shared plumbing for /api/approvals* queries: resolves a fresh Clerk
 * session token per request and only fires once a session exists —
 * same pattern as usePlaybooks.ts's useAuthedPlaybookQuery.
 */
function useAuthedApprovalsQuery<T>(
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

/** GET /api/approvals?decision=pending — the Approval Inbox's real pending approvals. */
export function usePendingApprovals(): UseQueryResult<ApprovalsResponse> {
  return useAuthedApprovalsQuery<ApprovalsResponse>(
    ["approvals", "pending"],
    "/api/approvals?decision=pending"
  );
}

type ApprovalActionVariables = { id: string; modifiedAmount?: number };

/**
 * Shared plumbing for the three existing decision endpoints:
 * POST /api/approvals/:id/approve
 * POST /api/approvals/:id/reject
 * POST /api/approvals/:id/modify
 *
 * No approval logic is duplicated on the client — this only calls the
 * existing routes/approvals.ts endpoints, which delegate to the
 * existing services/policy-engine/approvalActions.ts functions.
 */
function useApprovalAction(
  action: "approve" | "reject" | "modify"
): UseMutationResult<ApprovalActionResponse, Error, ApprovalActionVariables> {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<ApprovalActionResponse, Error, ApprovalActionVariables>({
    mutationFn: async ({ id, modifiedAmount }) => {
      const token = await getToken();
      const body = action === "modify" ? { modified_amount: modifiedAmount } : undefined;
      const { data } = await apiClient.post<ApprovalActionResponse>(
        `/api/approvals/${id}/${action}`,
        body,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });
}

export function useApproveApproval() {
  return useApprovalAction("approve");
}

export function useRejectApproval() {
  return useApprovalAction("reject");
}

export function useModifyApproval() {
  return useApprovalAction("modify");
}