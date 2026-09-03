/**
 * Shared visual tone helpers for playbook-status and recovery-action-
 * outcome badges. Both the Recovery Queue table and the Playbook
 * Timeline need to color the same status/outcome values consistently,
 * so the mapping lives here once rather than being duplicated.
 *
 * Tone names and their class values intentionally mirror
 * components/revenue/MetricCard.tsx's `toneStyles`, so a given tone
 * always reads the same color anywhere in the app.
 */

export type BadgeTone = "neutral" | "risk" | "positive" | "info" | "destructive" | "brand";

/**
 * Phase 12: each tone now pairs its tint with a matching 1px inset ring
 * so pills read as distinct, deliberate chips rather than flat blocks
 * of tinted background — this is what makes adjacent statuses (e.g. a
 * "risk" row next to a "positive" one) stop blending together at a
 * glance. Hue choices are unchanged (amber/emerald/blue/red); "brand"
 * is new, for surfaces that want the indigo primary rather than a
 * risk/outcome color (e.g. MetricCard's "pending approvals" card).
 */
const toneClassNames: Record<BadgeTone, string> = {
  neutral: "bg-muted text-foreground ring-1 ring-inset ring-border",
  risk: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20",
  positive:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20",
  destructive: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
  brand: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-400/20",
};

/** Class name for a small rounded status pill using the given tone. */
export function badgeClassName(tone: BadgeTone): string {
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${toneClassNames[tone]}`;
}

/** Class name for a filled circular icon dot (timeline nodes) using the given tone. */
export function dotClassName(tone: BadgeTone): string {
  return `flex size-9 shrink-0 items-center justify-center rounded-full ${toneClassNames[tone]}`;
}

/** Maps a Playbook.status value (schema.prisma PlaybookStatus) to a badge tone. */
export function playbookStatusTone(status: string): BadgeTone {
  switch (status) {
    case "closed":
      return "positive";
    case "escalated":
      return "destructive";
    case "awaiting_approval":
      return "risk";
    case "executing":
      return "info";
    case "generated":
    default:
      return "neutral";
  }
}

/** Maps a RecoveryAction.outcome value (schema.prisma RecoveryActionOutcome) to a badge tone. */
export function recoveryOutcomeTone(outcome: string): BadgeTone {
  switch (outcome) {
    case "succeeded":
      return "positive";
    case "failed":
      return "destructive";
    case "pending":
      return "risk";
    case "skipped":
    default:
      return "neutral";
  }
}

/** Maps an Approval.decision value (schema.prisma ApprovalDecision) to a badge tone. */
export function approvalDecisionTone(decision: string): BadgeTone {
  switch (decision) {
    case "approved":
      return "positive";
    case "rejected":
      return "destructive";
    case "modified":
      return "info";
    case "pending":
    default:
      return "risk";
  }
}