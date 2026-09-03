import type { AtRiskItem } from "@/hooks/useRevenue";
import { formatCurrency, formatDateTime, formatPercent, formatRootCause, formatSourceType } from "@/lib/format";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/revenue/QueryState";

interface AtRiskTableProps {
  items: AtRiskItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function AtRiskTable({ items, isLoading, isError, onRetry }: AtRiskTableProps) {
  if (isLoading) return <TableSkeleton rows={5} />;

  if (isError) {
    return (
      <ErrorState message="Couldn't load at-risk revenue." onRetry={onRetry} />
    );
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="No revenue currently at risk"
        description="New risk events from failed payments and subscriptions will show up here as they're detected."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3 font-medium">Root cause</th>
            <th className="px-5 py-3 font-medium">Source</th>
            <th className="px-5 py-3 font-medium">Recommended strategy</th>
            <th className="px-5 py-3 font-medium">Confidence</th>
            <th className="px-5 py-3 font-medium">Detected</th>
            <th className="px-5 py-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-muted/40">
              <td className="px-5 py-4 font-medium text-foreground">
                {formatRootCause(item.root_cause)}
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatSourceType(item.source_type)}
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {item.playbook ? (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {item.playbook.status === "generated" ? "Ready to run" : item.playbook.status}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Awaiting playbook</span>
                )}
              </td>
              <td className="px-5 py-4 text-muted-foreground tabular-nums">
                {item.playbook ? formatPercent(item.playbook.recovery_probability) : "—"}
              </td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatDateTime(item.created_at)}
              </td>
              <td className="px-5 py-4 text-right font-medium tabular-nums text-amber-700 dark:text-amber-400">
                {formatCurrency(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
