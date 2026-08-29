import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { startDecisionEngineWorkers } from "./workers/decisionEngine.worker";
import { startPlaybookEngineWorker } from "./workers/playbookEngine.worker";

/**
 * Standalone worker process for Phase 4 (Decision Engine) and Phase 5
 * (Adaptive Playbook Engine). Runs separately from the API server
 * (src/index.ts) via `npm run worker`. Phase 4 workers consume the
 * BullMQ queues that Phase 3's webhook routes enqueue into; the Phase 5
 * worker consumes the playbook-engine queue that Phase 4's worker
 * enqueues into once it creates a draft playbook. Keeping all of this
 * as its own process means the API server's request/response cycle is
 * completely unaffected — Phase 1-3 behavior is unchanged.
 */
const decisionEngineWorkers = startDecisionEngineWorkers();
const playbookEngineWorker = startPlaybookEngineWorker();
console.log("Decision Engine workers started: subscription, payment, payment-link");
console.log("Playbook Engine worker started: playbook-engine");

const workers = [...decisionEngineWorkers, playbookEngineWorker];

async function shutdown() {
  console.log("Shutting down Decision Engine + Playbook Engine workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);