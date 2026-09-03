import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { RecoveryQueueTable } from "@/components/playbooks/RecoveryQueueTable";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export function RecoveryQueue() {
  const navigate = useNavigate();
  const playbooks = usePlaybooks();

  const lastUpdated = playbooks.dataUpdatedAt
    ? formatDateTime(new Date(playbooks.dataUpdatedAt))
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Recovery Queue
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lastUpdated
              ? `Every adaptive playbook generated for at-risk revenue · Updated ${lastUpdated}`
              : "Every adaptive playbook generated for at-risk revenue"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => playbooks.refetch()}
          disabled={playbooks.isFetching}
        >
          <RefreshCw className={playbooks.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Playbooks</h3>
            <p className="text-xs text-muted-foreground">
              Newest first · click a row to open its recovery timeline
            </p>
          </div>
        </div>
        <RecoveryQueueTable
          items={playbooks.data?.playbooks}
          isLoading={playbooks.isLoading}
          isError={playbooks.isError}
          onRetry={() => playbooks.refetch()}
          onSelect={(id) => navigate(`/playbooks/${id}`)}
        />
      </section>
    </div>
  );
}