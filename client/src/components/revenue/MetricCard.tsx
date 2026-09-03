import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  helpText?: string;
  icon: LucideIcon;
  tone?: "neutral" | "risk" | "positive";
}

const toneStyles: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "bg-muted text-foreground",
  risk: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  positive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

export function MetricCard({
  label,
  value,
  helpText,
  icon: Icon,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-md", toneStyles[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {helpText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
      ) : null}
    </div>
  );
}
