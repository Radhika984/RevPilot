import { ChevronRight } from "lucide-react";
import type { PlaybookListItem } from "@/hooks/usePlaybooks";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatPlaybookStatus,
  formatRootCause,
  formatSourceType,
} from "@/lib/format";
import { badgeClassName, playbookStatusTone } from "@/lib/playbookVisuals";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/revenue/QueryState";

interface RecoveryQueueTableProps {
  items: PlaybookListItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (playbookId: string) => void;
}

export function RecoveryQueueTable({
  items,
  isLoading,
  isError,
  onRetry,
  onSelect,
}: RecoveryQueueTableProps) {
  if (isLoading) return <TableSkeleton rows={6} />;

  if (isError) {
    return (
      <ErrorState message="Couldn't load the recovery queue." onRetry={onRetry} />
    );
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="No playbooks in the queue"
        description="Adaptive playbooks generated for at-risk revenue will appear here as soon as the decision engine produces one."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3 font-medium">Root cause</th>
            <th className="px-5 py-3 font-medium">Source</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Confidence</th>
            <th className="px-5 py-3 font-medium">Chain depth</th>
            <th className="px-5 py-3 font-medium">Created</th>
            <th className="px-5 py-3 text-right font-medium">Recovery value</th>
            <th className="px-5 py-3" aria-hidden="true" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="cursor-pointer hover:bg-muted/40"
            >
              <td className="px-5 py-4 font-medium text-foreground">
                {formatRootCause(item.root_cause)}
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatSourceType(item.risk_event.source_type)}
              </td>
              <td className="px-5 py-4">
                <span className={badgeClassName(playbookStatusTone(item.status))}>
                  {formatPlaybookStatus(item.status)}
                </span>
              </td>
              <td className="px-5 py-4 text-muted-foreground tabular-nums">
                {formatPercent(item.recovery_probability)}
              </td>
              <td className="px-5 py-4 text-muted-foreground tabular-nums">
                {item.chain_depth}
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatDateTime(item.created_at)}
              </td>
              <td className="px-5 py-4 text-right font-medium tabular-nums text-foreground">
                {formatCurrency(item.recovery_value)}
              </td>
              <td className="px-5 py-4 text-right">
                <ChevronRight className="ml-auto size-4 text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}