/*
  Warnings:

  - A unique constraint covering the columns `[raw_payload_hash]` on the table `risk_events` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `raw_payload_hash` to the `risk_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "risk_events" ADD COLUMN     "raw_payload_hash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "risk_events_raw_payload_hash_key" ON "risk_events"("raw_payload_hash");
