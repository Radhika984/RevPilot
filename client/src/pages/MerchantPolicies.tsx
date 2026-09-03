import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useMerchantPolicies, useUpdateMerchantPolicy } from "@/hooks/usePolicies";
import type { PolicyModule, StrategyToggles } from "@/hooks/usePolicies";
import { PolicyModuleCard } from "@/components/policies/PolicyModuleCard";
import { ErrorState, ChartSkeleton } from "@/components/revenue/QueryState";
import { Button } from "@/components/ui/button";

export function MerchantPolicies() {
  const policies = useMerchantPolicies();
  const updatePolicy = useUpdateMerchantPolicy();
  const [savingModule, setSavingModule] = useState<PolicyModule | null>(null);
  const [saveErrors, setSaveErrors] = useState<Partial<Record<PolicyModule, string>>>({});

  const handleSave = (
    module: PolicyModule,
    values: {
      ceiling_amount: number;
      daily_cap: number;
      min_confidence: number;
      strategy_toggles: StrategyToggles;
    }
  ) => {
    setSavingModule(module);
    setSaveErrors((prev) => ({ ...prev, [module]: undefined }));
    updatePolicy.mutate(
      { module, ...values },
      {
        onError: () => {
          setSaveErrors((prev) => ({
            ...prev,
            [module]: "Couldn't save this policy. Try again.",
          }));
        },
        onSettled: () => setSavingModule(null),
      }
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Merchant Policies
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-module ceilings, daily caps, minimum confidence, and strategy toggles the Policy
            Gate checks before auto-executing a playbook
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => policies.refetch()}
          disabled={policies.isFetching}
        >
          <RefreshCw className={policies.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {policies.isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartSkeleton heightClassName="h-56" />
          <ChartSkeleton heightClassName="h-56" />
          <ChartSkeleton heightClassName="h-56" />
          <ChartSkeleton heightClassName="h-56" />
        </div>
      ) : policies.isError ? (
        <div className="rounded-lg border border-border bg-card">
          <ErrorState message="Couldn't load merchant policies." onRetry={() => policies.refetch()} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {policies.data?.policies.map((policy) => (
            <PolicyModuleCard
              key={`${policy.module}-${policy.updated_at ?? "unset"}`}
              policy={policy}
              onSave={(values) => handleSave(policy.module, values)}
              isSaving={savingModule === policy.module}
              saveError={saveErrors[policy.module] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}