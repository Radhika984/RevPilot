/**
 * Shared types for the deterministic Decision Engine (Phase 4).
 * No AI/LLM usage anywhere in this module tree — every function here is
 * a pure, deterministic function of its inputs.
 */

export type RecoveryStrategyName = "retry" | "payment_link";

/**
 * Minimal, plain-object view of a risk_events row that the engine needs.
 * Deliberately decoupled from Prisma's generated types (Decimal, JsonValue)
 * so the scoring functions stay pure and can be unit-tested without a
 * database connection.
 */
export interface DecisionEngineInput {
  sourceType: string; // RiskEventSourceType, kept as string to stay decoupled from Prisma enums
  eventName: string; // RiskEvent.root_cause — the raw Razorpay event, e.g. "payment.failed"
  amount: number; // rupees
  rawPayload: unknown; // RiskEvent.raw_payload — full verified Razorpay webhook body
}

export interface StrategyScore {
  strategy: RecoveryStrategyName;
  confidence: number; // always within [0, 1]
  expected_value: number;
  reasoning: string;
}

export interface Decision {
  rootCause: string;
  strategies: StrategyScore[]; // sorted descending by expected_value
  waitingPeriodSeconds: number;
  stoppingRule: {
    max_attempts: number;
    stop_condition: string;
  };
  explainableReasoning: string;
}