import { describe, it, expect, vi, beforeEach } from "vitest";
import { runWaterfallSteps } from "../src/services/playbook-engine/chainEngine";
import { planWaterfallSteps } from "../src/services/playbook-engine/planner";
import { MAX_CHAIN_DEPTH } from "../src/services/playbook-engine/types";
import {
  isCircuitOpen,
  recordStepFailure,
  recordStepSuccess,
  resetAllCircuitBreakers,
  CIRCUIT_BREAKER_FAILURE_THRESHOLD,
} from "../src/services/playbook-engine/circuitBreaker";
import type {
  StepExecutor,
  StepExecutorContext,
  WaterfallCandidate,
} from "../src/services/playbook-engine/types";

const fakeContext: StepExecutorContext = {
  riskEventId: "risk-event-fixture-id",
  merchantId: "merchant-fixture-id",
  amount: 5000,
  rawPayload: {},
};

const retryThenPaymentLink: WaterfallCandidate[] = [
  { strategy: "retry", confidence: 0.72, expected_value: 3598 },
  { strategy: "payment_link", confidence: 0.6, expected_value: 2995 },
];

function alwaysFailExecutor(): StepExecutor {
  return vi.fn(async () => ({ outcome: "failed" as const, razorpay_reference_id: "unavailable" }));
}

function alwaysSucceedExecutor(): StepExecutor {
  return vi.fn(async () => ({ outcome: "succeeded" as const, razorpay_reference_id: "plink_fixture" }));
}

beforeEach(() => {
  resetAllCircuitBreakers();
});

describe("MAX_CHAIN_DEPTH", () => {
  it("is fixed at 3", () => {
    expect(MAX_CHAIN_DEPTH).toBe(3);
  });
});

describe("planWaterfallSteps — chain depth cap", () => {
  it("never plans more than MAX_CHAIN_DEPTH steps, even given more candidates", () => {
    const manyCandidates: WaterfallCandidate[] = [
      { strategy: "retry", confidence: 0.9, expected_value: 100 },
      { strategy: "payment_link", confidence: 0.8, expected_value: 90 },
      { strategy: "retry", confidence: 0.7, expected_value: 80 },
      { strategy: "payment_link", confidence: 0.6, expected_value: 70 },
      { strategy: "retry", confidence: 0.5, expected_value: 60 },
    ];

    const planned = planWaterfallSteps(manyCandidates);

    expect(planned).toHaveLength(3);
    expect(planned.map((s) => s.step_number)).toEqual([1, 2, 3]);
  });

  it("plans exactly as many steps as candidates when under the cap", () => {
    const planned = planWaterfallSteps(retryThenPaymentLink);
    expect(planned).toHaveLength(2);
    expect(planned[0].strategy).toBe("retry");
    expect(planned[1].strategy).toBe("payment_link");
  });

  it("is deterministic for identical input", () => {
    const a = planWaterfallSteps(retryThenPaymentLink);
    const b = planWaterfallSteps(retryThenPaymentLink);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("circuit breaker", () => {
  it("stays closed after fewer than the failure threshold", () => {
    recordStepFailure("payment");
    recordStepFailure("payment");
    expect(isCircuitOpen("payment")).toBe(false);
  });

  it(`trips open after exactly ${CIRCUIT_BREAKER_FAILURE_THRESHOLD} consecutive failures`, () => {
    recordStepFailure("payment");
    recordStepFailure("payment");
    recordStepFailure("payment");
    expect(isCircuitOpen("payment")).toBe(true);
  });

  it("closes again once a success is recorded", () => {
    recordStepFailure("payment");
    recordStepFailure("payment");
    recordStepFailure("payment");
    expect(isCircuitOpen("payment")).toBe(true);

    recordStepSuccess("payment");
    expect(isCircuitOpen("payment")).toBe(false);
  });

  it("tracks each module independently", () => {
    recordStepFailure("payment");
    recordStepFailure("payment");
    recordStepFailure("payment");
    expect(isCircuitOpen("payment")).toBe(true);
    expect(isCircuitOpen("subscription")).toBe(false);
  });
});

describe("runWaterfallSteps — successful waterfall flow", () => {
  it("stops immediately when the first strategy succeeds", async () => {
    const executor = alwaysSucceedExecutor();
    const result = await runWaterfallSteps(retryThenPaymentLink, "payment-success-module", executor, fakeContext);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].strategy).toBe("retry");
    expect(result.steps[0].outcome).toBe("succeeded");
    expect(result.stopReason).toBe("recovered");
    expect(result.finalStatus).toBe("closed");
  });

  it("falls through to payment_link and succeeds after retry fails", async () => {
    const executor: StepExecutor = vi
      .fn()
      .mockResolvedValueOnce({ outcome: "failed" as const, razorpay_reference_id: "unavailable" })
      .mockResolvedValueOnce({ outcome: "succeeded" as const, razorpay_reference_id: "plink_123" });

    const result = await runWaterfallSteps(retryThenPaymentLink, "payment-fallback-module", executor, fakeContext);

    expect(executor).toHaveBeenCalledTimes(2);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].strategy).toBe("retry");
    expect(result.steps[0].outcome).toBe("failed");
    expect(result.steps[1].strategy).toBe("payment_link");
    expect(result.steps[1].outcome).toBe("succeeded");
    expect(result.stopReason).toBe("recovered");
    expect(result.finalStatus).toBe("closed");
  });
});

