import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { runPlaybookWaterfall } from "../playbook-engine/chainEngine";
import { defaultStepExecutor } from "../playbook-engine/strategyExecutors";
import { StepExecutor, WaterfallCandidate } from "../playbook-engine/types";

export class ApprovalNotFoundError extends Error {}
export class ApprovalAlreadyDecidedError extends Error {}

/**
 * Approves a pending approval: marks it "approved" and hands the
 * (unmodified) playbook straight to the existing Phase 5 waterfall
 * (chainEngine.runPlaybookWaterfall), bypassing the policy gate this
 * once since a human has explicitly authorized it.
 *
 * `executor` is injectable (defaults to the real Razorpay Test Mode
 * executor) for deterministic tests, same pattern as chainEngine.ts
 * and policyGate.ts.
 */
export async function approveApproval(
  approvalId: string,
  executor: StepExecutor = defaultStepExecutor
) {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
  if (!approval) {
    throw new ApprovalNotFoundError(`Approval ${approvalId} not found`);
  }
  if (approval.decision !== "pending") {
    throw new ApprovalAlreadyDecidedError(`Approval ${approvalId} already decided: ${approval.decision}`);
  }

  const updatedApproval = await prisma.approval.update({
    where: { id: approvalId },
    data: { decision: "approved", decided_at: new Date() },
  });

  const waterfallResult = await runPlaybookWaterfall({ playbookId: approval.playbook_id, executor });

  return { approval: updatedApproval, waterfallResult };
}

/**
 * Rejects a pending approval: stops execution entirely. No
 * recovery_actions are ever created for a rejected playbook. The
 * playbook moves to "escalated" — the existing schema's terminal
 * non-recovered state; there is no separate "rejected" PlaybookStatus,
 * and Phase 6 must not modify the schema.
 */
export async function rejectApproval(approvalId: string) {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
  if (!approval) {
    throw new ApprovalNotFoundError(`Approval ${approvalId} not found`);
  }
  if (approval.decision !== "pending") {
    throw new ApprovalAlreadyDecidedError(`Approval ${approvalId} already decided: ${approval.decision}`);
  }

  const updatedApproval = await prisma.approval.update({
    where: { id: approvalId },
    data: { decision: "rejected", decided_at: new Date() },
  });

  const updatedPlaybook = await prisma.playbook.update({
    where: { id: approval.playbook_id },
    data: { status: "escalated" },
  });

  return { approval: updatedApproval, playbook: updatedPlaybook };
}

/**
 * Modifies a pending approval's amount and genuinely uses that
 * modified amount downstream: patches the playbook's top-ranked
 * recommended_sequence candidate to the modified amount, then runs the
 * existing Phase 5 waterfall against the modified sequence — so the
 * modified value is what actually gets persisted onto the executed
 * recovery_action, not just recorded on the approval for audit.
 */
export async function modifyApproval(
  approvalId: string,
  modifiedAmount: number,
  executor: StepExecutor = defaultStepExecutor
) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: { playbook: true },
  });
  if (!approval) {
    throw new ApprovalNotFoundError(`Approval ${approvalId} not found`);
  }
  if (approval.decision !== "pending") {
    throw new ApprovalAlreadyDecidedError(`Approval ${approvalId} already decided: ${approval.decision}`);
  }

  const updatedApproval = await prisma.approval.update({
    where: { id: approvalId },
    data: { decision: "modified", modified_amount: modifiedAmount, decided_at: new Date() },
  });

  const candidates = approval.playbook.recommended_sequence as unknown as WaterfallCandidate[];
  const modifiedCandidates: WaterfallCandidate[] =
    candidates.length > 0
      ? [{ ...candidates[0], expected_value: modifiedAmount }, ...candidates.slice(1)]
      : candidates;

  await prisma.playbook.update({
    where: { id: approval.playbook_id },
    data: { recommended_sequence: modifiedCandidates as unknown as Prisma.InputJsonValue },
  });

  const waterfallResult = await runPlaybookWaterfall({ playbookId: approval.playbook_id, executor });

  return { approval: updatedApproval, waterfallResult };
}