import { Router, Request, Response } from "express";
import crypto from "crypto";
import { Prisma, RiskEventSourceType } from "@prisma/client";
import type { Queue } from "bullmq";

import { prisma } from "../lib/prisma";
import {
  subscriptionQueue,
  paymentQueue,
  paymentLinkQueue,
} from "../lib/queues";

const router = Router();

function isValidRazorpaySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) return false;

  return crypto.timingSafeEqual(
    expectedBuffer,
    providedBuffer
  );
}

function extractAmountInRupees(
  event: Record<string, unknown>
): number {
  const payload = (event?.payload ?? {}) as Record<
    string,
    unknown
  >;

  const candidates = [
    (payload.payment as any)?.entity?.amount,
    (payload.payment_link as any)?.entity?.amount,
    (payload.subscription as any)?.entity?.amount,
  ];

  const amountInPaise = candidates.find(
    (v) => typeof v === "number"
  ) as number | undefined;

  return amountInPaise !== undefined
    ? amountInPaise / 100
    : 0;
}

function hashRawBody(rawBody: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(rawBody)
    .digest("hex");
}

function normalizeAccountId(
  raw: unknown
): string | undefined {
  if (typeof raw !== "string") return undefined;

  const trimmed = raw.trim();

  return trimmed.length > 0
    ? trimmed
    : undefined;
}

function buildWebhookHandler(
  sourceType: RiskEventSourceType,
  queue: Queue
) {
  return async (
    req: Request,
    res: Response
  ) => {
    const secret =
      process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error(
        "RAZORPAY_WEBHOOK_SECRET is not configured"
      );

      return res.status(500).json({
        error: "Webhook secret not configured",
      });
    }

    const rawBody = req.body as Buffer;

    const signatureHeader =
      req.header("x-razorpay-signature");

    if (
      !isValidRazorpaySignature(
        rawBody,
        signatureHeader,
        secret
      )
    ) {
      console.warn(
        `Invalid Razorpay signature on ${req.path}`
      );

      return res.status(401).json({
        error: "Invalid signature",
      });
    }

    let event: Record<string, unknown>;

    try {
      event = JSON.parse(
        rawBody.toString("utf8")
      );
    } catch (err) {
      console.error(
        "Failed to parse verified Razorpay webhook body:",
        err
      );

      return res.status(400).json({
        error: "Invalid JSON payload",
      });
    }

    const accountId = normalizeAccountId(
      event.account_id
    );

    // ============================================================
    // TEMPORARY DIAGNOSTIC
    // This tells us exactly what database and merchant records
    // the RUNNING backend process can actually see.
    // ============================================================

    const dbInfo = await prisma.$queryRaw<
      {
        current_database: string;
        port: string;
      }[]
    >`
      SELECT
        current_database(),
        inet_server_port()::text AS port
    `;

    console.log(
      "DIAG connected to:",
      dbInfo
    );

    const allMerchants =
      await prisma.merchant.findMany({
        select: {
          id: true,
          razorpay_account_id: true,
        },
      });

    console.log(
      "DIAG merchants visible to this process:",
      JSON.stringify(allMerchants)
    );

    console.log(
      "DIAG accountId from payload (char codes):",
      accountId,
      accountId
        ? [...accountId].map((c) =>
            c.charCodeAt(0)
          )
        : null
    );

    // ============================================================
    // END TEMPORARY DIAGNOSTIC
    // ============================================================

    const merchant = accountId
      ? await prisma.merchant.findFirst({
          where: {
            razorpay_account_id: accountId,
          },
        })
      : null;

    if (!merchant) {
      console.warn(
        `Razorpay webhook on ${req.path}: no merchant found for account_id=${accountId}`
      );

      return res.status(200).json({
        received: true,
        ignored: "merchant_not_resolved",
      });
    }

    const rawPayloadHash =
      hashRawBody(rawBody);

    const rootCause =
      typeof event.event === "string"
        ? event.event
        : "unknown";

    const amount =
      extractAmountInRupees(event);

    let riskEvent;

    try {
      riskEvent =
        await prisma.riskEvent.create({
          data: {
            merchant_id: merchant.id,
            source_type: sourceType,
            root_cause: rootCause,
            amount,
            raw_payload:
              event as Prisma.InputJsonValue,
            raw_payload_hash:
              rawPayloadHash,
            status: "open",
          },
        });
    } catch (err) {
      if (
        err instanceof
          Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return res.status(200).json({
          received: true,
          duplicate: true,
        });
      }

      console.error(
        "Failed to create risk_events row from webhook:",
        err
      );

      return res.status(500).json({
        error:
          "Internal error creating risk event",
      });
    }

    try {
      await queue.add(
        rootCause,
        {
          riskEventId: riskEvent.id,
          merchantId: merchant.id,
          sourceType,
          rawPayload: event,
        },
        {
          jobId: riskEvent.id,
        }
      );
    } catch (err) {
      console.error(
        "Failed to enqueue job for risk event:",
        riskEvent.id,
        err
      );

      return res.status(500).json({
        error:
          "Risk event stored but failed to enqueue job",
      });
    }

    return res.status(200).json({
      received: true,
      riskEventId: riskEvent.id,
    });
  };
}

router.post(
  "/subscription",
  buildWebhookHandler(
    RiskEventSourceType.subscription,
    subscriptionQueue
  )
);

router.post(
  "/payment-link",
  buildWebhookHandler(
    RiskEventSourceType.payment_link,
    paymentLinkQueue
  )
);

router.post(
  "/payment",
  buildWebhookHandler(
    RiskEventSourceType.payment,
    paymentQueue
  )
);

export default router;