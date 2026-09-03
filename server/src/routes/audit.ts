import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { AuditEntityType } from "@prisma/client";

const router = Router();

/**
 * Phase 10. Same auth pattern as routes/approvals.ts,
 * routes/playbooks.ts, routes/me.ts: manual getAuth(req) + 401 JSON,
 * then merchant lookup by clerk_user_id.
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

/**
 * GET /api/audit
 * GET /api/audit?entity_type=playbook
 * GET /api/audit?entity_id=<uuid>
 * GET /api/audit?q=<substring>
 *
 * Read-only, merchant-scoped listing of the existing audit_ledger
 * table (schema.prisma AuditLedger model — Phase 10 does not modify
 * it). Newest first, same ordering convention as GET /api/playbooks.
 * `entity_type` is validated against the AuditEntityType enum;
 * `entity_id` is an exact match; `q` is a case-insensitive substring
 * search over event_description.
 */
router.get("/audit", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const { entity_type, entity_id, q } = req.query;
  const where: any = { merchant_id: merchant.id };

  if (typeof entity_type === "string") {
    if (!Object.values(AuditEntityType).includes(entity_type as any)) {
      return res.status(400).json({ error: "Invalid entity_type filter" });
    }
    where.entity_type = entity_type;
  }

  if (typeof entity_id === "string" && entity_id.trim()) {
    where.entity_id = entity_id.trim();
  }

  if (typeof q === "string" && q.trim()) {
    where.event_description = { contains: q.trim(), mode: "insensitive" };
  }

  const entries = await prisma.auditLedger.findMany({
    where,
    orderBy: { created_at: "desc" },
  });

  return res.status(200).json({ entries });
});

/**
 * GET /api/audit/verify
 *
 * Validates the hash-chain LINKAGE of the merchant's audit_ledger
 * entries: walking oldest -> newest, each entry's `previous_hash`
 * must equal the immediately preceding entry's `entry_hash` (the
 * first entry must have `previous_hash === null`), and every entry
 * must actually carry an `entry_hash`. This checks structural chain
 * integrity (tamper/gap detection) without assuming any particular
 * hashing algorithm, since nothing in the current codebase writes
 * audit_ledger rows yet — no write path exists to reverse-engineer a
 * content-hash scheme from, and Phase 10 does not add one (read-only,
 * per scope).
 *
 * Zero entries is reported as valid (nothing to break), matching the
 * empty-state the client shows for GET /api/audit.
 */
router.get("/audit/verify", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const entries = await prisma.auditLedger.findMany({
    where: { merchant_id: merchant.id },
    orderBy: { created_at: "asc" },
  });

  if (entries.length === 0) {
    return res.status(200).json({
      valid: true,
      entries_checked: 0,
      broken_at_entry_id: null,
      reason: "No audit ledger entries yet.",
    });
  }

  let expectedPreviousHash: string | null = null;
  for (const entry of entries) {
    if (!entry.entry_hash) {
      return res.status(200).json({
        valid: false,
        entries_checked: entries.length,
        broken_at_entry_id: entry.id,
        reason: `Entry ${entry.id} is missing an entry_hash.`,
      });
    }
    if (entry.previous_hash !== expectedPreviousHash) {
      return res.status(200).json({
        valid: false,
        entries_checked: entries.length,
        broken_at_entry_id: entry.id,
        reason: `Entry ${entry.id}'s previous_hash does not match the prior entry's entry_hash — chain link broken.`,
      });
    }
    expectedPreviousHash = entry.entry_hash;
  }

  return res.status(200).json({
    valid: true,
    entries_checked: entries.length,
    broken_at_entry_id: null,
    reason: null,
  });
});

export default router;