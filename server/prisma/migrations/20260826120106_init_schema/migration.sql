-- CreateEnum
CREATE TYPE "RiskEventSourceType" AS ENUM ('subscription', 'payment', 'payment_link', 'settlement');

-- CreateEnum
CREATE TYPE "RiskEventStatus" AS ENUM ('open', 'resolved', 'ignored');

-- CreateEnum
CREATE TYPE "PlaybookStatus" AS ENUM ('generated', 'executing', 'escalated', 'awaiting_approval', 'closed');

-- CreateEnum
CREATE TYPE "RecoveryActionStrategy" AS ENUM ('retry', 'wait', 'payment_link', 'escalate', 'human_approval', 'ignore');

-- CreateEnum
CREATE TYPE "RecoveryActionOutcome" AS ENUM ('succeeded', 'failed', 'pending', 'skipped');

-- CreateEnum
CREATE TYPE "ApprovalTriggerReason" AS ENUM ('ceiling_breach', 'daily_cap_breach', 'low_confidence');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('pending', 'approved', 'rejected', 'modified');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('risk_event', 'playbook', 'recovery_action', 'approval');

-- CreateEnum
CREATE TYPE "PolicyModule" AS ENUM ('subscription', 'payment', 'payment_link', 'settlement');

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "razorpay_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_events" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "source_type" "RiskEventSourceType" NOT NULL,
    "root_cause" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "status" "RiskEventStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL,
    "risk_event_id" TEXT NOT NULL,
    "root_cause" TEXT NOT NULL,
    "recovery_probability" DECIMAL(5,4) NOT NULL,
    "recovery_value" DECIMAL(12,2) NOT NULL,
    "recommended_sequence" JSONB NOT NULL,
    "waiting_period_seconds" INTEGER NOT NULL,
    "stopping_rule" JSONB NOT NULL,
    "explainable_reasoning" TEXT NOT NULL,
    "chain_depth" INTEGER NOT NULL,
    "status" "PlaybookStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_actions" (
    "id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "strategy" "RecoveryActionStrategy" NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "expected_value" DECIMAL(12,2) NOT NULL,
    "outcome" "RecoveryActionOutcome" NOT NULL,
    "razorpay_reference_id" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "trigger_reason" "ApprovalTriggerReason" NOT NULL,
    "recommended_action" JSONB NOT NULL,
    "approver_email" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "modified_amount" DECIMAL(12,2),
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_ledger" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "entity_type" "AuditEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "event_description" TEXT NOT NULL,
    "previous_hash" TEXT,
    "entry_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_policies" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "module" "PolicyModule" NOT NULL,
    "ceiling_amount" DECIMAL(12,2) NOT NULL,
    "daily_cap" DECIMAL(12,2) NOT NULL,
    "min_confidence" DECIMAL(5,4) NOT NULL,
    "strategy_toggles" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchants_email_key" ON "merchants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_clerk_user_id_key" ON "merchants"("clerk_user_id");

-- CreateIndex
CREATE INDEX "risk_events_merchant_id_idx" ON "risk_events"("merchant_id");

-- CreateIndex
CREATE INDEX "risk_events_status_idx" ON "risk_events"("status");

-- CreateIndex
CREATE INDEX "risk_events_source_type_idx" ON "risk_events"("source_type");

-- CreateIndex
CREATE INDEX "playbooks_risk_event_id_idx" ON "playbooks"("risk_event_id");

-- CreateIndex
CREATE INDEX "playbooks_status_idx" ON "playbooks"("status");

-- CreateIndex
CREATE INDEX "recovery_actions_playbook_id_idx" ON "recovery_actions"("playbook_id");

-- CreateIndex
CREATE INDEX "recovery_actions_outcome_idx" ON "recovery_actions"("outcome");

-- CreateIndex
CREATE INDEX "approvals_playbook_id_idx" ON "approvals"("playbook_id");

-- CreateIndex
CREATE INDEX "approvals_decision_idx" ON "approvals"("decision");

-- CreateIndex
CREATE INDEX "audit_ledger_merchant_id_idx" ON "audit_ledger"("merchant_id");

-- CreateIndex
CREATE INDEX "audit_ledger_created_at_idx" ON "audit_ledger"("created_at");

-- CreateIndex
CREATE INDEX "audit_ledger_entity_type_idx" ON "audit_ledger"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_policies_merchant_id_module_key" ON "merchant_policies"("merchant_id", "module");

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_risk_event_id_fkey" FOREIGN KEY ("risk_event_id") REFERENCES "risk_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_actions" ADD CONSTRAINT "recovery_actions_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_ledger" ADD CONSTRAINT "audit_ledger_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_policies" ADD CONSTRAINT "merchant_policies_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
