import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express, { Request, Response } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import clerkWebhookRouter from "./routes/webhooks.clerk";
import razorpayWebhookRouter from "./routes/webhooks.razorpay";
import meRouter from "./routes/me";
import playbooksRouter from "./routes/playbooks";
import riskEventsRouter from "./routes/riskEvents";
import approvalsRouter from "./routes/approvals";
import revenueRouter from "./routes/revenue";
import auditRouter from "./routes/audit";
import policiesRouter from "./routes/policies";
import analyticsRouter from "./routes/analytics";
import { apiLimiter, webhookLimiter } from "./middleware/rateLimiter";

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// --- Public infrastructure health check (no auth, no Clerk) ---
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// --- Clerk webhook + Razorpay webhooks: MUST come before express.json()
//     and MUST NOT have clerkMiddleware()/requireAuth() applied.
//     Both verifyWebhook() (Clerk/Svix) and the Razorpay HMAC check need
//     the raw, unparsed body to verify their respective signatures.
//     express.raw() is applied once for the whole /api/webhooks prefix;
//     each router below only declares the specific sub-paths it owns, and
//     an Express Router automatically falls through to the next mounted
//     router when a path doesn't match one of its own routes — so mounting
//     both routers on the same prefix is safe and does not affect the
//     already-working Clerk webhook route. ---
app.use(
  "/api/webhooks",
  webhookLimiter,
  express.raw({ type: "application/json" }),
  clerkWebhookRouter
);
app.use("/api/webhooks", webhookLimiter, razorpayWebhookRouter);

// --- Everything below this line gets JSON parsing + Clerk session
//     detection. clerkMiddleware() only attaches req.auth; it does
//     NOT reject unauthenticated requests by itself — routes opt in
//     via requireAuth(), so future protected routes inherit this
//     automatically without needing per-route wiring. ---
app.use(express.json());
app.use(clerkMiddleware());

// Phase 12: coarse baseline rate limiting for every authenticated
// /api/* route below (the two webhook routers above already have
// their own, stricter limiter and are never reached by this one).
app.use("/api", apiLimiter);

app.use("/api", meRouter);
// Phase 5: read-only playbook + risk-event APIs, same auth pattern as
// meRouter (getAuth() + manual 401 JSON, merchant-scoped queries).
app.use("/api", playbooksRouter);
app.use("/api", riskEventsRouter);
// Phase 6: approval routing APIs, same auth pattern as the above.
app.use("/api", approvalsRouter);
// Phase 8: merchant-scoped revenue aggregation APIs for the Revenue
// War Room, same auth pattern as the above.
app.use("/api", revenueRouter);
// Phase 10: read-only audit ledger listing + hash-chain verification
// APIs, same auth pattern as the above.
app.use("/api", auditRouter);
// Phase 11: merchant policy CRUD (read by services/policy-engine/
// policyGate.ts on every run, no caching) and read-only recovery
// analytics APIs, same auth pattern as the above.
app.use("/api", policiesRouter);
app.use("/api", analyticsRouter);

// --- Only bind a listener when this file is executed directly (e.g.
//     `ts-node-dev src/index.ts`, `node dist/index.js`). When the app is
//     imported instead (e.g. by Vitest/supertest in the test suite), we
//     must NOT call app.listen() again — the real dev server may already
//     be bound to PORT, and tests talk to the app in-memory via supertest,
//     which doesn't need a listening socket at all. ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;