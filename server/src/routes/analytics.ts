import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { RecoveryActionStrategy } from "@prisma/client";

const router = Router();

async function getAuthedMerchant(req: Request, res: Response) {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const merchant = await prisma.merchant.findUnique({
    where: { clerk_user_id: userId },
  });

  if (!merchant) {
    res.status(404).json({
      error: "Merchant not found for this user",
    });
    return null;
  }

  return merchant;
}

function parseDays(raw: unknown): number {
  const parsed =
    typeof raw === "string" ? parseInt(raw, 10) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }

  return Math.min(parsed, 180);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * GET /api/analytics/recovery-rate
 * GET /api/analytics/recovery-rate?days=30
 */
router.get(
  "/analytics/recovery-rate",
  async (req: Request, res: Response) => {
    const merchant = await getAuthedMerchant(req, res);

    if (!merchant) return;

    const days = parseDays(req.query.days);

    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    windowStart.setDate(
      windowStart.getDate() - (days - 1)
    );

    const [
      detectedAgg,
      detectedCount,
      generatedCount,
      attemptedCount,
      recoveredAgg,
      recoveredCount,
      escalatedCount,
      windowRiskEvents,
      windowRecoveredActions,
    ] = await prisma.$transaction([
      prisma.riskEvent.aggregate({
        where: {
          merchant_id: merchant.id,
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.riskEvent.count({
        where: {
          merchant_id: merchant.id,
        },
      }),

      prisma.playbook.count({
        where: {
          risk_event: {
            merchant_id: merchant.id,
          },
        },
      }),

      prisma.playbook.count({
        where: {
          risk_event: {
            merchant_id: merchant.id,
          },
          recovery_actions: {
            some: {},
          },
        },
      }),

      prisma.riskEvent.aggregate({
        where: {
          merchant_id: merchant.id,
          playbooks: {
            some: {
              status: "closed",
            },
          },
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.riskEvent.count({
        where: {
          merchant_id: merchant.id,
          playbooks: {
            some: {
              status: "closed",
            },
          },
        },
      }),

      prisma.riskEvent.count({
        where: {
          merchant_id: merchant.id,
          playbooks: {
            some: {
              status: "escalated",
            },
          },
        },
      }),

      prisma.riskEvent.findMany({
        where: {
          merchant_id: merchant.id,
          created_at: {
            gte: windowStart,
          },
        },
        select: {
          created_at: true,
          amount: true,
        },
      }),

      prisma.recoveryAction.findMany({
        where: {
          outcome: "succeeded",
          executed_at: {
            gte: windowStart,
          },
          playbook: {
            risk_event: {
              merchant_id: merchant.id,
            },
          },
        },
        select: {
          executed_at: true,
          expected_value: true,
        },
      }),
    ]);

    const totalDetectedAmount = Number(
      detectedAgg._sum.amount ?? 0
    );

    const totalRecoveredAmount = Number(
      recoveredAgg._sum.amount ?? 0
    );

    const resolvedAttempts =
      recoveredCount + escalatedCount;

    const recoveryRate =
      resolvedAttempts > 0
        ? recoveredCount / resolvedAttempts
        : null;

    const conversionRate =
      detectedCount > 0
        ? recoveredCount / detectedCount
        : null;

    const funnel = [
      {
        stage: "detected",
        label: "Risk Events Detected",
        count: detectedCount,
        amount: totalDetectedAmount,
      },
      {
        stage: "playbook_generated",
        label: "Playbooks Generated",
        count: generatedCount,
        amount: totalDetectedAmount,
      },
      {
        stage: "attempted",
        label: "Recovery Attempted",
        count: attemptedCount,
        amount: totalDetectedAmount,
      },
      {
        stage: "recovered",
        label: "Recovered",
        count: recoveredCount,
        amount: totalRecoveredAmount,
      },
    ];

    const buckets = new Map<
      string,
      {
        detected_amount: number;
        recovered_amount: number;
        recovered_count: number;
      }
    >();

    for (let i = 0; i < days; i++) {
      const date = new Date(windowStart);
      date.setDate(date.getDate() + i);

      buckets.set(dayKey(date), {
        detected_amount: 0,
        recovered_amount: 0,
        recovered_count: 0,
      });
    }

    for (const riskEvent of windowRiskEvents) {
      const key = dayKey(riskEvent.created_at);
      const bucket = buckets.get(key);

      if (bucket) {
        bucket.detected_amount += Number(
          riskEvent.amount
        );
      }
    }

    for (const action of windowRecoveredActions) {
      if (!action.executed_at) continue;

      const key = dayKey(action.executed_at);
      const bucket = buckets.get(key);

      if (bucket) {
        bucket.recovered_amount += Number(
          action.expected_value
        );
        bucket.recovered_count += 1;
      }
    }

    const timeline = Array.from(
      buckets.entries()
    ).map(([date, values]) => ({
      date,
      ...values,
    }));

    return res.status(200).json({
      funnel,
      recovery_rate: recoveryRate,
      conversion_rate: conversionRate,
      timeline,
    });
  }
);

/**
 * GET /api/analytics/playbook-performance
 */
router.get(
  "/analytics/playbook-performance",
  async (req: Request, res: Response) => {
    const merchant = await getAuthedMerchant(req, res);

    if (!merchant) return;

    const [
      strategyRows,
      rootCauseRows,
      chainDepthRows,
    ] = await Promise.all([
      prisma.recoveryAction.groupBy({
        by: ["strategy", "outcome"],
        where: {
          playbook: {
            risk_event: {
              merchant_id: merchant.id,
            },
          },
        },
        orderBy: [
          {
            strategy: "asc",
          },
          {
            outcome: "asc",
          },
        ],
        _count: true,
        _sum: {
          expected_value: true,
        },
      }),

      prisma.playbook.groupBy({
        by: ["root_cause", "status"],
        where: {
          risk_event: {
            merchant_id: merchant.id,
          },
        },
        orderBy: [
          {
            root_cause: "asc",
          },
          {
            status: "asc",
          },
        ],
        _count: true,
        _sum: {
          recovery_value: true,
        },
      }),

      prisma.playbook.groupBy({
        by: ["chain_depth"],
        where: {
          risk_event: {
            merchant_id: merchant.id,
          },
        },
        orderBy: {
          chain_depth: "asc",
        },
        _count: true,
      }),
    ]);

    const byStrategy = Object.values(
      RecoveryActionStrategy
    ).map((strategy) => {
      const rows = strategyRows.filter(
        (row) => row.strategy === strategy
      );

      const attempts = rows.reduce(
        (sum, row) => sum + row._count,
        0
      );

      const succeeded =
        rows.find(
          (row) => row.outcome === "succeeded"
        )?._count ?? 0;

      const failed =
        rows.find(
          (row) => row.outcome === "failed"
        )?._count ?? 0;

      const pending =
        rows.find(
          (row) => row.outcome === "pending"
        )?._count ?? 0;

      const skipped =
        rows.find(
          (row) => row.outcome === "skipped"
        )?._count ?? 0;

      const totalRecoveredAmount = Number(
        rows.find(
          (row) => row.outcome === "succeeded"
        )?._sum.expected_value ?? 0
      );

      return {
        strategy,
        attempts,
        succeeded,
        failed,
        pending,
        skipped,
        success_rate:
          attempts > 0
            ? succeeded / attempts
            : null,
        total_recovered_amount:
          totalRecoveredAmount,
      };
    });

    const rootCauseMap = new Map<
      string,
      {
        playbooks: number;
        recovered: number;
        escalated: number;
        total_recovery_value: number;
      }
    >();

    for (const row of rootCauseRows) {
      const entry =
        rootCauseMap.get(row.root_cause) ?? {
          playbooks: 0,
          recovered: 0,
          escalated: 0,
          total_recovery_value: 0,
        };

      entry.playbooks += row._count;

      if (row.status === "closed") {
        entry.recovered += row._count;

        entry.total_recovery_value += Number(
          row._sum.recovery_value ?? 0
        );
      }

      if (row.status === "escalated") {
        entry.escalated += row._count;
      }

      rootCauseMap.set(
        row.root_cause,
        entry
      );
    }

    const byRootCause = Array.from(
      rootCauseMap.entries()
    )
      .map(([root_cause, entry]) => ({
        root_cause,
        ...entry,
        success_rate:
          entry.playbooks > 0
            ? entry.recovered /
              entry.playbooks
            : null,
      }))
      .sort(
        (a, b) =>
          b.playbooks - a.playbooks
      );

    const chainDepthDistribution =
      chainDepthRows
        .map((row) => ({
          chain_depth: row.chain_depth,
          count: row._count,
        }))
        .sort(
          (a, b) =>
            a.chain_depth - b.chain_depth
        );

    return res.status(200).json({
      by_strategy: byStrategy,
      by_root_cause: byRootCause,
      chain_depth_distribution:
        chainDepthDistribution,
    });
  }
);

/**
 * GET /api/analytics/recalibration-report
 */
router.get(
  "/analytics/recalibration-report",
  async (req: Request, res: Response) => {
    const merchant = await getAuthedMerchant(req, res);

    if (!merchant) return;

    const decidedActions =
      await prisma.recoveryAction.findMany({
        where: {
          outcome: {
            in: ["succeeded", "failed"],
          },
          playbook: {
            risk_event: {
              merchant_id: merchant.id,
            },
          },
        },
        select: {
          confidence: true,
          outcome: true,
        },
      });

    const BUCKET_WIDTH = 0.2;
    const BUCKET_COUNT = 5;

    const buckets = Array.from(
      {
        length: BUCKET_COUNT,
      },
      (_, index) => {
        const min =
          index * BUCKET_WIDTH;

        const max =
          index === BUCKET_COUNT - 1
            ? 1
            : min + BUCKET_WIDTH;

        return {
          bucket_label:
            `${Math.round(
              min * 100
            )}-${Math.round(max * 100)}%`,
          bucket_min: min,
          bucket_max: max,
          confidenceSum: 0,
          succeeded: 0,
          total: 0,
        };
      }
    );

    for (const action of decidedActions) {
      const confidence = Number(
        action.confidence
      );

      let index = Math.floor(
        confidence / BUCKET_WIDTH
      );

      if (index >= BUCKET_COUNT) {
        index = BUCKET_COUNT - 1;
      }

      if (index < 0) {
        index = 0;
      }

      const bucket = buckets[index];

      bucket.confidenceSum += confidence;
      bucket.total += 1;

      if (action.outcome === "succeeded") {
        bucket.succeeded += 1;
      }
    }

    const bucketResults = buckets.map(
      ({
        confidenceSum,
        succeeded,
        total,
        ...rest
      }) => ({
        ...rest,
        sample_size: total,
        avg_predicted_confidence:
          total > 0
            ? confidenceSum / total
            : null,
        observed_success_rate:
          total > 0
            ? succeeded / total
            : null,
      })
    );

    const sampleSize =
      decidedActions.length;

    const overallPredictedConfidence =
      sampleSize > 0
        ? decidedActions.reduce(
            (sum, action) =>
              sum +
              Number(action.confidence),
            0
          ) / sampleSize
        : null;

    const overallSucceeded =
      decidedActions.filter(
        (action) =>
          action.outcome === "succeeded"
      ).length;

    const overallObservedSuccessRate =
      sampleSize > 0
        ? overallSucceeded / sampleSize
        : null;

    let recommendation:
      | string
      | null = null;

    if (
      overallPredictedConfidence !== null &&
      overallObservedSuccessRate !== null
    ) {
      const gap =
        overallPredictedConfidence -
        overallObservedSuccessRate;

      if (gap > 0.1) {
        recommendation =
          "The Decision Engine is overconfident: predicted confidence is running ahead of observed outcomes. Consider raising min_confidence thresholds in Merchant Policies.";
      } else if (gap < -0.1) {
        recommendation =
          "The Decision Engine is underconfident: observed outcomes are outperforming predicted confidence. min_confidence thresholds could likely be relaxed.";
      } else {
        recommendation =
          "Predicted confidence is well-calibrated against observed outcomes.";
      }
    }

    return res.status(200).json({
      buckets: bucketResults,
      sample_size: sampleSize,
      overall_predicted_confidence:
        overallPredictedConfidence,
      overall_observed_success_rate:
        overallObservedSuccessRate,
      recommendation,
    });
  }
);

export default router;