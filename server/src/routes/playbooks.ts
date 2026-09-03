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
    include: { risk_event: true },
  });

  // Decimal fields (Prisma.Decimal) serialize to strings via JSON.stringify,
  // which breaks the client's numeric formatters (see lib/format.ts) — same
  // reason routes/revenue.ts maps every Decimal to Number() before
  // responding rather than returning raw Prisma rows.
  const items = playbooks.map((playbook) => ({
    id: playbook.id,
    root_cause: playbook.root_cause,
    status: playbook.status,
    recovery_probability: Number(playbook.recovery_probability),
    recovery_value: Number(playbook.recovery_value),
    chain_depth: playbook.chain_depth,
    created_at: playbook.created_at,
    risk_event: {
      id: playbook.risk_event.id,
      source_type: playbook.risk_event.source_type,
      root_cause: playbook.risk_event.root_cause,
      amount: Number(playbook.risk_event.amount),
      status: playbook.risk_event.status,
      created_at: playbook.risk_event.created_at,
    },
  }));

  return res.status(200).json({ playbooks: items });
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
      risk_event: true,
      recovery_actions: { orderBy: { step_number: "asc" } },
    },
  });

  if (!playbook) {
    return res.status(404).json({ error: "Playbook not found" });
  }

  // Same Decimal -> Number mapping rationale as GET /playbooks above.
  const detail = {
    id: playbook.id,
    root_cause: playbook.root_cause,
    status: playbook.status,
    recovery_probability: Number(playbook.recovery_probability),
    recovery_value: Number(playbook.recovery_value),
    chain_depth: playbook.chain_depth,
    created_at: playbook.created_at,
    waiting_period_seconds: playbook.waiting_period_seconds,
    stopping_rule: playbook.stopping_rule,
    explainable_reasoning: playbook.explainable_reasoning,
    risk_event: {
      id: playbook.risk_event.id,
      source_type: playbook.risk_event.source_type,
      root_cause: playbook.risk_event.root_cause,
      amount: Number(playbook.risk_event.amount),
      status: playbook.risk_event.status,
      created_at: playbook.risk_event.created_at,
    },
    recovery_actions: playbook.recovery_actions.map((action) => ({
      id: action.id,
      step_number: action.step_number,
      strategy: action.strategy,
      confidence: Number(action.confidence),
      expected_value: Number(action.expected_value),
      outcome: action.outcome,
      razorpay_reference_id: action.razorpay_reference_id,
      executed_at: action.executed_at,
    })),
  };

  return res.status(200).json({ playbook: detail });
});

export default router;