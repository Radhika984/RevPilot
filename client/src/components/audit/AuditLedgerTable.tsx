import type { AuditLedgerEntry } from "@/hooks/useAudit";
import { formatDateTime, formatEntityType, formatHash } from "@/lib/format";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/revenue/QueryState";

interface AuditLedgerTableProps {
  entries: AuditLedgerEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilters: boolean;
}

export function AuditLedgerTable({
  entries,
  isLoading,
  isError,
  onRetry,
  hasActiveFilters,
}: AuditLedgerTableProps) {
  if (isLoading) return <TableSkeleton rows={6} />;

  if (isError) {
    return <ErrorState message="Couldn't load the audit ledger." onRetry={onRetry} />;
  }

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? "No matching audit entries" : "No audit entries yet"}
        description={
          hasActiveFilters
            ? "Try a different entity type or search term."
            : "Ledger entries for risk events, playbooks, recovery actions, and approvals will appear here as they're recorded."
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3 font-medium">Entity</th>
            <th className="px-5 py-3 font-medium">Entity ID</th>
            <th className="px-5 py-3 font-medium">Event</th>
            <th className="px-5 py-3 font-medium">Previous hash</th>
            <th className="px-5 py-3 font-medium">Entry hash</th>
            <th className="px-5 py-3 font-medium">Recorded</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => (
            <tr key={entry.id} className="transition-colors hover:bg-muted/40">
              <td className="px-5 py-4 font-medium text-foreground">
                {formatEntityType(entry.entity_type)}
              </td>
              <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                {formatHash(entry.entity_id)}
              </td>
              <td className="px-5 py-4 text-muted-foreground">{entry.event_description}</td>
              <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                {formatHash(entry.previous_hash)}
              </td>
              <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                {formatHash(entry.entry_hash)}
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatDateTime(entry.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}