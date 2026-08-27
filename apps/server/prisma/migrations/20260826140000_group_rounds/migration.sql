-- Rounds: a group makes repeated passes at the hundred, and the board resets at each
-- cycle boundary. Additive — no existing column changes meaning except by convention
-- (`GroupBab.readByUserId/readAt` now describe the current round only).

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "roundIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roundStartedAt" TIMESTAMP(3);

-- Every group already running is mid-round-0, and that round began when the hatim did.
-- Without this the rollover would read a null start and treat the round as overdue,
-- wiping a live board the first time anyone opened it.
UPDATE "Group" SET "roundStartedAt" = "startedAt" WHERE "startedAt" IS NOT NULL;

-- CreateTable
CREATE TABLE "BabRead" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "babNumber" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BabRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BabRead_userId_readAt_idx" ON "BabRead"("userId", "readAt");

-- CreateIndex
CREATE INDEX "BabRead_groupId_roundIndex_idx" ON "BabRead"("groupId", "roundIndex");

-- CreateIndex
CREATE UNIQUE INDEX "BabRead_groupId_roundIndex_babNumber_key" ON "BabRead"("groupId", "roundIndex", "babNumber");

-- AddForeignKey
ALTER TABLE "BabRead" ADD CONSTRAINT "BabRead_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the log from the reads already on the board, so existing members keep their totals,
-- streaks and heatmap the moment the profile switches to reading from here.
INSERT INTO "BabRead" ("id", "groupId", "babNumber", "userId", "roundIndex", "readAt")
SELECT
    gen_random_uuid()::text,
    b."groupId",
    b."number",
    b."readByUserId",
    0,
    b."readAt"
FROM "GroupBab" b
WHERE b."readByUserId" IS NOT NULL AND b."readAt" IS NOT NULL;
