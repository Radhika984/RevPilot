import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/6 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-7 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function ChartSkeleton({ heightClassName = "h-64" }: { heightClassName?: string }) {
  return <div className={`w-full animate-pulse rounded-md bg-muted ${heightClassName}`} />;
}

export function ErrorState({
  message = "We couldn't load this data.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Inbox className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}