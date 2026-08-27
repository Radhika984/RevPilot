import { Router, Request, Response } from "express";
import { verifyWebhook } from "@clerk/express/webhooks";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * POST /api/webhooks/clerk
 *
 * This route is intentionally EXCLUDED from clerkMiddleware()/requireAuth().
 * Clerk itself calls this endpoint and cannot present a user session —
 * authenticity is instead established by verifying the Svix webhook
 * signature via verifyWebhook(), using CLERK_WEBHOOK_SIGNING_SECRET.
 *
 * Only user.created is handled in Phase 2. All other event types are
 * accepted (200) but ignored, since retried/unhandled events are not
 * in scope.
 */
router.post("/clerk", async (req: Request, res: Response) => {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Clerk webhook signature verification failed:", err);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  if (evt.type !== "user.created") {
    // Not an error — just not a Phase 2 concern.
    return res.status(200).json({ received: true, ignored: evt.type });
  }

  const clerkUserId = evt.data.id;
  const primaryEmail =
    evt.data.email_addresses?.find(
      (e) => e.id === evt.data.primary_email_address_id
    )?.email_address ??
    evt.data.email_addresses?.[0]?.email_address ??
    null;

  if (!clerkUserId || !primaryEmail) {
    console.error("user.created webhook missing required fields", {
      clerkUserId,
      primaryEmail,
    });
    return res
      .status(400)
      .json({ error: "Missing clerk user id or email in payload" });
  }

  // Business name handling (Part 6 does not define a canonical source):
  // smallest reasonable choice — use Clerk's first/last name if present,
  // otherwise fall back to the email's local part. No new schema field
  // was added to solve this; business_name is populated at write time.
  const first = evt.data.first_name?.trim();
  const last = evt.data.last_name?.trim();
  const derivedName =
    [first, last].filter(Boolean).join(" ").trim() ||
    primaryEmail.split("@")[0];

  try {
    // Idempotent: unique(clerk_user_id) means a duplicate delivery of the
    // same user.created event upserts onto the same row instead of
    // creating a second merchant.
    const merchant = await prisma.merchant.upsert({
      where: { clerk_user_id: clerkUserId },
      update: {}, // already exists — no-op, satisfies idempotency requirement
      create: {
        clerk_user_id: clerkUserId,
        email: primaryEmail,
        business_name: derivedName,
      },
    });

    return res.status(200).json({ received: true, merchantId: merchant.id });
  } catch (err) {
    console.error("Failed to upsert merchant from webhook:", err);
    return res.status(500).json({ error: "Internal error processing webhook" });
  }
});

export default router;