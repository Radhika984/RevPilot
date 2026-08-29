import { describe, it, expect } from "vitest";
import { buildDecision, buildPlaybookCreateData } from "../src/services/decision-engine/engine";
import { classifyRootCause } from "../src/services/decision-engine/rootCause";
import { calculateConfidence } from "../src/services/decision-engine/confidence";
import { calculateExpectedValue } from "../src/services/decision-engine/expectedValue";
import { DecisionEngineInput } from "../src/services/decision-engine/types";

const insufficientFundsFixture: DecisionEngineInput = {
  sourceType: "payment",
  eventName: "payment.failed",
  amount: 5000,
  rawPayload: {
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          amount: 500000,
          error_reason: "insufficient_funds",
        },
      },
    },
  },
};

const abandonedCheckoutFixture: DecisionEngineInput = {
  sourceType: "payment_link",
  eventName: "payment_link.expired",
  amount: 1200,
  rawPayload: {
    event: "payment_link.expired",
    payload: {
      payment_link: {
        entity: {
          amount: 120000,
        },
      },
    },
  },
};

describe("classifyRootCause", () => {
  it("is deterministic for identical input", () => {
    const a = classifyRootCause(insufficientFundsFixture);
    const b = classifyRootCause(insufficientFundsFixture);
    expect(a).toBe(b);
    expect(a).toBe("insufficient_funds");
  });

  it("classifies payment_link.expired as customer_abandoned_checkout", () => {
    expect(classifyRootCause(abandonedCheckoutFixture)).toBe("customer_abandoned_checkout");
  });

  it("falls back to unclassified for unknown events with no error info", () => {
    const result = classifyRootCause({
      sourceType: "payment",
      eventName: "payment.captured",
      amount: 100,
      rawPayload: {},
    });
    expect(result).toBe("unclassified");
  });
});

describe("calculateConfidence", () => {
  it("is always within [0, 1]", () => {
    const strategies: Array<"retry" | "payment_link"> = ["retry", "payment_link"];
    const rootCauses = [
      "insufficient_funds",
      "issuer_declined",
      "authentication_failure",
      "invalid_card",
      "expired_card",
      "risk_check_failed",
      "issuer_restriction",
      "processor_error",
      "processor_decline_other",
      "customer_abandoned_checkout",
      "recurring_payment_delay",
      "repeated_mandate_failure",
      "unclassified_payment_failure",
      "unclassified",
      "totally_unknown_value",
    ];

    for (const strategy of strategies) {
      for (const rootCause of rootCauses) {
        const confidence = calculateConfidence(rootCause, strategy);
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic for identical input", () => {
    const a = calculateConfidence("insufficient_funds", "retry");
    const b = calculateConfidence("insufficient_funds", "retry");
    expect(a).toBe(b);
  });
});

describe("calculateExpectedValue", () => {
  it("computes confidence * amount - fixed cost deterministically", () => {
    const ev = calculateExpectedValue("retry", 0.72, 5000);
    expect(ev).toBe(Math.round((0.72 * 5000 - 2) * 100) / 100);
  });

  it("is deterministic for identical input", () => {
    const a = calculateExpectedValue("payment_link", 0.5, 1200);
    const b = calculateExpectedValue("payment_link", 0.5, 1200);
    expect(a).toBe(b);
  });
});

describe("buildDecision", () => {
  it("produces byte-identical scores for the same fixture across repeated runs", () => {
    const first = buildDecision(insufficientFundsFixture);
    const second = buildDecision(insufficientFundsFixture);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("scores exactly the two in-scope strategies: retry and payment_link", () => {
    const decision = buildDecision(insufficientFundsFixture);
    const strategyNames = decision.strategies.map((s) => s.strategy).sort();
    expect(strategyNames).toEqual(["payment_link", "retry"]);
  });

  it("keeps every confidence score within [0, 1]", () => {
    const decision = buildDecision(insufficientFundsFixture);
    for (const s of decision.strategies) {
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("ranks payment_link above retry for an abandoned checkout", () => {
    const decision = buildDecision(abandonedCheckoutFixture);
    expect(decision.strategies[0].strategy).toBe("payment_link");
  });

  it("sorts strategies descending by expected_value", () => {
    const decision = buildDecision(insufficientFundsFixture);
    expect(decision.strategies[0].expected_value).toBeGreaterThanOrEqual(
      decision.strategies[1].expected_value
    );
  });
});

describe("buildPlaybookCreateData", () => {
  it("maps a Decision onto the existing playbooks schema in draft status", () => {
    const decision = buildDecision(insufficientFundsFixture);
    const data = buildPlaybookCreateData("risk-event-fixture-id", decision);

    expect(data.risk_event_id).toBe("risk-event-fixture-id");
    expect(data.status).toBe("generated");
    expect(data.chain_depth).toBe(2);
    expect(Array.isArray(data.recommended_sequence)).toBe(true);
    expect(data.recommended_sequence).toHaveLength(2);
    expect(data.recovery_probability).toBe(decision.strategies[0].confidence);
    expect(data.recovery_value).toBe(decision.strategies[0].expected_value);
  });

  it("is deterministic for identical input", () => {
    const decision = buildDecision(insufficientFundsFixture);
    const a = buildPlaybookCreateData("fixed-id", decision);
    const b = buildPlaybookCreateData("fixed-id", decision);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});