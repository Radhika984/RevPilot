import { describe, it, expect, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { evaluatePolicy } from "../src/services/policy-engine/policyChecks";
import { runPlaybookWithPolicyGate } from "../src/services/policy-engine/policyGate";
import {
  approveApproval,
  rejectApproval,
  modifyApproval,
  ApprovalAlreadyDecidedError,
} from "../src/services/policy-engine/approvalActions";
import type { StepExecutor } from "../src/services/playbook-engine/types";

const TEST_TAG = "phase6-policy-test";
let fixtureCounter = 0;

function alwaysFailExecutor(): StepExecutor {
  return vi.fn(async () => ({ outcome: "failed" as const, razorpay_reference_id: "unavailable" }));
}

function alwaysSucceedExecutor(): StepExecutor {
  return vi.fn(async () => ({ outcome: "succeeded" as const, razorpay_reference_id: "plink_fixture" }));
}

async function createFixture(overrides?: {
  ceilingAmount?: number;
  dailyCap?: number;
  minConfidence?: number;
  candidateAmount?: number;
  candidateConfidence?: number;
}): Promise<{ merchantId: string; playbookId: string }> {
  fixtureCounter += 1;
  const suffix = `${TEST_TAG}-${Date.now()}-${fixtureCounter}`;

  const merchant = await prisma.merchant.create({
    data: {
      clerk_user_id: `clerk_${suffix}`,
      email: `${suffix}@example.com`,
      business_name: "Phase 6 Test Merchant",
    },
  });

  await prisma.merchantPolicy.create({
    data: {
      merchant_id: merchant.id,
      module: "payment",
      ceiling_amount: overrides?.ceilingAmount ?? 100000,
      daily_cap: overrides?.dailyCap ?? 500000,
      min_confidence: overrides?.minConfidence ?? 0.3,
      strategy_toggles: { retry: true, payment_link: true },
    },
  });

  const riskEvent = await prisma.riskEvent.create({
    data: {
      merchant_id: merchant.id,
      source_type: "payment",
      root_cause: "card_declined",
      amount: overrides?.candidateAmount ?? 5000,
      raw_payload: { payload: {} },
      raw_payload_hash: `hash_${suffix}`,
      status: "open",
    },
  });

  const playbook = await prisma.playbook.create({
    data: {
      risk_event_id: riskEvent.id,
      root_cause: "card_declined",
      recovery_probability: 0.7,
      recovery_value: overrides?.candidateAmount ?? 5000,
      recommended_sequence: [
        {
          strategy: "retry",
          confidence: overrides?.candidateConfidence ?? 0.7,
          expected_value: overrides?.candidateAmount ?? 5000,
        },
        {
          strategy: "payment_link",
          confidence: 0.6,
          expected_value: (overrides?.candidateAmount ?? 5000) - 500,
        },
      ],
      waiting_period_seconds: 3600,
      stopping_rule: { max_attempts: 3 },
      explainable_reasoning: "fixture",
      chain_depth: 2,
      status: "generated",
    },
  });

  return { merchantId: merchant.id, playbookId: playbook.id };
}

async function cleanupFixture(merchantId: string) {
  const riskEvents = await prisma.riskEvent.findMany({ where: { merchant_id: merchantId } });
  const riskEventIds = riskEvents.map((r) => r.id);
  const playbooks = await prisma.playbook.findMany({ where: { risk_event_id: { in: riskEventIds } } });
  const playbookIds = playbooks.map((p) => p.id);

  await prisma.approval.deleteMany({ where: { playbook_id: { in: playbookIds } } });
  await prisma.recoveryAction.deleteMany({ where: { playbook_id: { in: playbookIds } } });
  await prisma.playbook.deleteMany({ where: { id: { in: playbookIds } } });
  await prisma.riskEvent.deleteMany({ where: { merchant_id: merchantId } });
  await prisma.merchantPolicy.deleteMany({ where: { merchant_id: merchantId } });
  await prisma.merchant.delete({ where: { id: merchantId } });
}

describe("evaluatePolicy (pure)", () => {
  const limits = { ceilingAmount: 10000, dailyCap: 50000, minConfidence: 0.5 };

  it("allows a request within all limits", () => {
    expect(evaluatePolicy(limits, 0, { amount: 5000, confidence: 0.8 })).toEqual({
      allowed: true,
      breachReason: null,
    });
  });

  it("flags a ceiling breach", () => {
    expect(evaluatePolicy(limits, 0, { amount: 15000, confidence: 0.8 })).toEqual({
      allowed: false,
      breachReason: "ceiling_breach",
    });
  });

  it("flags a daily cap breach", () => {
    expect(evaluatePolicy(limits, 48000, { amount: 5000, confidence: 0.8 })).toEqual({
      allowed: false,
      breachReason: "daily_cap_breach",
    });
  });

  it("flags low confidence", () => {
    expect(evaluatePolicy(limits, 0, { amount: 5000, confidence: 0.2 })).toEqual({
      allowed: false,
      breachReason: "low_confidence",
    });
  });

  it("checks ceiling before daily cap before confidence", () => {
    const result = evaluatePolicy(limits, 0, { amount: 15000, confidence: 0.1 });
    expect(result.breachReason).toBe("ceiling_breach");
  });
});

describe("runPlaybookWithPolicyGate — ceiling breach", () => {
  let merchantId: string;

  afterAll(async () => {
    await cleanupFixture(merchantId);
    await prisma.$disconnect();
  });

  it("creates a pending approval and does NOT auto-execute", async () => {
    const fixture = await createFixture({ ceilingAmount: 1000, candidateAmount: 5000 });
    merchantId = fixture.merchantId;

    const executor = alwaysSucceedExecutor();
    const result = await runPlaybookWithPolicyGate(fixture.playbookId, executor);

    expect(executor).not.toHaveBeenCalled();
    expect(result?.outcome).toBe("awaiting_approval");
    expect(result?.breachReason).toBe("ceiling_breach");

    const playbook = await prisma.playbook.findUniqueOrThrow({ where: { id: fixture.playbookId } });
    expect(playbook.status).toBe("awaiting_approval");

    const actions = await prisma.recoveryAction.findMany({ where: { playbook_id: fixture.playbookId } });
    expect(actions).toHaveLength(0);

    const approvals = await prisma.approval.findMany({ where: { playbook_id: fixture.playbookId } });
    expect(approvals).toHaveLength(1);
    expect(approvals[0].trigger_reason).toBe("ceiling_breach");
    expect(approvals[0].decision).toBe("pending");
  });
});

describe("runPlaybookWithPolicyGate — daily cap breach", () => {
  let merchantId: string;

  afterAll(async () => {
    await cleanupFixture(merchantId);
    await prisma.$disconnect();
  });

  it("creates a pending approval when the module's daily cap would be exceeded", async () => {
    const fixture = await createFixture({ ceilingAmount: 100000, dailyCap: 1000, candidateAmount: 5000 });
    merchantId = fixture.merchantId;

    const executor = alwaysSucceedExecutor();
    const result = await runPlaybookWithPolicyGate(fixture.playbookId, executor);

    expect(executor).not.toHaveBeenCalled();
    expect(result?.outcome).toBe("awaiting_approval");
    expect(result?.breachReason).toBe("daily_cap_breach");

    const approvals = await prisma.approval.findMany({ where: { playbook_id: fixture.playbookId } });
    expect(approvals).toHaveLength(1);
    expect(approvals[0].trigger_reason).toBe("daily_cap_breach");
  });
});

describe("runPlaybookWithPolicyGate — low confidence breach", () => {
  let merchantId: string;

  afterAll(async () => {
    await cleanupFixture(merchantId);
    await prisma.$disconnect();
  });

  it("creates a pending approval when confidence is below the policy minimum", async () => {
    const fixture = await createFixture({
      ceilingAmount: 100000,
      dailyCap: 500000,
      minConfidence: 0.9,
      candidateConfidence: 0.5,
    });
    merchantId = fixture.merchantId;

    const executor = alwaysSucceedExecutor();
    const result = await runPlaybookWithPolicyGate(fixture.playbookId, executor);

    expect(executor).not.toHaveBeenCalled();
    expect(result?.outcome).toBe("awaiting_approval");
    expect(result?.breachReason).toBe("low_confidence");

    const approvals = await prisma.approval.findMany({ where: { playbook_id: fixture.playbookId } });
    expect(approvals).toHaveLength(1);
    expect(approvals[0].trigger_reason).toBe("low_confidence");
  });
});

describe("runPlaybookWithPolicyGate — policy passes", () => {
  let merchantId: string;

  afterAll(async () => {
    await cleanupFixture(merchantId);
    await prisma.$disconnect();
  });

  it("runs Phase 5 execution directly with no approval created", async () => {
    const fixture = await createFixture({ ceilingAmount: 100000, dailyCap: 500000, minConfidence: 0.3 });
    merchantId = fixture.merchantId;

    const executor = alwaysSucceedExecutor();
    const result = await runPlaybookWithPolicyGate(fixture.playbookId, executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result?.outcome).toBe("executed");

    const approvals = await prisma.approval.findMany({ where: { playbook_id: fixture.playbookId } });
    expect(approvals).toHaveLength(0);

    const playbook = await prisma.playbook.findUniqueOrThrow({ where: { id: fixture.playbookId } });
    expect(playbook.status).toBe("closed");

    const actions = await prisma.recoveryAction.findMany({ where: { playbook_id: fixture.playbookId } });
    expect(actions).toHaveLength(1);
    expect(actions[0].outcome).toBe("succeeded");
  });
});

describe("approveApproval — downstream execution state", () => {
  let merchantId: string;
  let playbookId: string;
  let approvalId: string;

  afterAll(async () => {
    await cleanupFixture(merchantId);
    await prisma.$disconnect();
  });

  it("marks the approval approved and runs the waterfall to completion", async () => {
    const fixture = await createFixture({ ceilingAmount: 100, candidateAmount: 5000 }); // forces a breach
    merchantId = fixture.merchantId;
    playbookId = fixture.playbookId;

    const gateResult = await runPlaybookWithPolicyGate(playbookId, alwaysSucceedExecutor());
    approvalId = gateResult!.approvalId!;

    const { approval, waterfallResult } = await approveApproval(approvalId, alwaysSucceedExecutor());

    expect(approval.decision).toBe("approved");
    expect(approval.decided_at).not.toBeNull();
    expect(waterfallResult?.stopReason).toBe("recovered");

    const playbook = await prisma.playbook.findUniqueOrThrow({ where: { id: playbookId } });
    expect(playbook.status).toBe("closed");

    const actions = await prisma.recoveryAction.findMany({ where: { playbook_id: playbookId } });
    expect(actions).toHaveLength(1);
    expect(actions[0].outcome).toBe("succeeded");
  });

  it("rejects a second decision on an already-decided approval", async () => {
    await expect(rejectApproval(approvalId)).rejects.toBeInstanceOf(ApprovalAlreadyDecidedError);
  });
});

describe("rejectApproval — execution stopped", () => {
  let merchantId: string;
  let playbookId: string;

  afterAll(async () => {
    await cleanupFixture(merchantId);
    await prisma.$disconnect();
  });

  it("marks the approval rejected, escalates the playbook, and never executes", async () => {
    const fixture = await createFixture({ ceilingAmount: 100, candidateAmount: 5000 });
    merchantId = fixture.merchantId;
    playbookId = fixture.playbookId;

    const gateResult = await runPlaybookWithPolicyGate(playbookId, alwaysFailExecutor());
    const approvalId = gateResult!.approvalId!;

    const { approval, playbook } = await rejectApproval(approvalId);

    expect(approval.decision).toBe("rejected");
    expect(approval.decided_at).not.toBeNull();
    expect(playbook.status).toBe("escalated");

    const actions = await prisma.recoveryAction.findMany({ where: { playbook_id: playbookId } });
    expect(actions).toHaveLength(0);
  });
});

describe("modifyApproval — modified values used downstream", () => {
  let merchantId: string;
  let playbookId: string;

  afterAll(async () => {
    await cleanupFixture(merchantId);
    await prisma.$disconnect();
  });

  it("uses the modified amount for the executed step, not the original", async () => {
    const fixture = await createFixture({ ceilingAmount: 100, candidateAmount: 5000 });
    merchantId = fixture.merchantId;
    playbookId = fixture.playbookId;

    const gateResult = await runPlaybookWithPolicyGate(playbookId, alwaysSucceedExecutor());
    const approvalId = gateResult!.approvalId!;

    const { approval, waterfallResult } = await modifyApproval(approvalId, 2500, alwaysSucceedExecutor());

    expect(approval.decision).toBe("modified");
    expect(Number(approval.modified_amount)).toBe(2500);
    expect(waterfallResult?.steps[0].expected_value).toBe(2500);

    const actions = await prisma.recoveryAction.findMany({ where: { playbook_id: playbookId } });
    expect(actions).toHaveLength(1);
    expect(Number(actions[0].expected_value)).toBe(2500);
  });
});