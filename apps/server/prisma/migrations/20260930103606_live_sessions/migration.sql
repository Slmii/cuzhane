-- CreateEnum
CREATE TYPE "LiveReadingKind" AS ENUM ('CEVSEN', 'QURAN');

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "leaderUserId" TEXT NOT NULL,
    "kind" "LiveReadingKind" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_code_key" ON "LiveSession"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_leaderUserId_key" ON "LiveSession"("leaderUserId");
