import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { MerchantPolicyItem, StrategyToggles } from "@/hooks/usePolicies";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatSourceType, formatStrategy } from "@/lib/format";
import { cn } from "@/lib/utils";

const STRATEGY_KEYS = Object.keys({
  retry: true,
  wait: true,
  payment_link: true,
  escalate: true,
  human_approval: true,
  ignore: true,
} satisfies StrategyToggles) as Array<keyof StrategyToggles>;

interface PolicyModuleCardProps {
  policy: MerchantPolicyItem;
  onSave: (values: {
    ceiling_amount: number;
    daily_cap: number;
    min_confidence: number;
    strategy_toggles: StrategyToggles;
  }) => void;
  isSaving: boolean;
  saveError: string | null;
}

/**
 * Uncontrolled-by-parent form for one policy module. The parent
 * (pages/MerchantPolicies.tsx) keys this component on
 * `${module}-${updated_at}`, so when a save succeeds and the list
 * refetches, React remounts this card with fresh initial state
 * instead of needing a useEffect to resync local state from props.
 */
export function PolicyModuleCard({ policy, onSave, isSaving, saveError }: PolicyModuleCardProps) {
  const [ceilingAmount, setCeilingAmount] = useState(String(policy.ceiling_amount ?? ""));
  const [dailyCap, setDailyCap] = useState(String(policy.daily_cap ?? ""));
  const [minConfidencePercent, setMinConfidencePercent] = useState(
    policy.min_confidence !== null ? String(Math.round(policy.min_confidence * 100)) : ""
  );
  const [toggles, setToggles] = useState<StrategyToggles>(policy.strategy_toggles);

  const parsedCeiling = Number(ceilingAmount);
  const parsedDailyCap = Number(dailyCap);
  const parsedMinConfidence = Number(minConfidencePercent);

  const isValid =
    ceilingAmount !== "" &&
    Number.isFinite(parsedCeiling) &&
    parsedCeiling >= 0 &&
    dailyCap !== "" &&
    Number.isFinite(parsedDailyCap) &&
    parsedDailyCap >= 0 &&
    minConfidencePercent !== "" &&
    Number.isFinite(parsedMinConfidence) &&
    parsedMinConfidence >= 0 &&
    parsedMinConfidence <= 100;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      ceiling_amount: parsedCeiling,
      daily_cap: parsedDailyCap,
      min_confidence: parsedMinConfidence / 100,
      strategy_toggles: toggles,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {formatSourceType(policy.module)}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {policy.configured
              ? `Updated ${formatDateTime(policy.updated_at)}`
              : "Not configured — the Policy Gate fails safe (holds for approval) until this is saved"}
          </p>
        </div>
        {!policy.configured ? (
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            Unconfigured
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Ceiling amount (₹)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={ceilingAmount}
            onChange={(e) => setCeilingAmount(e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Daily cap (₹)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Min confidence (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step="1"
            value={minConfidencePercent}
            onChange={(e) => setMinConfidencePercent(e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="text-xs font-medium text-muted-foreground">Strategy toggles</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {STRATEGY_KEYS.map((strategy) => {
            const enabled = toggles[strategy];
            return (
              <button
                key={strategy}
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setToggles((prev) => ({ ...prev, [strategy]: !prev[strategy] }))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  enabled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {formatStrategy(strategy)}
              </button>
            );
          })}
        </div>
      </div>

      {saveError ? <p className="mt-3 text-xs text-destructive">{saveError}</p> : null}

      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={!isValid || isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          Save
        </Button>
      </div>
    </div>
  );
}