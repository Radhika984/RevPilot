import IORedis from "ioredis";

/**
 * Singleton Redis connection shared by every BullMQ Queue instance.
 * Mirrors the Prisma singleton pattern in ./prisma.ts: without this,
 * ts-node-dev's hot reload (and, in principle, per-request usage) would
 * create a new TCP connection to Redis every time this module were
 * re-evaluated instead of reusing one long-lived connection.
 *
 * maxRetriesPerRequest: null is required by BullMQ for the connection(s)
 * it manages — without it, blocking commands used internally by
 * BullMQ can fail after Redis's default retry limit.
 */
const globalForRedis = global as unknown as { redisConnection?: IORedis };

export const redisConnection: IORedis =
  globalForRedis.redisConnection ??
  new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisConnection = redisConnection;
}