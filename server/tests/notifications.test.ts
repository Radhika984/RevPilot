import { describe, it, expect, vi } from "vitest";
import { notifyApprovalEvent } from "../src/services/notifications/notifyApprovalEvent";
import type { ApprovalNotificationContext } from "../src/services/notifications/types";

const context: ApprovalNotificationContext = {
  approvalId: "appr_1",
  playbookId: "pb_1",
  merchantEmail: "merchant@example.com",
  triggerReason: "ceiling_breach",
  recommendedAction: { strategy: "retry", confidence: 0.7, expected_value: 5000 },
};

describe("notifyApprovalEvent — dispatches both channels from one approval event", () => {
  it("calls both the email sender and the Slack sender exactly once", async () => {
    const sendEmail = vi.fn(async () => {});
    const sendSlack = vi.fn(async () => {});

    const result = await notifyApprovalEvent(context, sendEmail, sendSlack);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(context);
    expect(sendSlack).toHaveBeenCalledTimes(1);
    expect(sendSlack).toHaveBeenCalledWith(context);
    expect(result).toEqual({ emailSent: true, slackSent: true });
  });

  it("still dispatches Slack when the email sender fails, and never throws", async () => {
    const sendEmail = vi.fn(async () => {
      throw new Error("SMTP down");
    });
    const sendSlack = vi.fn(async () => {});

    const result = await notifyApprovalEvent(context, sendEmail, sendSlack);

    expect(sendSlack).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ emailSent: false, slackSent: true });
  });

  it("still dispatches email when the Slack sender fails, and never throws", async () => {
    const sendEmail = vi.fn(async () => {});
    const sendSlack = vi.fn(async () => {
      throw new Error("Slack webhook 500");
    });

    const result = await notifyApprovalEvent(context, sendEmail, sendSlack);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ emailSent: true, slackSent: false });
  });

  it("resolves (does not throw) even when both channels fail", async () => {
    const sendEmail = vi.fn(async () => {
      throw new Error("SMTP down");
    });
    const sendSlack = vi.fn(async () => {
      throw new Error("Slack webhook 500");
    });

    await expect(notifyApprovalEvent(context, sendEmail, sendSlack)).resolves.toEqual({
      emailSent: false,
      slackSent: false,
    });
  });
});