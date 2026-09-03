import { PolicyModule } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/**
 * Sums RecoveryAction.expected_value for every recovery action executed
 * today (server-local midnight-to-midnight) for a given merchant +
 * module, via the existing playbook -> risk_event relation chain. Uses
 * only the existing schema — no new columns/tables.
 */
export async function getDailyUsedAmount(
  merchantId: string,
  module: PolicyModule,
  asOf: Date = new Date()
): Promise<number> {
  const dayStart = new Date(asOf);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const result = await prisma.recoveryAction.aggregate({
    _sum: { expected_value: true },
    where: {
      executed_at: { gte: dayStart, lt: dayEnd },
      playbook: { risk_event: { merchant_id: merchantId, source_type: module } },
    },
  });

  return Number(result._sum.expected_value ?? 0);
}