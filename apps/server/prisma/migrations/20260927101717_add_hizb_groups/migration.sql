-- AlterEnum
ALTER TYPE "GroupKind" ADD VALUE 'HIZB';

-- AlterEnum
ALTER TYPE "GroupSplitMode" ADD VALUE 'FLEXIBLE';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "hideMemberNames" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hizbIndividual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hizbNext15" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hizbNext33" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hizbNext7" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hizbNextSlot" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "hizbPlan" INTEGER,
ADD COLUMN     "hizbStartPortion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "inactivityDays" INTEGER,
ADD COLUMN     "inactivitySinceDay" INTEGER;

-- CreateTable
CREATE TABLE "GroupPartRepetition" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPartRepetition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HizbEnrollment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planDays" INTEGER NOT NULL,
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL,
    "joinedDay" INTEGER NOT NULL,
    "endDay" INTEGER,
    "reason" TEXT,
    "removalDays" INTEGER,
    "lastReadDay" INTEGER,
    "generatedThrough" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HizbEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HizbAssignment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "portion" INTEGER NOT NULL,
    "traversal" INTEGER NOT NULL,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "delailRepetitions" INTEGER NOT NULL DEFAULT 0,
    "istighfarRepetitions" INTEGER NOT NULL DEFAULT 0,
    "istighfarTarget" INTEGER NOT NULL DEFAULT 11,
    "version" INTEGER NOT NULL DEFAULT 0,
    "bookmark" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HizbAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupPartRepetition_userId_idx" ON "GroupPartRepetition"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPartRepetition_groupId_userId_roundIndex_partNumber_key" ON "GroupPartRepetition"("groupId", "userId", "roundIndex", "partNumber");

-- CreateIndex
CREATE INDEX "HizbEnrollment_groupId_userId_endDay_idx" ON "HizbEnrollment"("groupId", "userId", "endDay");

-- CreateIndex
CREATE UNIQUE INDEX "HizbEnrollment_groupId_planDays_sequence_key" ON "HizbEnrollment"("groupId", "planDays", "sequence");

-- CreateIndex
CREATE INDEX "HizbAssignment_day_completedAt_idx" ON "HizbAssignment"("day", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HizbAssignment_enrollmentId_day_key" ON "HizbAssignment"("enrollmentId", "day");

-- AddForeignKey
ALTER TABLE "GroupPartRepetition" ADD CONSTRAINT "GroupPartRepetition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HizbEnrollment" ADD CONSTRAINT "HizbEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "HizbEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
