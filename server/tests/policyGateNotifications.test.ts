import { describe, it, expect, vi, afterAll } from "vitest";

const notifyApprovalEventMock = vi.fn(async () => ({ emailSent: true, slackSent: true }));

vi.mock("../src/services/notifications/notifyApprovalEvent", () => ({
  notifyApprovalEvent: (...args: unknown[]) => notifyApprovalEventMock(...args),
}));

import { prisma } from "../src/lib/prisma";
import { runPlaybookWithPolicyGate } from "../src/services/policy-engine/policyGate";

describe("policyGate — dispatches notifyApprovalEvent on approval creation", () => {
  const merchantIds: string[] = [];

  afterAll(async () => {
    for (const merchantId of merchantIds) {
      const riskEvents = await prisma.riskEvent.findMany({ where: { merchant_id: merchantId } });
      const riskEventIds = riskEvents.map((r) => r.id);
      const playbooks = await prisma.playbook.findMany({ where: { risk_event_id: { in: riskEventIds } } });
      const playbookIds = playbooks.map((p) => p.id);
      await prisma.approval.deleteMany({ where: { playbook_id: { in: playbookIds } } });
      await prisma.recoveryAction.deleteMany({ where: { playbook_id: { in: playbookIds } } });
      await prisma.playbook.deleteMany({ where: { id: { in: playbookIds } } });
      await prisma.riskEvent.deleteMany({ where: { merchant_id: merchantId } });
      await prisma.merchantPolicy.deleteMany({ where: { merchant_id: merchantId } });
      await prisma.merchant.deleteMany({ where: { id: merchantId } });
    }
    await prisma.$disconnect();
  });

  it("is called exactly once, with the correct context, when a policy breach creates an approval", async () => {
    const suffix = `notify-${Date.now()}`;
    const merchant = await prisma.merchant.create({
      data: { clerk_user_id: `clerk_${suffix}`, email: `${suffix}@example.com`, business_name: "Notify Test" },
    });
    merchantIds.push(merchant.id);

    await prisma.merchantPolicy.create({
      data: {
        merchant_id: merchant.id,
        module: "payment",
        ceiling_amount: 100, // forces a breach
        daily_cap: 500000,
        min_confidence: 0.3,
        strategy_toggles: { retry: true, payment_link: true },
      },
    });

    const riskEvent = await prisma.riskEvent.create({
      data: {
        merchant_id: merchant.id,
        source_type: "payment",
        root_cause: "card_declined",
        amount: 5000,
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
        recovery_value: 5000,
        recommended_sequence: [
          { strategy: "retry", confidence: 0.7, expected_value: 5000 },
          { strategy: "payment_link", confidence: 0.6, expected_value: 4500 },
        ],
        waiting_period_seconds: 3600,
        stopping_rule: { max_attempts: 2 },
        explainable_reasoning: "fixture",
        chain_depth: 2,
        status: "generated",
      },
    });

    await runPlaybookWithPolicyGate(playbook.id);

    expect(notifyApprovalEventMock).toHaveBeenCalledTimes(1);
    const calledContext = notifyApprovalEventMock.mock.calls[0][0] as {
      playbookId: string;
      merchantEmail: string;
      triggerReason: string;
    };
    expect(calledContext.playbookId).toBe(playbook.id);
    expect(calledContext.merchantEmail).toBe(merchant.email);
    expect(calledContext.triggerReason).toBe("ceiling_breach");
  });
});