/**
 * Phase 12 — deterministic demo-data seed script.
 *
 * Populates ONE demo merchant with a full, realistic, end-to-end data
 * set covering every screen in the client and every status/outcome the
 * existing schema supports — WITHOUT any manual DB intervention and
 * WITHOUT any live network calls (no real Razorpay Test Mode HTTP
 * calls, no real Groq/SMTP/Slack calls). It does this by reusing the
 * exact existing, already-tested production code paths:
 *
 *   - services/decision-engine/engine.ts (buildDecision, buildPlaybookCreateData)
 *     — same deterministic scoring workers/decisionEngine.worker.ts uses.
 *   - services/policy-engine/policyGate.ts (runPlaybookWithPolicyGate)
 *     — same entry point workers/playbookEngine.worker.ts uses, which
 *     itself calls the untouched services/playbook-engine/chainEngine.ts
 *     waterfall + services/playbook-engine/circuitBreaker.ts.
 *
 * The only thing this script substitutes is the `executor` — chainEngine
 * already accepts an injectable StepExecutor for exactly this reason
 * (deterministic tests / no network access). A small scripted executor
 * below returns a fixed outcome per (riskEventId, strategy) pair, so
 * every scenario's result is 100% deterministic and reproducible.
 *
 * No schema changes. No new tables. No modification to any existing
 * service. Safe to re-run any number of times: it clears out only this
 * demo merchant's previously-seeded rows before recreating them.
 *
 * Required env var:
 *   DEMO_CLERK_USER_ID   — a real Clerk user id (from your Clerk
 *                          dashboard / whatever account you'll sign in
 *                          with for the demo) so the seeded merchant is
 *                          the one you land on after signing in.
 *
 * Optional env vars (sensible demo defaults if omitted):
 *   DEMO_MERCHANT_EMAIL, DEMO_BUSINESS_NAME, DEMO_RAZORPAY_ACCOUNT_ID
 *
 * Run with:  npm run seed:demo   (see server/package.json)
 */

import crypto from "crypto";
import { PolicyModule, Prisma, RiskEventSourceType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { buildDecision, buildPlaybookCreateData } from "../src/services/decision-engine/engine";
import { DecisionEngineInput } from "../src/services/decision-engine/types";
import { runPlaybookWithPolicyGate } from "../src/services/policy-engine/policyGate";
import { resetAllCircuitBreakers } from "../src/services/playbook-engine/circuitBreaker";
import {
  StepExecutionResult,
  StepExecutor,
  StepExecutorContext,
  StepOutcome,
  WaterfallStrategy,
} from "../src/services/playbook-engine/types";

// ============================================================
// Config
// ============================================================

const DEMO_CLERK_USER_ID = process.env.DEMO_CLERK_USER_ID;
const DEMO_MERCHANT_EMAIL = process.env.DEMO_MERCHANT_EMAIL || "demo@revpilot.dev";
const DEMO_BUSINESS_NAME = process.env.DEMO_BUSINESS_NAME || "RevPilot Demo Merchant";
const DEMO_RAZORPAY_ACCOUNT_ID = process.env.DEMO_RAZORPAY_ACCOUNT_ID || "acc_demo_revpilot";

if (!DEMO_CLERK_USER_ID) {
  console.error(
    "\nDEMO_CLERK_USER_ID is not set.\n" +
      "Sign in to the RevPilot client once with the Clerk account you'll demo with, " +
      "copy that account's Clerk user id (Clerk Dashboard -> Users), and re-run:\n\n" +
      "  DEMO_CLERK_USER_ID=user_xxxxxxxx npm run seed:demo\n"
  );
  process.exit(1);
}

// Re-bound as a plain `string`: TypeScript's control-flow narrowing above
// does not carry into the separate `main()` function body below (a
// captured outer `const` isn't narrowed across function boundaries),
// so `main()` closes over this guaranteed-defined constant instead.
const clerkUserId: string = DEMO_CLERK_USER_ID;

const NOW = new Date();
/** Hours-ago helper for spreading demo events realistically over time. */
function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}
function secondsAfter(base: Date, s: number): Date {
  return new Date(base.getTime() + s * 1000);
}

