import { MAX_CHAIN_DEPTH, PlannedStep, WaterfallCandidate } from "./types";

/**
 * Deterministically builds the ordered list of steps to attempt for a
 * waterfall, from the Decision Engine's already-ranked strategy
 * candidates (Playbook.recommended_sequence). Pure function: same
 * input always produces the same output list, hard-capped at
 * MAX_CHAIN_DEPTH regardless of how many candidates are supplied — this
 * is what structurally guarantees the waterfall never exceeds a chain
 * depth of 3.
 */
export function planWaterfallSteps(candidates: WaterfallCandidate[]): PlannedStep[] {
  return candidates.slice(0, MAX_CHAIN_DEPTH).map((c, index) => ({
    step_number: index + 1,
    strategy: c.strategy,
    confidence: c.confidence,
    expected_value: c.expected_value,
  }));
}