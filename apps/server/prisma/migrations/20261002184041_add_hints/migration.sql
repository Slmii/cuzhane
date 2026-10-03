-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "hasUsedHints" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hintsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "HintSeen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hintId" VARCHAR(64) NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HintSeen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HintSeen_userId_idx" ON "HintSeen"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HintSeen_userId_hintId_key" ON "HintSeen"("userId", "hintId");
