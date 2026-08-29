import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { QUEUE_NAMES } from "../lib/queues";
import { runPlaybookWaterfall } from "../services/playbook-engine/chainEngine";

/**
 * Processes exactly one Phase 5 job: run the Adaptive Playbook Engine
 * waterfall for a single playbookId (enqueued by
 * workers/decisionEngine.worker.ts right after it creates the draft
 * playbook). Idempotency for redelivered jobs is handled inside
 * runPlaybookWaterfall (skips if recovery_actions already exist).
 */
async function processPlaybookJob(job: Job): Promise<void> {
  const { playbookId } = job.data as { playbookId?: string };

  if (!playbookId) {
    console.warn(`Job ${job.id} on queue ${job.queueName} has no playbookId — skipping`);
    return;
  }

  try {
    const result = await runPlaybookWaterfall({ playbookId });
    if (result) {
      console.log(
        `Playbook ${playbookId} waterfall finished: stopReason=${result.stopReason}, ` +
          `finalStatus=${result.finalStatus}, steps=${result.steps.length}`
      );
    }
  } catch (err) {
    console.error(`Failed to run waterfall for playbookId=${playbookId}:`, err);
    throw err; // let BullMQ retry the job
  }
}

/**
 * Single Worker for the Phase 5 playbook-engine queue, sharing the same
 * Redis connection singleton as every other Worker/Queue in this
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