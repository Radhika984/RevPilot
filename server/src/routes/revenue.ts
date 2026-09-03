import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * Phase 8: read-only revenue aggregation APIs for the Revenue War Room.
 * Same auth/scoping pattern as routes/me.ts, routes/playbooks.ts,
 * routes/riskEvents.ts and routes/approvals.ts: manual getAuth(req) +
 * 401 JSON (never requireAuth()'s redirect — this is a pure JSON API),
 * then merchant lookup by clerk_user_id. Every query below is scoped to
 * the returned merchant's own id, so one merchant can never see another
 * merchant's revenue data.
 */
async function getAuthedMerchant(req: Request, res: Response) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const merchant = await prisma.merchant.findUnique({ where: { clerk_user_id: userId } });
  if (!merchant) {
    res.status(404).json({ error: "Merchant not found for this user" });
    return null;
  }

  return merchant;
}

/** Clamp an optional ?limit= query param to a sane range (1-200, default 50). */
function parseLimit(raw: unknown): number {
  const parsed = typeof raw === "string" ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 200);
}

/**
 * GET /api/revenue/summary
 *
 * Headline numbers for the Revenue War Room. Derived entirely from
 * existing Phase 1-7 data — no schema changes:
 *  - "at risk"   = risk_events still in `open` status (root cause
 *                  detected; no recovery has closed it out yet)
 *  - "recovered" = risk_events whose most recent playbook reached
 *                  `closed` status. services/playbook-engine/
 *                  chainEngine.ts only ever sets a playbook to `closed`
 *                  when a waterfall step's outcome was `succeeded`
 *                  (stopReason: "recovered"), so `closed` is the
 *                  reliable signal that revenue was actually recovered.
 *  - "escalated" = risk_events whose playbook exhausted the waterfall
 *                  or tripped the circuit breaker without recovering —
 *                  used only as the denominator for recovery_rate.
 */
router.get("/revenue/summary", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const [atRiskAgg, openCount, recoveredAgg, recoveredCount, escalatedCount, pendingApprovalsCount] =
    await prisma.$transaction([
      prisma.riskEvent.aggregate({
        where: { merchant_id: merchant.id, status: "open" },
        _sum: { amount: true },
      }),
      prisma.riskEvent.count({
        where: { merchant_id: merchant.id, status: "open" },
      }),
      prisma.riskEvent.aggregate({
        where: { merchant_id: merchant.id, playbooks: { some: { status: "closed" } } },
        _sum: { amount: true },
      }),
      prisma.riskEvent.count({
        where: { merchant_id: merchant.id, playbooks: { some: { status: "closed" } } },
      }),
      prisma.riskEvent.count({
        where: { merchant_id: merchant.id, playbooks: { some: { status: "escalated" } } },
      }),
      prisma.approval.count({
        where: {
          playbook: { risk_event: { merchant_id: merchant.id } },
          decision: "pending",
        },
      }),
    ]);

  const totalAtRisk = Number(atRiskAgg._sum.amount ?? 0);
  const totalRecovered = Number(recoveredAgg._sum.amount ?? 0);
  const resolvedAttempts = recoveredCount + escalatedCount;
  const recoveryRate = resolvedAttempts > 0 ? recoveredCount / resolvedAttempts : null;

  return res.status(200).json({
    currency: "INR",
    total_at_risk: totalAtRisk,
    open_risk_event_count: openCount,
    total_recovered: totalRecovered,
    recovered_risk_event_count: recoveredCount,
    escalated_risk_event_count: escalatedCount,
    recovery_rate: recoveryRate,
    pending_approvals_count: pendingApprovalsCount,
  });
});

/**
 * GET /api/revenue/at-risk
 * GET /api/revenue/at-risk?limit=20
 *
 * Open risk events for the authenticated merchant, highest amount
 * first, paired with a summary of the most recently generated playbook
 * (if the decision engine has already produced one) so the UI can show
 * what RevPilot recommends without a second round trip.
 */
router.get("/revenue/at-risk", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const limit = parseLimit(req.query.limit);

  const riskEvents = await prisma.riskEvent.findMany({
    where: { merchant_id: merchant.id, status: "open" },
    orderBy: { amount: "desc" },
    take: limit,
    include: {
      playbooks: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          recovery_probability: true,
          recovery_value: true,
        },
      },
    },
  });

  const items = riskEvents.map((riskEvent) => {
    const playbook = riskEvent.playbooks[0] ?? null;
    return {
      id: riskEvent.id,
      source_type: riskEvent.source_type,
      root_cause: riskEvent.root_cause,
      amount: Number(riskEvent.amount),
      status: riskEvent.status,
      created_at: riskEvent.created_at,
      playbook: playbook
        ? {
            id: playbook.id,
            status: playbook.status,
            recovery_probability: Number(playbook.recovery_probability),
            recovery_value: Number(playbook.recovery_value),
          }
        : null,
    };
  });

  return res.status(200).json({
    items,
    total_at_risk: items.reduce((sum, item) => sum + item.amount, 0),
  });
});

/**
 * GET /api/revenue/recovered
 * GET /api/revenue/recovered?limit=20
 *
 * Risk events whose most recent playbook closed successfully, newest
 * first, paired with the recovery_actions row that actually succeeded
 * so the UI can show which strategy worked and when it happened.
 */
router.get("/revenue/recovered", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const limit = parseLimit(req.query.limit);

  const riskEvents = await prisma.riskEvent.findMany({
    where: { merchant_id: merchant.id, playbooks: { some: { status: "closed" } } },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      playbooks: {
        where: { status: "closed" },
        orderBy: { created_at: "desc" },
        take: 1,
        include: {
          recovery_actions: {
            where: { outcome: "succeeded" },
            orderBy: { executed_at: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const items = riskEvents.map((riskEvent) => {
    const playbook = riskEvent.playbooks[0] ?? null;
    const action = playbook?.recovery_actions[0] ?? null;
    return {
      id: riskEvent.id,
      source_type: riskEvent.source_type,
      root_cause: riskEvent.root_cause,
      amount: Number(riskEvent.amount),
      recovered_at: action?.executed_at ?? null,
      strategy: action?.strategy ?? null,
      razorpay_reference_id: action?.razorpay_reference_id ?? null,
    };
  });

  return res.status(200).json({
    items,
    total_recovered: items.reduce((sum, item) => sum + item.amount, 0),
  });
});

export default router;
