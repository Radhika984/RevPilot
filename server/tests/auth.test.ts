import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index";

describe("GET /api/me — Clerk authentication gate", () => {
  it("rejects requests with no credentials with 401", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a malformed/garbage bearer token with 401", async () => {
    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer not-a-real-clerk-token");
    expect(res.status).toBe(401);
  });

  /**
   * NOT INCLUDED: an automated "valid token -> 200" test.
   *
   * Producing a genuinely valid, Clerk-signed session token requires a
   * live Clerk application (real publishable/secret keys) plus either
   * @clerk/testing's Testing Token flow or the session-token-from-
   * Backend-API flow — both need a real configured Clerk instance,
   * which does not exist in this repo/CI context. Faking req.auth in
   * the test would not actually verify Clerk's signature-checking
   * code path, so per the "do not fake authentication" rule, this is
   * left as a manual verification step:
   *
   *   1. Fill in real Clerk keys in client/.env and server/.env
   *   2. npm run dev in both client/ and server/
   *   3. Sign in at http://localhost:5173
   *   4. Call GET /api/me with the real session token and confirm 200
   *
   * Report the result back before this is marked verified.
   */
});