function hash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ============================================================
// Scripted, deterministic step executor
//
// Mirrors strategyExecutors.ts's shape exactly (StepExecutor), but
// looks up a fixed outcome per (riskEventId, strategy) instead of
// calling Razorpay. Any (riskEventId, strategy) pair not explicitly
// scripted below defaults to "failed" — a safe, deterministic default,
// never "succeeded" by accident.
// ============================================================

const SCRIPTED_OUTCOMES = new Map<string, Partial<Record<WaterfallStrategy, StepOutcome>>>();

function scriptOutcome(riskEventId: string, strategy: WaterfallStrategy, outcome: StepOutcome): void {
  const existing = SCRIPTED_OUTCOMES.get(riskEventId) ?? {};
  existing[strategy] = outcome;
  SCRIPTED_OUTCOMES.set(riskEventId, existing);
}

const demoExecutor: StepExecutor = async (
  strategy: WaterfallStrategy,
  context: StepExecutorContext
): Promise<StepExecutionResult> => {
  const outcome = SCRIPTED_OUTCOMES.get(context.riskEventId)?.[strategy] ?? "failed";
  return {
    outcome,
    razorpay_reference_id:
      outcome === "succeeded"
        ? `demo_${strategy}_${context.riskEventId.slice(0, 8)}`
        : "unavailable",
  };
};

// ============================================================
// Audit ledger: nothing in the current codebase writes audit_ledger
// rows yet (routes/audit.ts is read-only, per its own Phase 10 notes).
// This script is the demo's only source of audit_ledger data, built as
// a genuine hash chain so GET /api/audit/verify has something real to
// verify against previous_hash/entry_hash linkage.
// ============================================================

type AuditEntityType = "risk_event" | "playbook" | "recovery_action" | "approval";

let auditChainTip: string | null = null;
let auditClock = hoursAgo(30); // ledger entries start ~30h ago, advance forward from there

async function appendAudit(
  merchantId: string,
  entityType: AuditEntityType,
  entityId: string,
  description: string
): Promise<void> {
  auditClock = secondsAfter(auditClock, 5);
  const entryHash = hash(`${auditChainTip ?? ""}:${entityType}:${entityId}:${description}`);
  await prisma.auditLedger.create({
    data: {
      merchant_id: merchantId,
      entity_type: entityType,
      entity_id: entityId,
      event_description: description,
      previous_hash: auditChainTip,
      entry_hash: entryHash,
      created_at: auditClock,
    },
  });
  auditChainTip = entryHash;
}

// ============================================================
// Risk-event payload builders — shaped exactly like the real Razorpay
// webhook bodies services/decision-engine/rootCause.ts and
// routes/webhooks.razorpay.ts already parse (payload.<entity>.entity.*),
// so buildDecision() classifies these precisely the way a live webhook
// would.
// ============================================================

interface ScenarioDef {
  key: string;
  label: string;
  sourceType: RiskEventSourceType;
  eventName: string; // raw Razorpay event name -> becomes RiskEvent.root_cause, same as webhooks.razorpay.ts
  errorReason?: string; // set on payload.payment.entity.error_reason when present
  amountRupees: number;
  createdHoursAgo: number;
  /** Per-strategy scripted outcome for the chain engine; omitted scenarios are never run through the policy gate at all (left "generated"). */
  runThroughPolicyGate: boolean;
}

