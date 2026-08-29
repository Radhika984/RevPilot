import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * GET /api/risk-events
 * Same auth/scoping pattern as routes/me.ts and routes/playbooks.ts.
 */
router.get("/risk-events", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { clerk_user_id: userId },
  });

  if (!merchant) {
    return res.status(404).json({ error: "Merchant not found for this user" });
  }

  const riskEvents = await prisma.riskEvent.findMany({
    where: { merchant_id: merchant.id },
    orderBy: { created_at: "desc" },
  });

  return res.status(200).json({ risk_events: riskEvents });
});

export default router;