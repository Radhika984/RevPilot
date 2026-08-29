import { classifyRootCause } from "./rootCause";
import { calculateConfidence } from "./confidence";
import { calculateExpectedValue } from "./expectedValue";
import { Decision, DecisionEngineInput, RecoveryStrategyName, StrategyScore } from "./types";

/**
 * The complete, fixed set of strategies scored in Phase 4. Order here is
 * the order strategies are evaluated in (not the order they're returned
 * in — results are sorted by expected_value afterward), so evaluation
 * itself is deterministic and reproducible.
 */
const STRATEGIES: RecoveryStrategyName[] = ["retry", "payment_link"];

/**
 * Fixed waiting-period lookup (seconds) for the `retry` strategy, keyed
 * by root cause — e.g. an insufficient-funds decline is worth waiting
 * longer on (payday, balance top-up) than a transient processor error.
 * payment_link has no waiting period: it is sent immediately.
 */
const RETRY_WAITING_PERIOD_SECONDS: Record<string, number> = {
  insufficient_funds: 21600, // 6 hours
  processor_error: 300, // 5 minutes
  recurring_payment_delay: 86400, // 24 hours
};
const DEFAULT_RETRY_WAITING_PERIOD_SECONDS = 3600; // 1 hour

function waitingPeriodFor(strategy: RecoveryStrategyName, rootCause: string): number {
  if (strategy === "payment_link") return 0;
  return RETRY_WAITING_PERIOD_SECONDS[rootCause] ?? DEFAULT_RETRY_WAITING_PERIOD_SECONDS;
}

function reasoningFor(
  strategy: RecoveryStrategyName,
  rootCause: string,
  confidence: number,
  expectedValue: number
): string {
  return `Strategy '${strategy}' scored for root cause '${rootCause}': confidence=${confidence.toFixed(
    4
  )}, expected_value=${expectedValue.toFixed(2)}.`;
}

/**
 * Runs the full deterministic Decision Engine pipeline for one risk
 * event: classify root cause, score every viable strategy (retry,
 * payment_link) for confidence and expected value, and pick the
 * top-ranked strategy to drive waiting period / stopping rule.
 *
 * Deterministic guarantee: this function has no randomness, no I/O, no
 * system-clock dependency, and no AI/LLM call anywhere in its call
 * graph. Given the same `DecisionEngineInput`, it always returns a
 * `Decision` with identical scores, in identical order.
 */
export function buildDecision(input: DecisionEngineInput): Decision {
  const rootCause = classifyRootCause(input);

  const strategies: StrategyScore[] = STRATEGIES.map((strategy) => {
    const confidence = calculateConfidence(rootCause, strategy);
    const expected_value = calculateExpectedValue(strategy, confidence, input.amount);
    return {
      strategy,
      confidence,
      expected_value,
      reasoning: reasoningFor(strategy, rootCause, confidence, expected_value),
    };
  }).sort((a, b) => {
    // Descending by expected_value; ties broken by strategy name for a
    // fully deterministic, stable order regardless of input.
    if (b.expected_value !== a.expected_value) return b.expected_value - a.expected_value;
    return a.strategy.localeCompare(b.strategy);
  });

  const topStrategy = strategies[0];

  const explainableReasoning =
    `Root cause classified as '${rootCause}'. Evaluated ${strategies.length} ` +
    `strategies: ${strategies
      .map((s) => `${s.strategy} (confidence=${s.confidence.toFixed(4)}, expected_value=${s.expected_value.toFixed(2)})`)
      .join("; ")}. ` +
    `Recommended strategy: '${topStrategy.strategy}' (highest expected value).`;

  return {
    rootCause,
    strategies,
    waitingPeriodSeconds: waitingPeriodFor(topStrategy.strategy, rootCause),
    stoppingRule: {
      max_attempts: strategies.length,
      stop_condition: "risk_event_resolved_or_all_strategies_exhausted",
    },
    explainableReasoning,
  };
}

/**
 * Maps a `Decision` onto the shape Prisma's `playbook.create({ data })`
 * expects, using the existing `playbooks` schema exactly as-is (no
 * schema changes in Phase 4). The playbook is created in the
 * `generated` status — a draft/unexecuted recommendation only; nothing
 * in this phase performs a Razorpay recovery action.
 */
export function buildPlaybookCreateData(riskEventId: string, decision: Decision) {
  const topStrategy = decision.strategies[0];

  return {
    risk_event_id: riskEventId,
    root_cause: decision.rootCause,
    recovery_probability: topStrategy.confidence,
    recovery_value: topStrategy.expected_value,
    recommended_sequence: decision.strategies.map((s, index) => ({
      step_number: index + 1,
      strategy: s.strategy,
      confidence: s.confidence,
      expected_value: s.expected_value,
      reasoning: s.reasoning,
    })),
    waiting_period_seconds: decision.waitingPeriodSeconds,
    stopping_rule: decision.stoppingRule,
    explainable_reasoning: decision.explainableReasoning,
    chain_depth: decision.strategies.length,
    status: "generated" as const,
  };
}