import { PolicyCheckContext, PolicyCheckResult, PolicyLimits } from "./types";

/**
 * Pure policy evaluation — no I/O. Checked in the exact order Phase 6
 * specifies: (1) execution ceiling, (2) daily cap, (3) minimum
 * confidence. The first breach found wins; later checks are not
 * evaluated once one has failed, matching how a real gate would
 * short-circuit and making the priority deterministic when more than
 * one limit is breached at once.
 */
export function evaluatePolicy(
  limits: PolicyLimits,
  dailyUsedAmount: number,
  context: PolicyCheckContext
): PolicyCheckResult {
  if (context.amount > limits.ceilingAmount) {
    return { allowed: false, breachReason: "ceiling_breach" };
  }

  if (dailyUsedAmount + context.amount > limits.dailyCap) {
    return { allowed: false, breachReason: "daily_cap_breach" };
  }

  if (context.confidence < limits.minConfidence) {
    return { allowed: false, breachReason: "low_confidence" };
  }

  return { allowed: true, breachReason: null };
}