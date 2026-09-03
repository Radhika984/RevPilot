import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { PolicyModule, RecoveryActionStrategy } from "@prisma/client";

const router = Router();

/**
 * Same auth pattern as routes/approvals.ts, routes/playbooks.ts,
 * routes/audit.ts: manual getAuth(req) + 401 JSON, then merchant
 * lookup by clerk_user_id.
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

const ALL_MODULES = Object.values(PolicyModule);
const ALL_STRATEGIES = Object.values(RecoveryActionStrategy);

type StrategyToggles = Record<RecoveryActionStrategy, boolean>;

/**
 * services/policy-engine/policyGate.ts and dailyUsage.ts don't read
 * strategy_toggles at all today (grep confirms no reader exists yet),
 * so this JSON column has never had a shape. This is the one Phase 11
 * defines: one boolean per RecoveryActionStrategy enum value,
 * defaulting every strategy to enabled.
 */
const DEFAULT_STRATEGY_TOGGLES: StrategyToggles = ALL_STRATEGIES.reduce(
  (acc, strategy) => ({ ...acc, [strategy]: true }),
  {} as StrategyToggles
);

/** Merges arbitrary stored/incoming JSON with the defaults, keeping only known strategy keys as booleans. */
function normalizeToggles(input: unknown): StrategyToggles {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return ALL_STRATEGIES.reduce((acc, strategy) => {
    const value = source[strategy];
    acc[strategy] = typeof value === "boolean" ? value : DEFAULT_STRATEGY_TOGGLES[strategy];
    return acc;
  }, {} as StrategyToggles);
}

function serializePolicy(module: PolicyModule, row: Awaited<ReturnType<typeof prisma.merchantPolicy.findFirst>>) {
  if (!row) {
    return {
      module,
      configured: false,
      ceiling_amount: null,
      daily_cap: null,
      min_confidence: null,
      strategy_toggles: DEFAULT_STRATEGY_TOGGLES,
      updated_at: null,
    };
  }

  return {
    module,
    configured: true,
    ceiling_amount: Number(row.ceiling_amount),
    daily_cap: Number(row.daily_cap),
    min_confidence: Number(row.min_confidence),
    strategy_toggles: normalizeToggles(row.strategy_toggles),
    updated_at: row.updated_at,
  };
}

/**
 * GET /api/policies
 *
 * One entry per PolicyModule (subscription, payment, payment_link,
 * settlement) — including modules with no merchant_policies row yet,
 * so the Merchant Policies page can show every module and let the
 * merchant configure the ones policyGate.ts is currently failing safe
 * on (see policyGate.ts's "no_policy_configured" path).
 */
router.get("/policies", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const rows = await prisma.merchantPolicy.findMany({ where: { merchant_id: merchant.id } });
  const byModule = new Map(rows.map((row) => [row.module, row]));

  const policies = ALL_MODULES.map((module) => serializePolicy(module, byModule.get(module) ?? null));

  return res.status(200).json({ policies });
});

/**
 * PUT /api/policies/:module
 * Body: {
 *   ceiling_amount: number,
 *   daily_cap: number,
 *   min_confidence: number,   // 0-1
 *   strategy_toggles?: Partial<Record<RecoveryActionStrategy, boolean>>
 * }
 *
 * Upserts the merchant's policy row for that module. No caching layer
 * sits in front of merchant_policies anywhere in the codebase —
 * services/policy-engine/policyGate.ts calls
 * prisma.merchantPolicy.findUnique() fresh on every
 * workers/playbookEngine.worker.ts run — so this write is in effect
 * for the very next Decision Engine / Policy Gate run with no
 * additional plumbing.
 */
router.put("/policies/:module", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const module = req.params.module as PolicyModule;
  if (!ALL_MODULES.includes(module)) {
    return res.status(400).json({ error: "Invalid policy module" });
  }

  const { ceiling_amount, daily_cap, min_confidence, strategy_toggles } = req.body ?? {};

  if (typeof ceiling_amount !== "number" || !Number.isFinite(ceiling_amount) || ceiling_amount < 0) {
    return res.status(400).json({ error: "ceiling_amount must be a non-negative number" });
  }
  if (typeof daily_cap !== "number" || !Number.isFinite(daily_cap) || daily_cap < 0) {
    return res.status(400).json({ error: "daily_cap must be a non-negative number" });
  }
  if (
    typeof min_confidence !== "number" ||
    !Number.isFinite(min_confidence) ||
    min_confidence < 0 ||
    min_confidence > 1
  ) {
    return res.status(400).json({ error: "min_confidence must be a number between 0 and 1" });
  }
  if (
    strategy_toggles !== undefined &&
    (typeof strategy_toggles !== "object" || strategy_toggles === null || Array.isArray(strategy_toggles))
  ) {
    return res.status(400).json({ error: "strategy_toggles must be an object" });
  }

  const existing = await prisma.merchantPolicy.findUnique({
    where: { merchant_id_module: { merchant_id: merchant.id, module } },
  });

  const mergedToggles = normalizeToggles({
    ...normalizeToggles(existing?.strategy_toggles),
    ...(strategy_toggles as Record<string, unknown> | undefined),
  });

  const saved = await prisma.merchantPolicy.upsert({
    where: { merchant_id_module: { merchant_id: merchant.id, module } },
    create: {
      merchant_id: merchant.id,
      module,
      ceiling_amount,
      daily_cap,
      min_confidence,
      strategy_toggles: mergedToggles,
    },
    update: {
      ceiling_amount,
      daily_cap,
      min_confidence,
      strategy_toggles: mergedToggles,
    },
  });

  return res.status(200).json({ policy: serializePolicy(module, saved) });
});

export default router;