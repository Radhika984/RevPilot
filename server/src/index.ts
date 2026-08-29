import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express, { Request, Response } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import clerkWebhookRouter from "./routes/webhooks.clerk";
import razorpayWebhookRouter from "./routes/webhooks.razorpay";
import meRouter from "./routes/me";

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
  express.raw({ type: "application/json" }),
  clerkWebhookRouter
);
app.use("/api/webhooks", razorpayWebhookRouter);

// --- Everything below this line gets JSON parsing + Clerk session
//     detection. clerkMiddleware() only attaches req.auth; it does
//     NOT reject unauthenticated requests by itself — routes opt in
//     via requireAuth(), so future protected routes inherit this
//     automatically without needing per-route wiring. ---
app.use(express.json());
app.use(clerkMiddleware());

app.use("/api", meRouter);

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