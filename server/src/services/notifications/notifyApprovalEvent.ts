import { sendApprovalEmail } from "./emailNotifier";
import { sendSlackApprovalAlert } from "./slackNotifier";
import { ApprovalNotificationContext, NotificationDispatchResult } from "./types";

export type EmailSender = (context: ApprovalNotificationContext) => Promise<void>;
export type SlackSender = (context: ApprovalNotificationContext) => Promise<void>;

/**
 * Dispatches BOTH the merchant approval email and the internal Slack
 * ops alert for one approval event. The two dispatches are independent
 * of each other and of the caller: each failure is caught and logged
 * individually via Promise.allSettled, so neither notification channel
 * failing can ever break the other, and neither can ever break the
 * core approval flow that calls this function
 * (services/policy-engine/policyGate.ts). This function NEVER throws.
 *
 * `sendEmail`/`sendSlack` are injectable (default to the real
 * Nodemailer/Slack-webhook senders) purely so deterministic tests can
 * prove both are dispatched from one event without any real SMTP/Slack
 * network access — same dependency-injection pattern used throughout
 * this codebase.
 */
export async function notifyApprovalEvent(
  context: ApprovalNotificationContext,
  sendEmail: EmailSender = sendApprovalEmail,
  sendSlack: SlackSender = sendSlackApprovalAlert
): Promise<NotificationDispatchResult> {
  const [emailResult, slackResult] = await Promise.allSettled([sendEmail(context), sendSlack(context)]);

  if (emailResult.status === "rejected") {
    console.error(
      `Notifications: merchant approval email failed for approvalId=${context.approvalId}:`,
      emailResult.reason
    );
  }
  if (slackResult.status === "rejected") {
    console.error(
      `Notifications: Slack approval alert failed for approvalId=${context.approvalId}:`,
      slackResult.reason
    );
  }

  return {
    emailSent: emailResult.status === "fulfilled",
    slackSent: slackResult.status === "fulfilled",
  };
}