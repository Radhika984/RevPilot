import { ApprovalNotificationContext } from "./types";

/**
 * Posts an internal ops alert to the configured Slack Incoming Webhook.
 * Uses Node's global fetch — no new npm dependency, same pattern as
 * services/playbook-engine/razorpayClient.ts and
 * services/sentinel-ai/openaiClient.ts. Throws on failure — the caller
 * (notifyApprovalEvent) is responsible for catching this so a failed
 * Slack post never breaks the approval flow.
 */
export async function sendSlackApprovalAlert(context: ApprovalNotificationContext): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text:
        `:rotating_light: RevPilot approval required\n` +
        `Playbook: ${context.playbookId}\n` +
        `Approval: ${context.approvalId}\n` +
        `Reason: ${context.triggerReason}\n` +
        `Merchant: ${context.merchantEmail}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook post failed: ${response.status} ${body}`);
  }
}