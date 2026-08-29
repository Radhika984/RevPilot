import { createPaymentLink, fetchPaymentStatus } from "./razorpayClient";
import {
  StepExecutionResult,
  StepExecutor,
  StepExecutorContext,
  WaterfallStrategy,
} from "./types";

function safeGet(obj: unknown, path: string[]): unknown {
  let current: any = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/**
 * `retry` strategy: checks the current status of the original Razorpay
 * payment (from the risk event's raw webhook payload) in Test Mode. If
 * it has since been captured/authorized (e.g. Razorpay's own automatic
 * retry succeeded), this step counts as succeeded.
 */
async function executeRetry(context: StepExecutorContext): Promise<StepExecutionResult> {
  const paymentId = safeGet(context.rawPayload, ["payload", "payment", "entity", "id"]);

  if (typeof paymentId !== "string" || paymentId.length === 0) {
    return { outcome: "failed", razorpay_reference_id: "unavailable" };
  }

  try {
    const result = await fetchPaymentStatus(paymentId);
    const succeeded = result.status === "captured" || result.status === "authorized";
    return {
      outcome: succeeded ? "succeeded" : "failed",
      razorpay_reference_id: result.id,
    };
  } catch (err) {
    console.error("retry strategy: Razorpay fetchPaymentStatus failed:", err);
    return { outcome: "failed", razorpay_reference_id: "unavailable" };
  }
}

/**
 * `payment_link` strategy: creates a real Razorpay Payment Link in
 * Test Mode for the risk event's amount.
 */
async function executePaymentLink(context: StepExecutorContext): Promise<StepExecutionResult> {
  try {
    const link = await createPaymentLink({
      amountRupees: context.amount,
      description: `RevPilot recovery for risk event ${context.riskEventId}`,
      referenceId: context.riskEventId,
    });
    return { outcome: "succeeded", razorpay_reference_id: link.id };
  } catch (err) {
    console.error("payment_link strategy: Razorpay createPaymentLink failed:", err);
    return { outcome: "failed", razorpay_reference_id: "unavailable" };
  }
}

/**
 * Default, real-Razorpay-Test-Mode step executor. The chain engine
 * accepts this as an injectable dependency so deterministic unit tests
 * can supply a fake executor instead — no live network access is ever
 * required to prove waterfall/circuit-breaker/escalation logic.
 */
export const defaultStepExecutor: StepExecutor = async (
  strategy: WaterfallStrategy,
  context: StepExecutorContext
) => {
  if (strategy === "retry") return executeRetry(context);
  return executePaymentLink(context);
};