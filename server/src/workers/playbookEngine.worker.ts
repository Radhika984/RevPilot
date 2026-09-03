import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { QUEUE_NAMES } from "../lib/queues";
import { runPlaybookWithPolicyGate } from "../services/policy-engine/policyGate";

/**
 * Processes exactly one job: run the Phase 6 policy gate for a single
 * playbookId (enqueued by workers/decisionEngine.worker.ts right after
 * it creates the draft playbook). The policy gate either hands off to
 * the untouched Phase 5 waterfall (chainEngine.runPlaybookWaterfall) or
 * creates a pending approval instead — see
 * services/policy-engine/policyGate.ts.
 *
 * Idempotency for redelivered jobs is handled inside
 * runPlaybookWithPolicyGate (skips if recovery_actions or an approval
 * already exist for this playbook).
 */
async function processPlaybookJob(job: Job): Promise<void> {
  const { playbookId } = job.data as { playbookId?: string };

  if (!playbookId) {
    console.warn(`Job ${job.id} on queue ${job.queueName} has no playbookId — skipping`);
    return;
  }

  try {
    const result = await runPlaybookWithPolicyGate(playbookId);
    if (result) {
      console.log(
        `Playbook ${playbookId} policy gate result: outcome=${result.outcome}` +
          (result.breachReason ? `, breachReason=${result.breachReason}` : "") +
          (result.approvalId ? `, approvalId=${result.approvalId}` : "")
      );
    }
  } catch (err) {
    console.error(`Failed to run policy-gated waterfall for playbookId=${playbookId}:`, err);
    throw err; // let BullMQ retry the job
  }
}

/**
 * Single Worker for the Phase 5/6 playbook-engine queue, sharing the
 * same Redis connection singleton as every other Worker/Queue in this
 * codebase (../lib/redis).
 */
export function startPlaybookEngineWorker(): Worker {
  const worker = new Worker(QUEUE_NAMES.playbookEngine, processPlaybookJob, {
    connection: redisConnection,
  });

  worker.on("completed", (job) => {
    console.log(`[${worker.name}] job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] job ${job?.id} failed:`, err);
  });

  return worker;
}