import { prisma } from "../../lib/prisma";
import { planWaterfallSteps } from "./planner";
import { isCircuitOpen, recordStepFailure, recordStepSuccess } from "./circuitBreaker";
import { defaultStepExecutor } from "./strategyExecutors";
import {
  StepExecutor,
  StepExecutorContext,
  WaterfallCandidate,
  WaterfallRunResult,
} from "./types";

/**
 * Pure orchestration of a single waterfall run — no Prisma/DB access.
 * Takes the already-ranked strategy candidates (Playbook.recommended_
 * sequence), the module to check/update the circuit breaker for, an
 * injectable step executor, and the context to hand that executor.
 * Deterministic given a deterministic executor — this is what Phase 5's
 * tests exercise directly, with zero network/DB dependency.
 *
 * Rules enforced here:
 *  - never attempts more than MAX_CHAIN_DEPTH (3) steps — enforced
 *    structurally by planWaterfallSteps before the loop even starts
 *  - stops immediately on the first "succeeded" outcome
 *    (stopReason="recovered", finalStatus="closed")
 *  - if the module's circuit breaker is open — either already open
 *    before this run starts, or because a step's failure just tripped
 *    it — the chain stops there with stopReason="escalated_circuit_open"
 *    and attempts no further steps
 *  - if a step fails and it was the last planned step (sequence
 *    naturally exhausted, or already capped at MAX_CHAIN_DEPTH), the
 *    chain escalates with stopReason="escalated_exhausted"
 */
export async function runWaterfallSteps(
  candidates: WaterfallCandidate[],
  module: string,
  executor: StepExecutor,
  context: StepExecutorContext
): Promise<WaterfallRunResult> {
  const plannedSteps = planWaterfallSteps(candidates);

  if (isCircuitOpen(module)) {
    return { steps: [], stopReason: "escalated_circuit_open", finalStatus: "escalated" };
  }

  const executedSteps: WaterfallRunResult["steps"] = [];

  for (const step of plannedSteps) {
    if (isCircuitOpen(module)) {
      return { steps: executedSteps, stopReason: "escalated_circuit_open", finalStatus: "escalated" };
    }

    const result = await executor(step.strategy, context);
    executedSteps.push({ ...step, ...result });

    if (result.outcome === "succeeded") {
      recordStepSuccess(module);
      return { steps: executedSteps, stopReason: "recovered", finalStatus: "closed" };
    }

    recordStepFailure(module);

    if (isCircuitOpen(module)) {
      return { steps: executedSteps, stopReason: "escalated_circuit_open", finalStatus: "escalated" };
    }

    const isLastPlannedStep = step.step_number === plannedSteps[plannedSteps.length - 1].step_number;
    if (isLastPlannedStep) {
      return { steps: executedSteps, stopReason: "escalated_exhausted", finalStatus: "escalated" };
    }
  }

  // Only reached when plannedSteps is empty (no candidates at all) — no
  // step to run, nothing recovered, so escalate rather than silently
  // closing the playbook.
  return { steps: executedSteps, stopReason: "escalated_exhausted", finalStatus: "escalated" };
}

interface RunPlaybookWaterfallParams {
  playbookId: string;
  executor?: StepExecutor;
}

/**
 * DB-integrated entry point used by the Phase 5 worker: loads the
 * playbook + its risk event, runs runWaterfallSteps, persists a
 * recovery_actions row per executed step, and updates the playbook's
 * final status.
 *
 * Idempotent: if recovery_actions already exist for this playbook (e.g.
 * BullMQ redelivered the job after a crash), the waterfall is not
 * re-executed and this returns null — mirrors the idempotency guard in
 * workers/decisionEngine.worker.ts.
 */
export async function runPlaybookWaterfall({
  playbookId,
  executor = defaultStepExecutor,
}: RunPlaybookWaterfallParams): Promise<WaterfallRunResult | null> {
  const playbook = await prisma.playbook.findUnique({
    where: { id: playbookId },
    include: { risk_event: true, recovery_actions: true },
  });

  if (!playbook) {
    console.warn(`playbookId=${playbookId} not found — skipping Phase 5 waterfall`);
    return null;
  }

  if (playbook.recovery_actions.length > 0) {
    console.log(`Playbook ${playbookId} already has recovery_actions — skipping waterfall (idempotent)`);
    return null;
  }

  await prisma.playbook.update({
    where: { id: playbook.id },
    data: { status: "executing" },
  });

  const module = playbook.risk_event.source_type;
  const candidates = playbook.recommended_sequence as unknown as WaterfallCandidate[];

  const context: StepExecutorContext = {
    riskEventId: playbook.risk_event.id,
    merchantId: playbook.risk_event.merchant_id,
    amount: Number(playbook.risk_event.amount),
    rawPayload: playbook.risk_event.raw_payload,
  };

  const result = await runWaterfallSteps(candidates, module, executor, context);

  for (const step of result.steps) {
    await prisma.recoveryAction.create({
      data: {
        playbook_id: playbook.id,
        step_number: step.step_number,
        strategy: step.strategy,
        confidence: step.confidence,
        expected_value: step.expected_value,
        outcome: step.outcome,
        razorpay_reference_id: step.razorpay_reference_id,
        executed_at: new Date(),
      },
    });
  }

  await prisma.playbook.update({
    where: { id: playbook.id },
    data: { status: result.finalStatus },
  });

  return result;
}