/**
 * Shared types for the Phase 7 notification dispatch layer.
 */

export interface ApprovalNotificationContext {
  approvalId: string;
  playbookId: string;
  merchantEmail: string;
  triggerReason: string;
  recommendedAction: unknown;
}

export interface NotificationDispatchResult {
  emailSent: boolean;
  slackSent: boolean;
}