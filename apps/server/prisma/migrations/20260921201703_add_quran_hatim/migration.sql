-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('CEVSEN', 'HATIM');

-- CreateEnum
CREATE TYPE "CuzDistribution" AS ENUM ('FREE_PICK', 'EQUAL', 'JOIN_ORDER');

-- CreateEnum
CREATE TYPE "CuzBoundaryPolicy" AS ENUM ('KEEP', 'REPICK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GroupCycle" ADD VALUE 'MONTHLY';
ALTER TYPE "GroupCycle" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "boundaryPolicy" "CuzBoundaryPolicy",
ADD COLUMN     "distribution" "CuzDistribution",
ADD COLUMN     "kind" "GroupKind" NOT NULL DEFAULT 'CEVSEN',
ADD COLUMN     "maxPerMember" INTEGER,
ADD COLUMN     "roundDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "CuzHolding" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "cuzNumber" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuzHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuzHolding_groupId_roundIndex_userId_idx" ON "CuzHolding"("groupId", "roundIndex", "userId");

-- CreateIndex
CREATE INDEX "CuzHolding_userId_idx" ON "CuzHolding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CuzHolding_groupId_roundIndex_cuzNumber_key" ON "CuzHolding"("groupId", "roundIndex", "cuzNumber");

-- AddForeignKey
ALTER TABLE "CuzHolding" ADD CONSTRAINT "CuzHolding_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
