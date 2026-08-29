import { RecoveryStrategyName } from "./types";

/**
 * Fixed flat operational cost (in rupees) of attempting each strategy —
 * e.g. gateway retry overhead, or SMS/link-generation cost for a payment
 * link. Constants only; never computed at runtime.
 */
const STRATEGY_COST: Record<RecoveryStrategyName, number> = {
  retry: 2,
  payment_link: 5,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministically computes the expected value (in rupees) of applying
 * `strategy` to a risk event of the given `amount`, given the previously
 * computed `confidence` for that (root cause, strategy) pair.
 *
 * EV = confidence * amount - fixed strategy cost
 *
 * This is plain arithmetic on its three inputs and a fixed cost table —
 * no randomness, no external calls, no AI/LLM usage. The result is
 * intentionally NOT clamped to be non-negative: a strategy whose cost
 * exceeds its probable recovery is a legitimate (low/negative) score,
 * not an error condition.
 */
export function calculateExpectedValue(
  strategy: RecoveryStrategyName,
  confidence: number,
  amount: number
): number {
  const cost = STRATEGY_COST[strategy];
  return round2(confidence * amount - cost);
}