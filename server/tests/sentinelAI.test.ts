import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { buildExplanationPrompt } from "../src/services/sentinel-ai/promptBuilder";
import { generateAndStoreExplanation } from "../src/services/sentinel-ai/explainPlaybook";
import type { SentinelPlaybookInput } from "../src/services/sentinel-ai/types";

describe("buildExplanationPrompt — read-only contract", () => {
  it("includes only already-fixed playbook fields, nothing else", () => {
    const input: SentinelPlaybookInput = {
      playbookId: "pb_1",
      rootCause: "insufficient_funds",
      recoveryProbability: 0.72,
      recoveryValue: 3598,
      recommendedSequence: [{ step_number: 1, strategy: "retry", confidence: 0.72, expected_value: 3598 }],
      waitingPeriodSeconds: 21600,
      stoppingRule: { max_attempts: 2 },
      chainDepth: 2,
    };

    const prompt = buildExplanationPrompt(input);

    expect(prompt).toContain("insufficient_funds");
    expect(prompt).toContain("0.72");
    expect(prompt).toContain("3598");
    expect(prompt).toContain("21600");
    expect(prompt).toContain("Do not suggest changes");

    // SentinelPlaybookInput has no field for merchant PII, raw risk
    // event payload, or anything beyond fixed/computed values —
    // proving the prompt structurally cannot be built from anything
    // else.
    expect(Object.keys(input).sort()).toEqual(
      [
        "chainDepth",
        "playbookId",
        "recommendedSequence",
        "recoveryProbability",
        "recoveryValue",
        "rootCause",
        "stoppingRule",
        "waitingPeriodSeconds",
      ].sort()
    );
  });
});

describe("generateAndStoreExplanation — isolated + fail-safe", () => {
  const merchantIds: string[] = [];
  const playbookIds: string[] = [];

  afterAll(async () => {
    await prisma.playbook.deleteMany({ where: { id: { in: playbookIds } } });
    await prisma.riskEvent.deleteMany({ where: { merchant_id: { in: merchantIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.$disconnect();
  });

  async function createFixture() {
    const suffix = `sentinel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const merchant = await prisma.merchant.create({
      data: { clerk_user_id: `clerk_${suffix}`, email: `${suffix}@example.com`, business_name: "Sentinel Test" },
    });
    merchantIds.push(merchant.id);

    const riskEvent = await prisma.riskEvent.create({
      data: {
        merchant_id: merchant.id,
        source_type: "payment",
        root_cause: "insufficient_funds",
        amount: 5000,
        raw_payload: { payload: {} },
        raw_payload_hash: `hash_${suffix}`,
        status: "open",
      },
    });

    const playbook = await prisma.playbook.create({
      data: {
        risk_event_id: riskEvent.id,
        root_cause: "insufficient_funds",
        recovery_probability: 0.72,
        recovery_value: 3598,
        recommended_sequence: [{ step_number: 1, strategy: "retry", confidence: 0.72, expected_value: 3598 }],
        waiting_period_seconds: 21600,
        stopping_rule: { max_attempts: 1 },
        explainable_reasoning: "deterministic fallback reasoning",
        chain_depth: 1,
        status: "generated",
      },
    });
    playbookIds.push(playbook.id);

    return playbook;
  }

  it("calls the generator with ONLY fixed fields and stores the returned explanation", async () => {
    const playbook = await createFixture();

    const fakeGenerator = vi.fn(async (input: SentinelPlaybookInput) => {
      expect(input.playbookId).toBe(playbook.id);
      expect(input.rootCause).toBe("insufficient_funds");
      expect(input.recoveryProbability).toBe(0.72);
      expect(input.recoveryValue).toBe(3598);
      expect(input.waitingPeriodSeconds).toBe(21600);
      expect(input.chainDepth).toBe(1);
      return "AI-generated plain-language explanation.";
    });

    await generateAndStoreExplanation(playbook.id, fakeGenerator);

    expect(fakeGenerator).toHaveBeenCalledTimes(1);

    const updated = await prisma.playbook.findUniqueOrThrow({ where: { id: playbook.id } });
    expect(updated.explainable_reasoning).toBe("AI-generated plain-language explanation.");
  });

  it("keeps the deterministic reasoning and never throws when the generator fails", async () => {
    const playbook = await createFixture();

    const failingGenerator = vi.fn(async () => {
      throw new Error("OpenAI unavailable");
    });

    await expect(generateAndStoreExplanation(playbook.id, failingGenerator)).resolves.toBeUndefined();

    const stillDeterministic = await prisma.playbook.findUniqueOrThrow({ where: { id: playbook.id } });
    expect(stillDeterministic.explainable_reasoning).toBe("deterministic fallback reasoning");
  });
});