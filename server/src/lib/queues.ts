import { Queue } from "bullmq";
import { redisConnection } from "./redis";

/**
 * One BullMQ Queue per webhook source type, all sharing the single
 * Redis connection from ./redis.ts. Queue instances are created once at
 * module load (and cached on `global` the same way Prisma/Redis are, so
 * ts-node-dev hot reload doesn't recreate them) — never per-request.
 */
export const QUEUE_NAMES = {
  subscription: "subscription",
  payment: "payment",
  paymentLink: "payment-link",
} as const;

const globalForQueues = global as unknown as {
  subscriptionQueue?: Queue;
  paymentQueue?: Queue;
  paymentLinkQueue?: Queue;
};

export const subscriptionQueue: Queue =
  globalForQueues.subscriptionQueue ??
  new Queue(QUEUE_NAMES.subscription, { connection: redisConnection });

export const paymentQueue: Queue =
  globalForQueues.paymentQueue ??
  new Queue(QUEUE_NAMES.payment, { connection: redisConnection });

export const paymentLinkQueue: Queue =
  globalForQueues.paymentLinkQueue ??
  new Queue(QUEUE_NAMES.paymentLink, { connection: redisConnection });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.subscriptionQueue = subscriptionQueue;
  globalForQueues.paymentQueue = paymentQueue;
  globalForQueues.paymentLinkQueue = paymentLinkQueue;
}