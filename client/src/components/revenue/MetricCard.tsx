import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  helpText?: string;
  icon: LucideIcon;
  tone?: "neutral" | "risk" | "positive" | "info" | "brand";
}

/**
 * Visual tone styles for Revenue War Room metric cards.
 */
const toneStyles: Record<
  NonNullable<MetricCardProps["tone"]>,
  { icon: string; border: string; value: string }
> = {
  neutral: {
    icon: "bg-muted text-foreground",
    border: "border-l-border",
    value: "text-foreground",
  },
  risk: {
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    border: "border-l-amber-500",
    value: "text-foreground",
  },
  positive: {
    icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    border: "border-l-emerald-500",
    value: "text-foreground",
  },
  info: {
    icon: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    border: "border-l-blue-500",
    value: "text-foreground",
  },
  brand: {
    icon: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
    border: "border-l-indigo-500",
    value: "text-foreground",
  },
};

export function MetricCard({
  label,
  value,
  helpText,
  icon: Icon,
  tone = "neutral",
}: MetricCardProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 border-border bg-card p-5 transition-shadow hover:shadow-md",
        styles.border
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {label}
        </p>

        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            styles.icon
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>

      <p
        className={cn(
          "mt-3 text-3xl font-semibold tracking-tight tabular-nums",
          styles.value
        )}
      >
        {value}
      </p>

      {helpText ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}