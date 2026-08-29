import { RecoveryStrategyName } from "./types";

/**
 * Fixed base confidence per normalized root-cause category, representing
 * "how recoverable is this kind of failure in general, independent of
 * strategy". Values are hand-calibrated constants — never computed at
 * runtime, never randomized.
 */
const BASE_CONFIDENCE_BY_ROOT_CAUSE: Record<string, number> = {
  insufficient_funds: 0.72,
  issuer_declined: 0.55,
  authentication_failure: 0.4,
  invalid_card: 0.15,
  expired_card: 0.1,
  risk_check_failed: 0.2,
  issuer_restriction: 0.25,
  processor_error: 0.65,
  processor_decline_other: 0.45,
  generic_payment_failure: 0.4,
  customer_abandoned_checkout: 0.5,
  recurring_payment_delay: 0.6,
  repeated_mandate_failure: 0.3,
  unclassified_payment_failure: 0.35,
  unclassified: 0.2,
};

const DEFAULT_BASE_CONFIDENCE = 0.2;

/**
 * Fixed multiplier expressing how well a given strategy fits a given root
 * cause, relative to the base confidence above. A multiplier of 1.0 means
 * "no adjustment"; below 1.0 means the strategy is a worse fit for that
 * root cause than the general recoverability score suggests; above 1.0
 * means it's a particularly good fit (result is still clamped to [0,1]).
 */
const STRATEGY_FIT_MULTIPLIER: Record<RecoveryStrategyName, Record<string, number>> = {
  retry: {
    insufficient_funds: 1.0,
    processor_error: 1.1,
    issuer_declined: 0.8,
    recurring_payment_delay: 1.0,
    invalid_card: 0.3,
    expired_card: 0.1,
    customer_abandoned_checkout: 0.2,
    repeated_mandate_failure: 0.4,
    authentication_failure: 0.5,
    risk_check_failed: 0.3,
    issuer_restriction: 0.3,
    processor_decline_other: 0.7,
    generic_payment_failure: 0.6,
    unclassified_payment_failure: 0.5,
    unclassified: 0.4,
  },
  payment_link: {
    customer_abandoned_checkout: 1.2,
    invalid_card: 1.1,
    expired_card: 1.15,
    issuer_restriction: 0.9,
    insufficient_funds: 0.6,
    processor_error: 0.5,
    issuer_declined: 0.9,
    recurring_payment_delay: 0.8,
    repeated_mandate_failure: 1.0,
    authentication_failure: 0.9,
    risk_check_failed: 0.8,
    processor_decline_other: 0.85,
    generic_payment_failure: 0.8,
    unclassified_payment_failure: 0.6,
    unclassified: 0.5,
  },
};

const DEFAULT_FIT_MULTIPLIER = 1.0;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Deterministically computes a [0,1] confidence score for a given
 * (rootCause, strategy) pair. Pure arithmetic on fixed lookup tables —
 * same inputs always produce the same output, and the result is always
 * clamped into [0, 1] regardless of the multiplier table's values.
 */
export function calculateConfidence(
  rootCause: string,
  strategy: RecoveryStrategyName
): number {
  const base = BASE_CONFIDENCE_BY_ROOT_CAUSE[rootCause] ?? DEFAULT_BASE_CONFIDENCE;
  const multiplier = STRATEGY_FIT_MULTIPLIER[strategy][rootCause] ?? DEFAULT_FIT_MULTIPLIER;

  return round4(clamp01(base * multiplier));
}