import { SentinelPlaybookInput } from "./types";

/**
 * Builds the OpenAI prompt from ONLY already-fixed, already-computed
 * playbook fields (the deterministic Decision Engine's output) — never
 * from the raw risk event payload, merchant PII, or anything the model
 * could use to influence a decision. SentinelPlaybookInput itself has
 * no field for anything beyond these fixed values, so this call is
 * structurally read-only by construction: it cannot receive, and
 * therefore cannot act on, anything else.
 */
export function buildExplanationPrompt(input: SentinelPlaybookInput): string {
  return [
    "Explain the following already-finalized payment recovery playbook in 2-4 plain-language sentences for a merchant dashboard.",
    "Do not suggest changes, alternative strategies, or different amounts. Only explain what is given below.",
    "",
    `Root cause: ${input.rootCause}`,
    `Recommended sequence (fixed, already decided): ${JSON.stringify(input.recommendedSequence)}`,
    `Top recovery probability: ${input.recoveryProbability}`,
    `Top recovery value: ${input.recoveryValue}`,
    `Waiting period before first action (seconds): ${input.waitingPeriodSeconds}`,
    `Stopping rule: ${JSON.stringify(input.stoppingRule)}`,
    `Chain depth: ${input.chainDepth}`,
  ].join("\n");
}