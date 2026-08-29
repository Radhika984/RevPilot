import { RecoveryStrategyName } from "../decision-engine/types";

/**
 * Shared types for the Phase 5 Adaptive Playbook Engine.
 * Reuses RecoveryStrategyName ("retry" | "payment_link") from the
 * Phase 4 Decision Engine rather than redefining it, since the
 * waterfall chains exactly the strategies Phase 4 already scores.
 */
export type WaterfallStrategy = RecoveryStrategyName;

/** Hard ceiling on how many steps a single waterfall may ever run. */
export const MAX_CHAIN_DEPTH = 3;

/**
 * One scored strategy candidate, as produced by the Phase 4 Decision
 * Engine and stored in Playbook.recommended_sequence (already sorted
 * descending by expected_value).
 */
export interface WaterfallCandidate {
  strategy: WaterfallStrategy;
  confidence: number;
  expected_value: number;
}

/** One step the waterfall plans to attempt, before execution. */
export interface PlannedStep {
  step_number: number;
  strategy: WaterfallStrategy;
  confidence: number;
  expected_value: number;
}

export type StepOutcome = "succeeded" | "failed" | "pending" | "skipped";

export interface StepExecutionResult {
  outcome: StepOutcome;
  razorpay_reference_id: string;
}

/** Everything a step executor needs to actually attempt a strategy. */
export interface StepExecutorContext {
  riskEventId: string;
  merchantId: string;
  amount: number; // rupees
  rawPayload: unknown;
}

/**
 * Injectable strategy executor. Production code uses
 * strategyExecutors.ts's `defaultStepExecutor` (real Razorpay Test Mode
 * calls); deterministic tests pass a fake implementation instead so the
 * waterfall/circuit-breaker/escalation logic can be proven without any
 * network access.
 */
export type StepExecutor = (
  strategy: WaterfallStrategy,
  context: StepExecutorContext
) => Promise<StepExecutionResult>;

export type WaterfallStopReason =
  | "recovered"
  | "escalated_exhausted"
  | "escalated_circuit_open";

export interface WaterfallRunResult {
  steps: Array<PlannedStep & StepExecutionResult>;
  stopReason: WaterfallStopReason;
  finalStatus: "closed" | "escalated";
}