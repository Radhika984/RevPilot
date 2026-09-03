import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useAuditLedger, useAuditVerify } from "@/hooks/useAudit";
import { AuditLedgerTable } from "@/components/audit/AuditLedgerTable";
import { ChainIntegrityBanner } from "@/components/audit/ChainIntegrityBanner";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "risk_event", label: "Risk Event" },
  { value: "playbook", label: "Playbook" },
  { value: "recovery_action", label: "Recovery Action" },
  { value: "approval", label: "Approval" },
];

export function AuditLedger() {
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");

  const ledger = useAuditLedger({ entityType: entityType || undefined, q: search || undefined });
  const verify = useAuditVerify(false);

  const lastUpdated = ledger.dataUpdatedAt ? formatDateTime(new Date(ledger.dataUpdatedAt)) : null;
  const hasActiveFilters = Boolean(entityType || search);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Audit Ledger
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lastUpdated
              ? `Immutable record of every risk event, playbook, recovery action, and approval · Updated ${lastUpdated}`
              : "Immutable record of every risk event, playbook, recovery action, and approval"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => verify.refetch()}
            disabled={verify.isFetching}
          >
            <ShieldCheck />
            Verify Chain Integrity
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ledger.refetch()}
            disabled={ledger.isFetching}
          >
            <RefreshCw className={ledger.isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {verify.data || verify.isFetching || verify.isError ? (
        <ChainIntegrityBanner
          result={verify.data}
          isFetching={verify.isFetching}
          isError={verify.isError}
        />
      ) : null}

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ledger entries</h3>
            <p className="text-xs text-muted-foreground">Newest first</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Filter by entity type"
            >
              {ENTITY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event description…"
              className="h-8 w-48 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Search audit ledger"
            />
          </div>
        </div>
        <AuditLedgerTable
          entries={ledger.data?.entries}
          isLoading={ledger.isLoading}
          isError={ledger.isError}
          onRetry={() => ledger.refetch()}
          hasActiveFilters={hasActiveFilters}
        />
      </section>
    </div>
  );
}