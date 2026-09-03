import { CircleCheckBig, ShieldAlert, Loader2 } from "lucide-react";
import type { AuditVerifyResult } from "@/hooks/useAudit";

interface ChainIntegrityBannerProps {
  result: AuditVerifyResult | undefined;
  isFetching: boolean;
  isError: boolean;
}

export function ChainIntegrityBanner({ result, isFetching, isError }: ChainIntegrityBannerProps) {
  if (isFetching) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Verifying chain integrity…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <ShieldAlert className="size-4 shrink-0" />
        Couldn't run the chain verification. Try again.
      </div>
    );
  }

  if (!result) return null;

  if (result.valid) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CircleCheckBig className="size-4 shrink-0" />
        <span>
          Chain valid — {result.entries_checked}{" "}
          {result.entries_checked === 1 ? "entry" : "entries"} checked.
          {result.entries_checked === 0 ? " No audit entries yet." : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <ShieldAlert className="size-4 shrink-0" />
      <span>
        Chain broken — {result.reason ?? "integrity check failed."}
        {result.broken_at_entry_id ? (
          <span className="font-mono"> ({formatShortId(result.broken_at_entry_id)})</span>
        ) : null}
      </span>
    </div>
  );
}

function formatShortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}