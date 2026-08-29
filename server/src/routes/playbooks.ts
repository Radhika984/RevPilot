import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * GET /api/playbooks
 * GET /api/playbooks/:id
 *
 * Follows the exact auth pattern established in routes/me.ts: manual
 * getAuth(req) + 401 JSON (never requireAuth()'s redirect, since this
 * is a pure JSON API), then merchant lookup by clerk_user_id. All
 * results are scoped to the authenticated merchant's own risk events —
 * a merchant can never read another merchant's playbooks.
 */
router.get("/playbooks", async (req: Request, res: Response) => {
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

  const playbooks = await prisma.playbook.findMany({
    where: { risk_event: { merchant_id: merchant.id } },
    orderBy: { created_at: "desc" },
  });

  return res.status(200).json({ playbooks });
});

router.get("/playbooks/:id", async (req: Request, res: Response) => {
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

  const playbook = await prisma.playbook.findFirst({
    where: {
      id: req.params.id,
      risk_event: { merchant_id: merchant.id },
    },
    include: {
      recovery_actions: { orderBy: { step_number: "asc" } },
    },
  });

  if (!playbook) {
    return res.status(404).json({ error: "Playbook not found" });
  }

  return res.status(200).json({ playbook });
});

export default router;