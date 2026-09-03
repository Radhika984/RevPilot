import { prisma } from "../../lib/prisma";
import { buildExplanationPrompt } from "./promptBuilder";
import { callOpenAIChatCompletion } from "./openaiClient";
import { SentinelPlaybookInput } from "./types";

export type ExplanationGenerator = (input: SentinelPlaybookInput) => Promise<string>;

async function defaultExplanationGenerator(input: SentinelPlaybookInput): Promise<string> {
  const prompt = buildExplanationPrompt(input);
  return callOpenAIChatCompletion(prompt);
}

/**
 * Generates a plain-language explanation for an already-created
 * playbook using ONLY its already-fixed fields, and writes the result
 * to playbooks.explainable_reasoning — the ONLY field this function
 * ever touches. Nothing about the playbook's decisions, risk scores,
 * recommended_sequence, amounts, or any other deterministic logic is
 * ever written here.
 *
 * Isolated and fail-safe: if OpenAI is unavailable, misconfigured, or
 * errors for any reason, this function logs the failure and returns
 * without writing anything — the playbook keeps the deterministic
 * explainable_reasoning the Decision Engine (Phase 4) already wrote at
 * creation time. This function NEVER throws, so it can never break the
 * Phase 3->4->5/6 pipeline that calls it.
 *
 * `generate` is injectable (defaults to the real OpenAI call) purely
 * so deterministic tests can prove the read-only contract without any
 * network access — same dependency-injection pattern used throughout
 * this codebase (chainEngine.ts, policyGate.ts).
 */
export async function generateAndStoreExplanation(
  playbookId: string,
  generate: ExplanationGenerator = defaultExplanationGenerator
): Promise<void> {
  const playbook = await prisma.playbook.findUnique({ where: { id: playbookId } });

  if (!playbook) {
    console.warn(`Sentinel AI: playbookId=${playbookId} not found — skipping`);
    return;
  }

  const input: SentinelPlaybookInput = {
    playbookId: playbook.id,
    rootCause: playbook.root_cause,
    recoveryProbability: Number(playbook.recovery_probability),
    recoveryValue: Number(playbook.recovery_value),
    recommendedSequence: playbook.recommended_sequence,
    waitingPeriodSeconds: playbook.waiting_period_seconds,
    stoppingRule: playbook.stopping_rule,
    chainDepth: playbook.chain_depth,
  };

  try {
    const explanation = await generate(input);
    await prisma.playbook.update({
      where: { id: playbookId },
      data: { explainable_reasoning: explanation },
    });
    console.log(`Sentinel AI: updated explainable_reasoning for playbook ${playbookId}`);
  } catch (err) {
    console.error(
      `Sentinel AI: failed to generate explanation for playbook ${playbookId} — keeping deterministic reasoning:`,
      err
    );
  }
}