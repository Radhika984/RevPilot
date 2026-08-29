import { DecisionEngineInput } from "./types";

/**
 * Fixed, deterministic lookup from Razorpay's `error_reason` field
 * (payload.payment.entity.error_reason on payment.failed events) to a
 * normalized root-cause category. This table is static — it is never
 * mutated at runtime — so the same error_reason always classifies the
 * same way.
 */
const ERROR_REASON_MAP: Record<string, string> = {
  payment_failed: "generic_payment_failure",
  insufficient_funds: "insufficient_funds",
  issuer_declined: "issuer_declined",
  card_declined: "issuer_declined",
  authentication_failed: "authentication_failure",
  invalid_card: "invalid_card",
  expired_card: "expired_card",
  risk_check_failed: "risk_check_failed",
  international_transaction_not_allowed: "issuer_restriction",
  processing_error: "processor_error",
  gateway_error: "processor_error",
  timeout: "processor_error",
};

function safeGet(obj: unknown, path: string[]): unknown {
  let current: any = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/**
 * Deterministically classifies the root cause of a risk event.
 *
 * Priority order (always evaluated in this fixed order, never randomized):
 *   1. Explicit Razorpay error_reason on the payment entity, if present.
 *   2. The raw webhook event name (RiskEvent.root_cause), for event
 *      families that carry no error_reason (payment_link lifecycle,
 *      subscription lifecycle).
 *   3. A final fixed fallback of "unclassified".
 *
 * Given the same input object, this function always returns the same
 * string — there is no randomness, no clock/time dependency, and no
 * external call of any kind (no AI/LLM usage).
 */
export function classifyRootCause(input: DecisionEngineInput): string {
  const errorReason = safeGet(input.rawPayload, [
    "payload",
    "payment",
    "entity",
    "error_reason",
  ]);

  if (typeof errorReason === "string" && errorReason.length > 0) {
    return ERROR_REASON_MAP[errorReason] ?? "processor_decline_other";
  }

  switch (input.eventName) {
    case "payment_link.expired":
    case "payment_link.cancelled":
      return "customer_abandoned_checkout";
    case "subscription.pending":
      return "recurring_payment_delay";
    case "subscription.halted":
      return "repeated_mandate_failure";
    case "payment.failed":
      return "unclassified_payment_failure";
    default:
      return "unclassified";
  }
}