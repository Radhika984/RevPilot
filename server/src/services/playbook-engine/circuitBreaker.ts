/**
 * Per-module circuit breaker for the Phase 5 waterfall. "Module" is the
 * risk event's source_type (subscription / payment / payment_link /
 * settlement — same value space as the PolicyModule enum). Trips after
 * CIRCUIT_BREAKER_FAILURE_THRESHOLD consecutive step failures for that
 * module and stays open until a step for that module succeeds.
 *
 * In-memory only (no new Prisma table — Phase 5 must use the existing
 * schema as-is), mirroring the module-load-once singleton pattern used
 * elsewhere in this codebase (lib/prisma.ts, lib/redis.ts, lib/queues.ts).
 */

export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;

interface BreakerState {
  consecutiveFailures: number;
  open: boolean;
}

const breakerStateByModule = new Map<string, BreakerState>();

function getState(module: string): BreakerState {
  let state = breakerStateByModule.get(module);
  if (!state) {
    state = { consecutiveFailures: 0, open: false };
    breakerStateByModule.set(module, state);
  }
  return state;
}

export function isCircuitOpen(module: string): boolean {
  return getState(module).open;
}

export function recordStepFailure(module: string): void {
  const state = getState(module);
  state.consecutiveFailures += 1;
  if (state.consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    state.open = true;
  }
}

export function recordStepSuccess(module: string): void {
  const state = getState(module);
  state.consecutiveFailures = 0;
  state.open = false;
}

export function resetCircuitBreaker(module: string): void {
  breakerStateByModule.set(module, { consecutiveFailures: 0, open: false });
}

/** Test-only helper: clears breaker state for every module. */
export function resetAllCircuitBreakers(): void {
  breakerStateByModule.clear();
}