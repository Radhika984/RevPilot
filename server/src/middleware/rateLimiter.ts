import rateLimit from "express-rate-limit";

/**
 * Phase 12 hardening: rate limiting, applied only where the app
 * genuinely has unauthenticated or otherwise abuse-prone surface area.
 * No existing route's behavior changes when under the limit — these
 * middlewares only add a 429 response once a client exceeds it.
 *
 * Both limiters key by IP (express-rate-limit's default), which is the
 * right key here: the webhook endpoints have no concept of a caller
 * identity at all (that's the whole reason they're webhooks), and the
 * general API limiter exists as a baseline abuse guard rather than a
 * precise per-merchant quota — Clerk-authenticated users legitimately
 * share IPs (office/NAT), so this is intentionally generous.
 */

/**
 * POST /api/webhooks/* (Clerk + Razorpay) has no session/auth of any
 * kind by design — signature verification is the only gate. That makes
 * it the app's most exposed endpoint, and the cheapest one to flood
 * with garbage requests before signature verification even runs. Real
 * traffic here is one delivery per event per provider, so this ceiling
 * is intentionally strict relative to the general API limiter.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhook requests, please try again shortly" },
});

/**
 * Everything under /api/* other than /api/webhooks/*. Every route here
 * already requires a valid Clerk session, so this is a coarse baseline
 * guard against a compromised/misbehaving client hammering the API,
 * not a precise per-merchant quota. Sized well above the client's own
 * polling load: every hook in client/src/hooks/*.ts uses a 30s
 * staleTime / 60s refetchInterval, so even several dashboard tabs open
 * at once stay far under this ceiling.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
});