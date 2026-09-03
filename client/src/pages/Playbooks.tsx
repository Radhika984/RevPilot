import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { usePlaybook } from "@/hooks/usePlaybooks";
import { PlaybookTimeline } from "@/features/playbooks/PlaybookTimeline";
import { ErrorState } from "@/components/revenue/QueryState";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatDateTime,
  formatPlaybookStatus,
  formatRootCause,
  formatSourceType,
} from "@/lib/format";
import { badgeClassName, playbookStatusTone } from "@/lib/playbookVisuals";

export function Playbooks() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playbook = usePlaybook(id);
  const data = playbook.data?.playbook;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/recovery-queue")}
            className="-ml-2 mb-2"
          >
            <ArrowLeft />
            Back to Recovery Queue
          </Button>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {data ? formatRootCause(data.root_cause) : "Playbook detail"}
          </h2>
          {data ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{formatSourceType(data.risk_event.source_type)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatCurrency(data.risk_event.amount)}</span>
              <span aria-hidden="true">·</span>
              <span>Generated {formatDateTime(data.created_at)}</span>
              <span className={badgeClassName(playbookStatusTone(data.status))}>
                {formatPlaybookStatus(data.status)}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Diagnosis, recovery steps, and final outcome for this playbook
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => playbook.refetch()}
          disabled={playbook.isFetching || !id}
        >
          <RefreshCw className={playbook.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Recovery timeline</h3>
          <p className="text-xs text-muted-foreground">
            Diagnosis, each recovery step, and the final outcome, in order
          </p>
        </div>

        {playbook.isLoading ? (
          <TimelineSkeleton />
        ) : playbook.isError ? (
          <ErrorState
            message="Couldn't load this playbook."
            onRetry={() => playbook.refetch()}
          />
        ) : data ? (
          <PlaybookTimeline playbook={data} />
        ) : (
          <ErrorState message="This playbook could not be found." />
        )}
      </section>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4 px-5 py-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2 rounded-lg border border-border bg-card p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}