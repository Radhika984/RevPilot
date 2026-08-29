import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { QUEUE_NAMES, playbookEngineQueue } from "../lib/queues";
import { prisma } from "../lib/prisma";
import { buildDecision, buildPlaybookCreateData } from "../services/decision-engine/engine";
import { DecisionEngineInput } from "../services/decision-engine/types";

/**
 * Processes exactly one Phase 3 webhook job: load the risk_events row it
 * refers to, run it through the deterministic Decision Engine, and
 * persist the result as a draft (status: "generated") playbooks row.
 *
 * Idempotency: if a playbook already exists for this risk_event_id
 * (e.g. BullMQ redelivered the job after a crash/timeout), no second
 * playbook is created — this handler is safe to run more than once for
 * the same risk event.
 */
async function processRiskEventJob(job: Job): Promise<void> {
  const { riskEventId } = job.data as { riskEventId?: string };

  if (!riskEventId) {
    console.warn(`Job ${job.id} on queue ${job.queueName} has no riskEventId — skipping`);
    return;
  }

  const riskEvent = await prisma.riskEvent.findUnique({ where: { id: riskEventId } });
  if (!riskEvent) {
    console.warn(`riskEventId=${riskEventId} not found — skipping decision engine run`);
    return;
  }

  const existingPlaybook = await prisma.playbook.findFirst({
    where: { risk_event_id: riskEvent.id },
  });
  if (existingPlaybook) {
    console.log(`Playbook already exists for risk_event_id=${riskEvent.id} — skipping`);
    return;
  }

  const engineInput: DecisionEngineInput = {
    sourceType: riskEvent.source_type,
    eventName: riskEvent.root_cause,
    amount: Number(riskEvent.amount),
    rawPayload: riskEvent.raw_payload,
  };

  const decision = buildDecision(engineInput);
  const playbookData = buildPlaybookCreateData(riskEvent.id, decision);

  let playbook;
  try {
    playbook = await prisma.playbook.create({ data: playbookData });
    console.log(
      `Created draft playbook ${playbook.id} for risk_event_id=${riskEvent.id} ` +
        `(root_cause=${playbook.root_cause}, status=${playbook.status})`
    );
  } catch (err) {
    console.error(`Failed to create playbook for risk_event_id=${riskEvent.id}:`, err);
    throw err; // let BullMQ retry the job
  }

  // Phase 5: hand the freshly created draft playbook off to the
  // Adaptive Playbook Engine worker. jobId: playbook.id makes this
  // enqueue idempotent at the BullMQ level too (same pattern as the
  // Phase 3 -> Phase 4 enqueue in webhooks.razorpay.ts).
  //
  // Failure to enqueue must NOT throw here: the Phase 4 playbook row was
  // already committed successfully, so rethrowing would cause BullMQ to
  // retry this whole job and re-run Phase 4 logic (harmless thanks to
  // the existingPlaybook guard above, but pointless and noisy) instead
  // of just retrying the Phase 5 handoff.
  try {
    await playbookEngineQueue.add(
      "run-waterfall",
      { playbookId: playbook.id },
      { jobId: playbook.id }
    );
  } catch (err) {
    console.error(`Failed to enqueue Phase 5 waterfall job for playbookId=${playbook.id}:`, err);
  }
}

/**
 * One Worker per Phase 3 queue, all sharing the single Redis connection
 * from ../lib/redis (same singleton the API process's Queue producers
 * use — no new connections are created here).
 */
export function startDecisionEngineWorkers(): Worker[] {
  const workers = [
    new Worker(QUEUE_NAMES.subscription, processRiskEventJob, { connection: redisConnection }),
    new Worker(QUEUE_NAMES.payment, processRiskEventJob, { connection: redisConnection }),
    new Worker(QUEUE_NAMES.paymentLink, processRiskEventJob, { connection: redisConnection }),
  ];

  for (const worker of workers) {
    worker.on("completed", (job) => {
      console.log(`[${worker.name}] job ${job.id} completed`);
    });
    worker.on("failed", (job, err) => {
      console.error(`[${worker.name}] job ${job?.id} failed:`, err);
    });
  }

  return workers;
}