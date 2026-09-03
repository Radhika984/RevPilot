import nodemailer from "nodemailer";
import { ApprovalNotificationContext } from "./types";

/**
 * Lazily created Nodemailer transport from SMTP_* env vars — module-
 * level singleton, same lifecycle pattern as lib/prisma.ts, lib/redis.ts,
 * and lib/queues.ts.
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      throw new Error("SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS not configured");
    }

    transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });
  }

  return transporter;
}

/**
 * Sends the merchant a plain-text email that their recovery playbook
 * needs approval. Throws on failure — the caller (notifyApprovalEvent)
 * is responsible for catching this so a failed email never breaks the
 * approval flow.
 */
export async function sendApprovalEmail(context: ApprovalNotificationContext): Promise<void> {
  const from = process.env.SMTP_FROM || "no-reply@revpilot.local";

  await getTransporter().sendMail({
    from,
    to: context.merchantEmail,
    subject: `RevPilot: recovery playbook ${context.playbookId} needs your approval`,
    text:
      `A recovery playbook requires your approval.\n\n` +
      `Playbook ID: ${context.playbookId}\n` +
      `Approval ID: ${context.approvalId}\n` +
      `Reason: ${context.triggerReason}\n` +
      `Recommended action: ${JSON.stringify(context.recommendedAction)}\n\n` +
      `Review it at your RevPilot dashboard.`,
  });
}