const SCENARIOS: ScenarioDef[] = [
  {
    key: "card_expiry_recovered",
    label: "Card Expiry Waterfall — recovered via payment link",
    sourceType: RiskEventSourceType.payment,
    eventName: "payment.failed",
    errorReason: "expired_card",
    amountRupees: 4999,
    createdHoursAgo: 27,
    runThroughPolicyGate: true,
  },
  {
    key: "card_expiry_escalated",
    label: "Card Expiry Waterfall — payment link + retry both fail, escalated",
    sourceType: RiskEventSourceType.payment,
    eventName: "payment.failed",
    errorReason: "expired_card",
    amountRupees: 2499,
    createdHoursAgo: 24,
    runThroughPolicyGate: true,
  },
  {
    key: "breaker_1",
    label: "Circuit breaker simulation — step 1/3, both strategies fail",
    sourceType: RiskEventSourceType.subscription,
    eventName: "subscription.halted",
    amountRupees: 2000,
    createdHoursAgo: 21,
    runThroughPolicyGate: true,
  },
  {
    key: "breaker_2",
    label: "Circuit breaker simulation — step 2/3, breaker trips mid-chain",
    sourceType: RiskEventSourceType.subscription,
    eventName: "subscription.halted",
    amountRupees: 1800,
    createdHoursAgo: 18,
    runThroughPolicyGate: true,
  },
  {
    key: "breaker_3",
    label: "Circuit breaker simulation — step 3/3, breaker already open, zero attempts",
    sourceType: RiskEventSourceType.subscription,
    eventName: "subscription.halted",
    amountRupees: 1500,
    createdHoursAgo: 15,
    runThroughPolicyGate: true,
  },
  {
    key: "low_confidence",
    label: "Policy breach — low confidence, held for approval",
    sourceType: RiskEventSourceType.payment_link,
    eventName: "payment_link.expired",
    amountRupees: 1200,
    createdHoursAgo: 12,
    runThroughPolicyGate: true,
  },
  {
    key: "ceiling_breach",
    label: "Policy breach — execution ceiling, held for approval",
    sourceType: RiskEventSourceType.payment_link,
    eventName: "payment_link.expired",
    amountRupees: 50000,
    createdHoursAgo: 9,
    runThroughPolicyGate: true,
  },
  {
    key: "settlement_unconfigured",
    label: "No policy configured for module — fails safe, held for approval",
    sourceType: RiskEventSourceType.settlement,
    eventName: "settlement.failed",
    amountRupees: 8000,
    createdHoursAgo: 6,
    runThroughPolicyGate: true,
  },
  {
    key: "ready_to_run",
    label: "Freshly generated playbook, not yet picked up by the worker",
    sourceType: RiskEventSourceType.subscription,
    eventName: "subscription.pending",
    amountRupees: 3200,
    createdHoursAgo: 2,
    runThroughPolicyGate: false,
  },
];

