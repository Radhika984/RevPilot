/**
 * Minimal Razorpay REST client for Phase 5. Uses Node's built-in global
 * fetch (available in the Node runtime this project already targets —
 * no new npm dependency added, per Phase 5 requirement 9). Whether this
 * hits Razorpay's Test Mode or Live Mode is determined entirely by
 * which RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET pair is configured in the
 * environment — use Test Mode keys for Phase 5 verification.
 */

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured");
  }

  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export interface RazorpayPaymentLinkResult {
  id: string;
  short_url: string;
  status: string;
}

/**
 * Creates a Razorpay Payment Link. Used by the `payment_link` waterfall
 * strategy.
 */
export async function createPaymentLink(params: {
  amountRupees: number;
  description: string;
  referenceId: string;
}): Promise<RazorpayPaymentLinkResult> {
  const response = await fetch(`${RAZORPAY_API_BASE}/payment_links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: Math.round(params.amountRupees * 100),
      currency: "INR",
      description: params.description,
      reference_id: params.referenceId,
    }),
  });

  const body = (await response.json()) as any;

  if (!response.ok) {
    throw new Error(`Razorpay payment_links create failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return { id: body.id, short_url: body.short_url, status: body.status };
}

/**
 * Fetches a Razorpay payment's current status. Used by the `retry`
 * strategy to check whether a previously-failed payment has since been
 * captured (e.g. via Razorpay's own automatic retry) in Test Mode.
 */
export async function fetchPaymentStatus(paymentId: string): Promise<{ id: string; status: string }> {
  const response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}`, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });

  const body = (await response.json()) as any;

  if (!response.ok) {
    throw new Error(`Razorpay payments fetch failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return { id: body.id, status: body.status };
}