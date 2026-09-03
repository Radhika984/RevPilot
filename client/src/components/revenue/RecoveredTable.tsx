import type { RecoveredItem } from "@/hooks/useRevenue";
import { formatCurrency, formatDateTime, formatRootCause, formatSourceType, formatStrategy } from "@/lib/format";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/revenue/QueryState";
import { badgeClassName } from "@/lib/playbookVisuals";

interface RecoveredTableProps {
  items: RecoveredItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function RecoveredTable({ items, isLoading, isError, onRetry }: RecoveredTableProps) {
  if (isLoading) return <TableSkeleton rows={5} />;

  if (isError) {
    return (
      <ErrorState message="Couldn't load recovered revenue." onRetry={onRetry} />
    );
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="No recoveries yet"
        description="Successfully recovered revenue will appear here once a playbook closes a risk event."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3 font-medium">Root cause</th>
            <th className="px-5 py-3 font-medium">Source</th>
            <th className="px-5 py-3 font-medium">Strategy used</th>
            <th className="px-5 py-3 font-medium">Recovered at</th>
            <th className="px-5 py-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-muted/40">
              <td className="px-5 py-4 font-medium text-foreground">
                {formatRootCause(item.root_cause)}
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatSourceType(item.source_type)}
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                <span className={badgeClassName("positive")}>
                  {formatStrategy(item.strategy)}
                </span>
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatDateTime(item.recovered_at)}
              </td>
              <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatCurrency(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}