import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { ApprovalDecision } from "@prisma/client";
import {
  ApprovalAlreadyDecidedError,
  ApprovalNotFoundError,
  approveApproval,
  modifyApproval,
  rejectApproval,
} from "../services/policy-engine/approvalActions";

const router = Router();

/**
 * Same auth pattern as routes/me.ts, routes/playbooks.ts,
 * routes/riskEvents.ts: manual getAuth(req) + 401 JSON, then merchant
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

async function findOwnedApproval(approvalId: string, merchantId: string) {
  return prisma.approval.findFirst({
    where: {
      id: approvalId,
      playbook: { risk_event: { merchant_id: merchantId } },
    },
  });
}

/**
 * GET /api/approvals
 * GET /api/approvals?decision=pending
 *
 * NOTE: the existing `approvals` table (Prisma schema, unmodified by
 * Phase 6) has no created_at column, so results are returned in
 * default query order — not chronologically sorted.
 *
 * Phase 10: the response now includes each approval's playbook (and
 * that playbook's risk_event) so the Approval Inbox can show inline
 * playbook/chain context without a second round trip. This only
 * enriches this existing read endpoint — approveApproval/
 * rejectApproval/modifyApproval and the POST routes below are
 * untouched. Decimal fields are mapped to Number() for the same
 * reason routes/playbooks.ts and routes/revenue.ts do: raw
 * Prisma.Decimal values serialize to strings and break the client's
 * numeric formatters.
 */
router.get("/approvals", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const decisionFilter = req.query.decision;
  const where: any = { playbook: { risk_event: { merchant_id: merchant.id } } };

  if (typeof decisionFilter === "string") {
    if (!Object.values(ApprovalDecision).includes(decisionFilter as any)) {
      return res.status(400).json({ error: "Invalid decision filter" });
    }
    where.decision = decisionFilter;
  }

  const approvals = await prisma.approval.findMany({
    where,
    include: {
      playbook: {
        include: { risk_event: true },
      },
    },
  });

  const items = approvals.map((approval) => ({
    id: approval.id,
    playbook_id: approval.playbook_id,
    trigger_reason: approval.trigger_reason,
    recommended_action: approval.recommended_action,
    approver_email: approval.approver_email,
    decision: approval.decision,
    modified_amount:
      approval.modified_amount === null ? null : Number(approval.modified_amount),
    decided_at: approval.decided_at,
    playbook: {
      id: approval.playbook.id,
      root_cause: approval.playbook.root_cause,
      status: approval.playbook.status,
      recovery_probability: Number(approval.playbook.recovery_probability),
      recovery_value: Number(approval.playbook.recovery_value),
      chain_depth: approval.playbook.chain_depth,
      risk_event: {
        id: approval.playbook.risk_event.id,
        source_type: approval.playbook.risk_event.source_type,
        root_cause: approval.playbook.risk_event.root_cause,
        amount: Number(approval.playbook.risk_event.amount),
        status: approval.playbook.risk_event.status,
      },
    },
  }));

  return res.status(200).json({ approvals: items });
});

/**
 * POST /api/approvals/:id/approve
 * Ownership is verified BEFORE the state-changing action runs.
 */
router.post("/approvals/:id/approve", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const owned = await findOwnedApproval(req.params.id, merchant.id);
  if (!owned) return res.status(404).json({ error: "Approval not found" });

  try {
    const result = await approveApproval(owned.id);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ApprovalAlreadyDecidedError) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof ApprovalNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error(`Failed to approve approval ${owned.id}:`, err);
    return res.status(500).json({ error: "Failed to approve" });
  }
});

/**
 * POST /api/approvals/:id/reject
 */
router.post("/approvals/:id/reject", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const owned = await findOwnedApproval(req.params.id, merchant.id);
  if (!owned) return res.status(404).json({ error: "Approval not found" });

  try {
    const result = await rejectApproval(owned.id);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ApprovalAlreadyDecidedError) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof ApprovalNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error(`Failed to reject approval ${owned.id}:`, err);
    return res.status(500).json({ error: "Failed to reject" });
  }
});

/**
 * POST /api/approvals/:id/modify
 * Body: { "modified_amount": number }
 */
router.post("/approvals/:id/modify", async (req: Request, res: Response) => {
  const merchant = await getAuthedMerchant(req, res);
  if (!merchant) return;

  const owned = await findOwnedApproval(req.params.id, merchant.id);
  if (!owned) return res.status(404).json({ error: "Approval not found" });

  const modifiedAmount = req.body?.modified_amount;
  if (typeof modifiedAmount !== "number" || !Number.isFinite(modifiedAmount) || modifiedAmount <= 0) {
    return res.status(400).json({ error: "modified_amount must be a positive number" });
  }

  try {
    const result = await modifyApproval(owned.id, modifiedAmount);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ApprovalAlreadyDecidedError) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof ApprovalNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error(`Failed to modify approval ${owned.id}:`, err);
    return res.status(500).json({ error: "Failed to modify" });
  }
});

export default router;