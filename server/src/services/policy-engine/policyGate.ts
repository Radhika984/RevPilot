import { PolicyModule } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { evaluatePolicy } from "./policyChecks";
import { getDailyUsedAmount } from "./dailyUsage";
import { runPlaybookWaterfall } from "../playbook-engine/chainEngine";
import { defaultStepExecutor } from "../playbook-engine/strategyExecutors";
import { notifyApprovalEvent } from "../notifications/notifyApprovalEvent";
import { PolicyBreachReason, PolicyGateResult, PolicyLimits } from "./types";
import { StepExecutor, WaterfallCandidate } from "../playbook-engine/types";
import { ApprovalNotificationContext } from "../notifications/types";

async function createApprovalForBreach(
  playbookId: string,
  breachReason: PolicyBreachReason,
  topCandidate: WaterfallCandidate,
  merchantId: string
) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  const approverEmail = merchant?.email ?? "unknown@merchant";

  const recommendedAction = {
    strategy: topCandidate.strategy,
    confidence: topCandidate.confidence,
    expected_value: topCandidate.expected_value,
  };

  const approval = await prisma.approval.create({
    data: {
      playbook_id: playbookId,
      trigger_reason: breachReason,
      recommended_action: recommendedAction,
      approver_email: approverEmail,
      decision: "pending",
    },
  });

  await prisma.playbook.update({
    where: { id: playbookId },
    data: { status: "awaiting_approval" },
  });

  // Phase 7: this is the approval event — notify both the merchant
  // (email) and internal ops (Slack) that this playbook now needs
  // human approval. notifyApprovalEvent never throws (it catches each
  // channel independently), so a notification failure can never break
  // this deterministic policy-gate flow.
  const notificationContext: ApprovalNotificationContext = {
    approvalId: approval.id,
    playbookId,
    merchantEmail: approverEmail,
    triggerReason: breachReason,
    recommendedAction,
  };
  await notifyApprovalEvent(notificationContext);

  return approval;
}

/**
 * Phase 6 entry point, called by workers/playbookEngine.worker.ts
 * INSTEAD of calling chainEngine.runPlaybookWaterfall directly. Gates
 * every playbook's top-ranked recovery candidate against the
 * merchant's policy for that module before allowing Phase 5's
 * waterfall to auto-execute. chainEngine.ts itself is NOT modified by
 * Phase 6/7, so Phase 5's waterfall/circuit-breaker behavior (and its
 * existing tests) are completely preserved.
 *
 * `executor` is injectable (defaults to the real Razorpay Test Mode
 * executor) purely so deterministic tests can prove the
 * "policy passes -> Phase 5 runs" path without any network access —
 * the same dependency-injection pattern chainEngine.ts itself already
 * uses.
 *
 * - Policy passes -> hands off to the untouched Phase 5
 *   runPlaybookWaterfall.
 * - Policy breaches (ceiling / daily cap / min confidence) -> playbook
 *   status set to "awaiting_approval", a pending Approval row is
 *   created, both notification channels are dispatched (Phase 7), and
 *   the waterfall is NOT run.
 * - No merchant_policies row exists for merchant+module -> fail safe:
 *   treated as a ceiling breach (an unconfigured ceiling is treated as
 *   0, so any positive amount breaches it) rather than silently
 *   auto-executing with no policy in force.
 *
 * Idempotent: if the playbook already has recovery_actions OR an
 * existing approval, this is a no-op — mirrors the idempotency guard
 * already in chainEngine.runPlaybookWaterfall.
 */
export async function runPlaybookWithPolicyGate(
  playbookId: string,
  executor: StepExecutor = defaultStepExecutor
): Promise<PolicyGateResult | null> {
  const playbook = await prisma.playbook.findUnique({
    where: { id: playbookId },
    include: { risk_event: true, recovery_actions: true, approvals: true },
  });

  if (!playbook) {
    console.warn(`playbookId=${playbookId} not found — skipping policy gate`);
    return null;
  }

  if (playbook.recovery_actions.length > 0) {
    console.log(`Playbook ${playbookId} already has recovery_actions — skipping policy gate (idempotent)`);
    return null;
  }

  if (playbook.approvals.length > 0) {
    console.log(`Playbook ${playbookId} already has an approval — skipping policy gate (idempotent)`);
    return null;
  }

  const merchantId = playbook.risk_event.merchant_id;
  const module: PolicyModule = playbook.risk_event.source_type;

  const candidates = playbook.recommended_sequence as unknown as WaterfallCandidate[];
  const topCandidate = candidates[0];

  if (!topCandidate) {
    console.warn(`Playbook ${playbookId} has an empty recommended_sequence — cannot policy-check, skipping`);
    return null;
  }

  const policy = await prisma.merchantPolicy.findUnique({
    where: { merchant_id_module: { merchant_id: merchantId, module } },
  });

  if (!policy) {
    console.warn(
      `No merchant_policies row for merchant_id=${merchantId}, module=${module} — ` +
        `failing safe (no auto-execution) for playbookId=${playbookId}`
    );
    const approval = await createApprovalForBreach(playbook.id, "ceiling_breach", topCandidate, merchantId);
    return { outcome: "no_policy_configured", breachReason: "ceiling_breach", approvalId: approval.id };
  }

  const dailyUsedAmount = await getDailyUsedAmount(merchantId, module);

  const limits: PolicyLimits = {
    ceilingAmount: Number(policy.ceiling_amount),
    dailyCap: Number(policy.daily_cap),
    minConfidence: Number(policy.min_confidence),
  };

  const check = evaluatePolicy(limits, dailyUsedAmount, {
    amount: topCandidate.expected_value,
    confidence: topCandidate.confidence,
  });

  if (check.allowed) {
    await runPlaybookWaterfall({ playbookId: playbook.id, executor });
    return { outcome: "executed" };
  }

  const breachReason = check.breachReason as PolicyBreachReason;
  const approval = await createApprovalForBreach(playbook.id, breachReason, topCandidate, merchantId);
  return { outcome: "awaiting_approval", breachReason, approvalId: approval.id };
}