function buildRawPayload(scenario: ScenarioDef, riskEventIndex: number): Record<string, unknown> {
  const amountPaise = Math.round(scenario.amountRupees * 100);
  const base = {
    event: scenario.eventName,
    account_id: DEMO_RAZORPAY_ACCOUNT_ID,
  };

  switch (scenario.sourceType) {
    case RiskEventSourceType.payment:
      return {
        ...base,
        payload: {
          payment: {
            entity: {
              id: `pay_demo_${riskEventIndex}`,
              amount: amountPaise,
              currency: "INR",
              status: "failed",
              ...(scenario.errorReason ? { error_reason: scenario.errorReason } : {}),
            },
          },
        },
      };
    case RiskEventSourceType.subscription:
      return {
        ...base,
        payload: {
          subscription: {
            entity: {
              id: `sub_demo_${riskEventIndex}`,
              amount: amountPaise,
              status: scenario.eventName === "subscription.pending" ? "pending" : "halted",
            },
          },
        },
      };
    case RiskEventSourceType.payment_link:
      return {
        ...base,
        payload: {
          payment_link: {
            entity: {
              id: `plink_demo_${riskEventIndex}`,
              amount: amountPaise,
              status: "expired",
            },
          },
        },
      };
    case RiskEventSourceType.settlement:
    default:
      return {
        ...base,
        payload: {
          settlement: {
            entity: {
              id: `setl_demo_${riskEventIndex}`,
              amount: amountPaise,
              status: "failed",
            },
          },
        },
      };
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log(`Seeding demo data for clerk_user_id=${clerkUserId} ...`);

  // Every waterfall/circuit-breaker outcome below must be driven purely
  // by this script's own scenario sequence, not by leftover in-memory
  // breaker state from anything else that happened to run earlier in
  // this same Node process.
  resetAllCircuitBreakers();

  // ---- Merchant (idempotent: upsert, never duplicated) ----
  const merchant = await prisma.merchant.upsert({
    where: { clerk_user_id: clerkUserId },
    update: {
      email: DEMO_MERCHANT_EMAIL,
      business_name: DEMO_BUSINESS_NAME,
      razorpay_account_id: DEMO_RAZORPAY_ACCOUNT_ID,
    },
    create: {
      clerk_user_id: clerkUserId,
      email: DEMO_MERCHANT_EMAIL,
      business_name: DEMO_BUSINESS_NAME,
      razorpay_account_id: DEMO_RAZORPAY_ACCOUNT_ID,
    },
  });

  // ---- Clear this merchant's previously-seeded rows (idempotent re-run), children first ----
  await prisma.recoveryAction.deleteMany({
    where: { playbook: { risk_event: { merchant_id: merchant.id } } },
  });
  await prisma.approval.deleteMany({
    where: { playbook: { risk_event: { merchant_id: merchant.id } } },
  });
  await prisma.auditLedger.deleteMany({ where: { merchant_id: merchant.id } });
  await prisma.playbook.deleteMany({ where: { risk_event: { merchant_id: merchant.id } } });
  await prisma.riskEvent.deleteMany({ where: { merchant_id: merchant.id } });
  await prisma.merchantPolicy.deleteMany({ where: { merchant_id: merchant.id } });

  // ---- Merchant policies ----
  // "settlement" is deliberately left unconfigured, to demonstrate
  // policyGate.ts's fail-safe "no_policy_configured" path for real.
  const defaultToggles = {
    retry: true,
    wait: true,
    payment_link: true,
    escalate: true,
    human_approval: true,
    ignore: true,
  };

  const policyRows: Array<{
    module: PolicyModule;
    ceiling_amount: number;
    daily_cap: number;
    min_confidence: number;
  }> = [
    { module: PolicyModule.subscription, ceiling_amount: 5000, daily_cap: 20000, min_confidence: 0.05 },
    { module: PolicyModule.payment, ceiling_amount: 3000, daily_cap: 15000, min_confidence: 0.1 },
    { module: PolicyModule.payment_link, ceiling_amount: 2000, daily_cap: 10000, min_confidence: 0.65 },
  ];

  for (const row of policyRows) {
    await prisma.merchantPolicy.create({
      data: {
        merchant_id: merchant.id,
        module: row.module,
        ceiling_amount: row.ceiling_amount,
        daily_cap: row.daily_cap,
        min_confidence: row.min_confidence,
        strategy_toggles: defaultToggles,
      },
    });
  }

  // ---- Risk events -> Decision Engine -> (Policy Gate -> Waterfall) ----
  let index = 0;
  for (const scenario of SCENARIOS) {
    index += 1;
    const createdAt = hoursAgo(scenario.createdHoursAgo);
    const rawPayload = buildRawPayload(scenario, index);
    const rawPayloadHash = hash(JSON.stringify(rawPayload));

    const riskEvent = await prisma.riskEvent.create({
      data: {
        merchant_id: merchant.id,
        source_type: scenario.sourceType,
        root_cause: scenario.eventName, // raw event name, exactly as webhooks.razorpay.ts stores it
        amount: scenario.amountRupees,
        raw_payload: rawPayload as Prisma.InputJsonValue,
        raw_payload_hash: rawPayloadHash,
        status: "open", // matches production: nothing in the app ever transitions this today
        created_at: createdAt,
      },
    });
    await appendAudit(
      merchant.id,
      "risk_event",
      riskEvent.id,
      `Risk event ingested: ${scenario.sourceType} / ${scenario.eventName} (₹${scenario.amountRupees})`
    );

    // Same Decision Engine call workers/decisionEngine.worker.ts makes.
    const engineInput: DecisionEngineInput = {
      sourceType: riskEvent.source_type,
      eventName: riskEvent.root_cause,
      amount: Number(riskEvent.amount),
      rawPayload: riskEvent.raw_payload,
    };
    const decision = buildDecision(engineInput);
    const playbookData = buildPlaybookCreateData(riskEvent.id, decision);
    const playbook = await prisma.playbook.create({
      data: { ...playbookData, created_at: secondsAfter(createdAt, 30) },
    });
    await appendAudit(
      merchant.id,
      "playbook",
      playbook.id,
      `Playbook generated: root_cause=${playbook.root_cause}, top strategy=${decision.strategies[0].strategy} — ${scenario.label}`
    );

    if (!scenario.runThroughPolicyGate) {
      console.log(`  [${scenario.key}] left as "generated" — not yet handed to a worker.`);
      continue;
    }

    // Script this scenario's outcomes for whichever strategy lands in
    // which waterfall position (positions are decided by the real,
    // already-ranked recommended_sequence — this script does not
    // reorder or hardcode which strategy runs first).
    const [first, second] = decision.strategies;
    switch (scenario.key) {
      case "card_expiry_recovered":
        scriptOutcome(riskEvent.id, first.strategy, "succeeded");
        break;
      case "card_expiry_escalated":
        scriptOutcome(riskEvent.id, first.strategy, "failed");
        if (second) scriptOutcome(riskEvent.id, second.strategy, "failed");
        break;
      case "breaker_1":
        scriptOutcome(riskEvent.id, first.strategy, "failed");
        if (second) scriptOutcome(riskEvent.id, second.strategy, "failed");
        break;
      case "breaker_2":
        // Only the first step ever actually runs — the breaker trips
        // on this failure and chainEngine.ts stops immediately, before
        // a second step is ever attempted.
        scriptOutcome(riskEvent.id, first.strategy, "failed");
        break;
      case "breaker_3":
        // Breaker is already open when this one starts — chainEngine.ts
        // won't call the executor at all, so nothing to script.
        break;
      default:
        // low_confidence / ceiling_breach / settlement_unconfigured never
        // reach chainEngine.ts — the policy gate holds them for approval
        // before any strategy is ever attempted.
        break;
    }

    const gateResult = await runPlaybookWithPolicyGate(playbook.id, demoExecutor);
    console.log(
      `  [${scenario.key}] policy gate outcome=${gateResult?.outcome ?? "none"}` +
        (gateResult?.breachReason ? ` (${gateResult.breachReason})` : "")
    );

    if (gateResult?.approvalId) {
      const approval = await prisma.approval.findUnique({ where: { id: gateResult.approvalId } });
      if (approval) {
        await appendAudit(
          merchant.id,
          "approval",
          approval.id,
          `Approval required (${approval.trigger_reason}): ${scenario.label}`
        );
      }
    }

    const executedActions = await prisma.recoveryAction.findMany({
      where: { playbook_id: playbook.id },
      orderBy: { step_number: "asc" },
    });
    for (const action of executedActions) {
      await appendAudit(
        merchant.id,
        "recovery_action",
        action.id,
        `Recovery step ${action.step_number} (${action.strategy}) outcome=${action.outcome}`
      );
    }
  }

  console.log("\nDemo data seeded successfully.");
  console.log(`Sign in as clerk_user_id=${clerkUserId} to see it in the client.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Demo seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });