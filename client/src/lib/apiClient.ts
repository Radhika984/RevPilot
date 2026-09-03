import axios from "axios";

/**
 * Shared Axios instance for talking to the RevPilot API.
 *
 * This does NOT attach the Clerk session token itself — Clerk tokens
 * are short-lived and must be re-fetched per request via
 * `useAuth().getToken()`, which is only available inside React
 * components/hooks. See `src/hooks/useRevenue.ts` for the pattern:
 * each hook resolves a fresh token and passes it as an Authorization
 * header on the individual request, matching how `App.tsx`'s original
 * `/api/me` verification call worked in earlier phases.
 */
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const apiClient = axios.create({
  baseURL: API_URL,
});
