/**
 * Formatting helpers for the Revenue War Room. Kept framework-free and
 * side-effect-free so they're trivial to unit test later.
 */

// RevPilot's amounts come from Razorpay (INR, converted from paise to
// rupees at ingestion — see server/src/routes/webhooks.razorpay.ts),
// so INR is the correct currency for every merchant in this system.
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—";
  }
  return currencyFormatter.format(amount);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
});

/** Formats a "YYYY-MM-DD" bucket key (e.g. from GET /api/analytics/recovery-rate's timeline) as "12 Aug". */
export function formatShortDate(dateKey: string | null | undefined): string {
  if (!dateKey) return "—";
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return shortDateFormatter.format(date);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function titleCase(value: string): string {
  return value
    .replace(/[._]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSourceType(sourceType: string | null | undefined): string {
  if (!sourceType) return "—";
  return titleCase(sourceType);
}

export function formatRootCause(rootCause: string | null | undefined): string {
  if (!rootCause) return "—";
  return titleCase(rootCause);
}

export function formatStrategy(strategy: string | null | undefined): string {
  if (!strategy) return "—";
  return titleCase(strategy);
}
export function formatPlaybookStatus(
  status: string | null | undefined,
): string {
  if (!status) return "—";
  return titleCase(status);
}

export function formatOutcome(
  outcome: string | null | undefined,
): string {
  if (!outcome) return "—";
  return titleCase(outcome);
}

export function formatApprovalDecision(
  decision: string | null | undefined,
): string {
  if (!decision) return "—";
  return titleCase(decision);
}

export function formatTriggerReason(
  triggerReason: string | null | undefined,
): string {
  if (!triggerReason) return "—";
  return titleCase(triggerReason);
}

export function formatEntityType(
  entityType: string | null | undefined,
): string {
  if (!entityType) return "—";
  return titleCase(entityType);
}

/**
 * Truncates a long hash/hex string for compact monospace display
 * (Audit Ledger table cells), e.g. "a1b2c3d4e5f6...9f8e7d". Returns
 * the value unchanged if it's already short enough, and "—" for
 * null/empty (the AuditLedger schema allows previous_hash/entry_hash
 * to be null).
 */
export function formatHash(
  hash: string | null | undefined,
  visibleChars = 8,
): string {
  if (!hash) return "—";
  if (hash.length <= visibleChars * 2 + 1) return hash;
  return `${hash.slice(0, visibleChars)}…${hash.slice(-visibleChars)}`;
}