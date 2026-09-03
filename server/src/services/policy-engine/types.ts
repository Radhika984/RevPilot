/**
 * Shared types for the Phase 6 Policy Engine & Approval Routing.
 */

export type PolicyBreachReason = "ceiling_breach" | "daily_cap_breach" | "low_confidence";

export interface PolicyLimits {
  ceilingAmount: number;
  dailyCap: number;
  minConfidence: number;
}

/** What's being checked against the policy — the top-ranked candidate's amount/confidence. */
export interface PolicyCheckContext {
  amount: number; // proposed recovery amount, rupees
  confidence: number; // proposed step confidence, 0-1
}

export interface PolicyCheckResult {
  allowed: boolean;
  breachReason: PolicyBreachReason | null;
}

export interface PolicyGateResult {
  outcome: "executed" | "awaiting_approval" | "no_policy_configured";
  breachReason?: PolicyBreachReason;
  approvalId?: string;
}