describe("runWaterfallSteps — escalation when all steps fail", () => {
  it("escalates once the sequence is exhausted with no valid next step", async () => {
    const executor = alwaysFailExecutor();
    const result = await runWaterfallSteps(retryThenPaymentLink, "payment-escalate-module", executor, fakeContext);

    expect(executor).toHaveBeenCalledTimes(2);
    expect(result.steps).toHaveLength(2);
    expect(result.steps.every((s) => s.outcome === "failed")).toBe(true);
    expect(result.stopReason).toBe("escalated_exhausted");
    expect(result.finalStatus).toBe("escalated");
  });

  it("does not trip the circuit breaker on only 2 failures (below threshold)", async () => {
    const executor = alwaysFailExecutor();
    await runWaterfallSteps(retryThenPaymentLink, "payment-two-fail-module", executor, fakeContext);
    expect(isCircuitOpen("payment-two-fail-module")).toBe(false);
  });
});

describe("runWaterfallSteps — circuit breaker integration", () => {
  it("trips the breaker mid-chain after the 3rd consecutive failure and escalates", async () => {
    const module = "payment-breaker-module";
    const candidates: WaterfallCandidate[] = [
      { strategy: "retry", confidence: 0.5, expected_value: 100 },
      { strategy: "payment_link", confidence: 0.4, expected_value: 90 },
      { strategy: "retry", confidence: 0.3, expected_value: 80 },
    ];
    const executor = alwaysFailExecutor();

    const result = await runWaterfallSteps(candidates, module, executor, fakeContext);

    expect(executor).toHaveBeenCalledTimes(3);
    expect(result.steps).toHaveLength(3);
    expect(result.stopReason).toBe("escalated_circuit_open");
    expect(result.finalStatus).toBe("escalated");
    expect(isCircuitOpen(module)).toBe(true);
  });

  it("escalates immediately without attempting any step when the circuit is already open", async () => {
    const module = "payment-pretripped-module";
    recordStepFailure(module);
    recordStepFailure(module);
    recordStepFailure(module);
    expect(isCircuitOpen(module)).toBe(true);

    const executor = alwaysSucceedExecutor();
    const result = await runWaterfallSteps(retryThenPaymentLink, module, executor, fakeContext);

    expect(executor).not.toHaveBeenCalled();
    expect(result.steps).toHaveLength(0);
    expect(result.stopReason).toBe("escalated_circuit_open");
    expect(result.finalStatus).toBe("escalated");
  });
});

describe("runWaterfallSteps — chain depth enforcement end-to-end", () => {
  it("never executes more than MAX_CHAIN_DEPTH steps even with more ranked candidates", async () => {
    const module = "payment-depth-module";
    const manyCandidates: WaterfallCandidate[] = [
      { strategy: "retry", confidence: 0.9, expected_value: 100 },
      { strategy: "payment_link", confidence: 0.1, expected_value: 10 },
      { strategy: "retry", confidence: 0.1, expected_value: 9 },
      { strategy: "payment_link", confidence: 0.1, expected_value: 8 },
      { strategy: "retry", confidence: 0.1, expected_value: 7 },
    ];

    const executor: StepExecutor = vi
      .fn()
      .mockResolvedValueOnce({ outcome: "failed" as const, razorpay_reference_id: "unavailable" })
      .mockResolvedValueOnce({ outcome: "failed" as const, razorpay_reference_id: "unavailable" })
      .mockResolvedValueOnce({ outcome: "succeeded" as const, razorpay_reference_id: "plink_depth" });

    const result = await runWaterfallSteps(manyCandidates, module, executor, fakeContext);

    expect(executor).toHaveBeenCalledTimes(3);
    expect(result.steps.length).toBeLessThanOrEqual(MAX_CHAIN_DEPTH);
    expect(result.steps).toHaveLength(3);
    expect(result.stopReason).toBe("recovered");
  });
});