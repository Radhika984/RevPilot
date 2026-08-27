import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * GET /api/me
 *
 * Minimal protected route used ONLY to prove the auth chain works:
 * clerkMiddleware() -> auth check -> merchant lookup by clerk_user_id.
 * This is plumbing/verification, not business logic — no dashboards,
 * risk data, or playbook data are exposed here. Added specifically to
 * satisfy the Phase 2 acceptance criteria requiring a real protected
 * endpoint to test 401 vs 200 against.
 *
 * NOTE: this intentionally does NOT use @clerk/express's requireAuth().
 * requireAuth() is built for apps that have a hosted/rendered sign-in
 * page: when there's no valid session it unconditionally issues a 302
 * redirect to signInUrl (defaulting to "/"), with no distinction for
 * JSON/API clients. RevPilot's backend is a pure JSON API with no
 * sign-in page of its own to redirect to, so that behavior is wrong
 * here — API clients need a machine-readable 401, not a redirect.
 * clerkMiddleware() (already mounted in src/index.ts) still does all
 * the real work of verifying the session/token and populating
 * req.auth(); we just replace requireAuth()'s response-on-failure with
 * a plain 401 JSON body instead of a redirect.
 */
router.get("/me", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { clerk_user_id: userId },
  });

  if (!merchant) {
    // Valid Clerk session, but no merchant row yet (webhook may not have
    // landed yet — webhooks are eventually consistent per Clerk's docs).
    return res.status(404).json({ error: "Merchant not found for this user" });
  }

  return res.status(200).json({
    id: merchant.id,
    business_name: merchant.business_name,
    email: merchant.email,
    created_at: merchant.created_at,
  });
});

export default router;