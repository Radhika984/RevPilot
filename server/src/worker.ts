import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { startDecisionEngineWorkers } from "./workers/decisionEngine.worker";

/**
 * Standalone worker process for Phase 4 (Decision Engine). Runs
 * separately from the API server (src/index.ts) via `npm run worker`,
 * consuming the BullMQ queues that Phase 3's webhook routes enqueue
 * into. Keeping this as its own process means the API server's
 * request/response cycle is completely unaffected by Phase 4 —
 * Phase 1-3 behavior is unchanged.
 */
const workers = startDecisionEngineWorkers();
console.log("Decision Engine workers started: subscription, payment, payment-link");

async function shutdown() {
  console.log("Shutting down Decision Engine workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);