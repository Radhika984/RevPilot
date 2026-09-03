import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  usePendingApprovals,
  useApproveApproval,
  useRejectApproval,
  useModifyApproval,
} from "@/hooks/useApprovals";
import { ApprovalInboxTable } from "@/components/approvals/ApprovalInboxTable";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export function Approvals() {
  const approvals = usePendingApprovals();
  const approveMutation = useApproveApproval();
  const rejectMutation = useRejectApproval();
  const modifyMutation = useModifyApproval();
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const isMutating =
    approveMutation.isPending || rejectMutation.isPending || modifyMutation.isPending;

  const lastUpdated = approvals.dataUpdatedAt
    ? formatDateTime(new Date(approvals.dataUpdatedAt))
    : null;

  const handleApprove = (id: string) => {
    setPendingActionId(id);
    approveMutation.mutate(
      { id },
      { onSettled: () => setPendingActionId(null) }
    );
  };

  const handleReject = (id: string) => {
    setPendingActionId(id);
    rejectMutation.mutate(
      { id },
      { onSettled: () => setPendingActionId(null) }
    );
  };

  const handleModify = (id: string, modifiedAmount: number) => {
    setPendingActionId(id);
    modifyMutation.mutate(
      { id, modifiedAmount },
      { onSettled: () => setPendingActionId(null) }
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Approval Inbox
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lastUpdated
              ? `Playbooks held for a policy breach, awaiting a human decision · Updated ${lastUpdated}`
              : "Playbooks held for a policy breach, awaiting a human decision"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => approvals.refetch()}
          disabled={approvals.isFetching}
        >
          <RefreshCw className={approvals.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Pending approvals</h3>
            <p className="text-xs text-muted-foreground">
              Approve to run the recommended step, modify its amount, or reject to escalate
            </p>
          </div>
        </div>
        <ApprovalInboxTable
          items={approvals.data?.approvals}
          isLoading={approvals.isLoading}
          isError={approvals.isError}
          onRetry={() => approvals.refetch()}
          onApprove={handleApprove}
          onReject={handleReject}
          onModify={handleModify}
          pendingActionId={isMutating ? pendingActionId : null}
        />
      </section>
    </div>
  );
}