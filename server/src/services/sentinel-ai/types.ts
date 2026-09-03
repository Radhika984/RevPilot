/**
 * Shared types for the Phase 7 Sentinel AI explanation layer.
 */

export interface SentinelPlaybookInput {
  playbookId: string;
  rootCause: string;
  recoveryProbability: number;
  recoveryValue: number;
  recommendedSequence: unknown;
  waitingPeriodSeconds: number;
  stoppingRule: unknown;
  chainDepth: number;
}

export interface SentinelExplanationResult {
  explanation: string;
}