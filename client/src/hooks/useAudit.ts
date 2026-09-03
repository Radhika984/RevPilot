import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { apiClient } from "@/lib/apiClient";

export interface AuditLedgerEntry {
  id: string;
  merchant_id: string;
  entity_type: string;
  entity_id: string;
  event_description: string;
  previous_hash: string | null;
  entry_hash: string | null;
  created_at: string;
}

interface AuditResponse {
  entries: AuditLedgerEntry[];
}

export interface AuditVerifyResult {
  valid: boolean;
  entries_checked: number;
  broken_at_entry_id: string | null;
  reason: string | null;
}

export interface AuditFilters {
  entityType?: string;
  q?: string;
}

/**
 * Shared plumbing for /api/audit* queries: resolves a fresh Clerk
 * session token per request and only fires once a session exists —
 * same pattern as usePlaybooks.ts's useAuthedPlaybookQuery.
 */
function useAuthedAuditQuery<T>(
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

function buildAuditQueryString(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.entityType) params.set("entity_type", filters.entityType);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** GET /api/audit — optionally filtered by entity_type and/or a search substring. */
export function useAuditLedger(filters: AuditFilters): UseQueryResult<AuditResponse> {
  const queryString = buildAuditQueryString(filters);
  return useAuthedAuditQuery<AuditResponse>(
    ["audit", filters.entityType ?? null, filters.q ?? null],
    `/api/audit${queryString}`
  );
}

/**
 * GET /api/audit/verify — "Verify Chain Integrity". Disabled by
 * default (query.enabled) so it only runs when the user asks for it;
 * the page triggers it via `refetch()`.
 */
export function useAuditVerify(enabled: boolean): UseQueryResult<AuditVerifyResult> {
  return useAuthedAuditQuery<AuditVerifyResult>(["audit", "verify"], "/api/audit/verify", enabled);
}