import { useState } from "react";
import { Check, X, Pencil } from "lucide-react";
import type { ApprovalListItem } from "@/hooks/useApprovals";
import {
  formatCurrency,
  formatPercent,
  formatRootCause,
  formatSourceType,
  formatStrategy,
  formatTriggerReason,
} from "@/lib/format";
import { badgeClassName, approvalDecisionTone } from "@/lib/playbookVisuals";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/revenue/QueryState";
import { Button } from "@/components/ui/button";

interface ApprovalInboxTableProps {
  items: ApprovalListItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onModify: (id: string, modifiedAmount: number) => void;
  pendingActionId: string | null;
}

export function ApprovalInboxTable({
  items,
  isLoading,
  isError,
  onRetry,
  onApprove,
  onReject,
  onModify,
  pendingActionId,
}: ApprovalInboxTableProps) {
  if (isLoading) return <TableSkeleton rows={4} />;

  if (isError) {
    return <ErrorState message="Couldn't load the approval inbox." onRetry={onRetry} />;
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="No approvals waiting"
        description="Playbooks held for a policy breach (ceiling, daily cap, or low confidence) will appear here for a human decision."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((approval) => (
        <ApprovalRow
          key={approval.id}
          approval={approval}
          onApprove={onApprove}
          onReject={onReject}
          onModify={onModify}
          isBusy={pendingActionId === approval.id}
        />
      ))}
    </ul>
  );
}

interface ApprovalRowProps {
  approval: ApprovalListItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onModify: (id: string, modifiedAmount: number) => void;
  isBusy: boolean;
}

function ApprovalRow({ approval, onApprove, onReject, onModify, isBusy }: ApprovalRowProps) {
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedAmount, setModifiedAmount] = useState(
    String(approval.recommended_action.expected_value)
  );

  const confirmModify = () => {
    const parsed = Number(modifiedAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onModify(approval.id, parsed);
    setIsModifying(false);
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">
              {formatRootCause(approval.playbook.root_cause)}
            </p>
            <span className={badgeClassName(approvalDecisionTone(approval.decision))}>
              {formatTriggerReason(approval.trigger_reason)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatSourceType(approval.playbook.risk_event.source_type)} ·{" "}
            {formatCurrency(approval.playbook.risk_event.amount)} at risk · Chain depth{" "}
            {approval.playbook.chain_depth} · Recovery odds{" "}
            {formatPercent(approval.playbook.recovery_probability)}
          </p>
          <p className="text-sm text-muted-foreground">
            Recommended: {formatStrategy(approval.recommended_action.strategy)} for{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(approval.recommended_action.expected_value)}
            </span>{" "}
            at {formatPercent(approval.recommended_action.confidence)} confidence
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            playbook_id: {approval.playbook_id}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isModifying ? (
            <>
              <input
                type="number"
                min={0}
                step="0.01"
                value={modifiedAmount}
                onChange={(e) => setModifiedAmount(e.target.value)}
                className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Modified amount"
                disabled={isBusy}
              />
              <Button size="sm" onClick={confirmModify} disabled={isBusy}>
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsModifying(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => onApprove(approval.id)}
                disabled={isBusy}
              >
                <Check />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsModifying(true)}
                disabled={isBusy}
              >
                <Pencil />
                Modify
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onReject(approval.id)}
                disabled={isBusy}
              >
                <X />
                Reject
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}