import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import { prisma } from "../src/lib/prisma";

describe("POST /api/webhooks/clerk", () => {
  it("rejects a request with no/invalid Svix signature headers with 400", async () => {
    const res = await request(app)
      .post("/api/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "user.created", data: { id: "fake" } }));

    // No svix-id/svix-timestamp/svix-signature headers -> verifyWebhook throws
    expect(res.status).toBe(400);
  });

  /**
   * NOT INCLUDED: an automated "valid signature -> merchant created" and
   * "duplicate delivery -> no duplicate merchant" test using a REAL Svix
   * signature, for the same reason as auth.test.ts — generating a
   * genuinely valid Svix signature requires the real
   * CLERK_WEBHOOK_SIGNING_SECRET issued by a live Clerk endpoint
   * configuration, which doesn't exist in this repo/CI context yet.
   *
   * Manual verification path (do this once real Clerk webhook keys exist):
   *   1. In the Clerk Dashboard, add a webhook endpoint pointing at your
   *      ngrok/tunnel URL + /api/webhooks/clerk, subscribe to user.created
   *   2. Copy the endpoint's Signing Secret into CLERK_WEBHOOK_SIGNING_SECRET
   *   3. Use the Dashboard's "Send Example" for user.created
   *   4. Confirm a merchants row was created:
   *      SELECT * FROM merchants WHERE clerk_user_id = '<test id>';
   *   5. Send the same example again ("Send Example" replays the same
   *      payload/id) and confirm the row COUNT is still 1, not 2.
   *
   * The idempotency guarantee itself IS verified at the database level
   * independent of Clerk — see the upsert-idempotency test below, which
   * exercises the exact Prisma call the webhook handler makes.
   */
});

describe("Merchant upsert idempotency (the mechanism the webhook relies on)", () => {
  const testClerkId = "test_clerk_user_idempotency_check";

  afterAll(async () => {
    await prisma.merchant.deleteMany({ where: { clerk_user_id: testClerkId } });
    await prisma.$disconnect();
  });

  it("creates one merchant on first upsert, and does not duplicate on second", async () => {
    const first = await prisma.merchant.upsert({
      where: { clerk_user_id: testClerkId },
      update: {},
      create: {
        clerk_user_id: testClerkId,
        email: "idempotency-test@example.com",
        business_name: "Idempotency Test",
      },
    });

    const second = await prisma.merchant.upsert({
      where: { clerk_user_id: testClerkId },
      update: {},
      create: {
        clerk_user_id: testClerkId,
        email: "idempotency-test@example.com",
        business_name: "Idempotency Test",
      },
    });

    expect(first.id).toBe(second.id);

    const count = await prisma.merchant.count({
      where: { clerk_user_id: testClerkId },
    });
    expect(count).toBe(1);
  });
});