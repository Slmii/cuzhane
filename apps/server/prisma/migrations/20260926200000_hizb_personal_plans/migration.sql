-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "hizbNextSlot" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "hizbPlan" INTEGER,
ADD COLUMN     "inactivityDays" INTEGER;

-- CreateTable
CREATE TABLE "HizbEnrollment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planDays" INTEGER NOT NULL,
    "planVersion" INTEGER NOT NULL DEFAULT 1,
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
    "version" INTEGER NOT NULL DEFAULT 0,
    "bookmark" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HizbAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HizbEnrollment_groupId_userId_endDay_idx" ON "HizbEnrollment"("groupId", "userId", "endDay");

-- CreateIndex
CREATE UNIQUE INDEX "HizbEnrollment_groupId_planDays_sequence_key" ON "HizbEnrollment"("groupId", "planDays", "sequence");

-- CreateIndex
CREATE INDEX "HizbAssignment_day_completedAt_idx" ON "HizbAssignment"("day", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HizbAssignment_enrollmentId_day_key" ON "HizbAssignment"("enrollmentId", "day");

-- AddForeignKey
ALTER TABLE "HizbEnrollment" ADD CONSTRAINT "HizbEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "HizbEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE UNIQUE INDEX "HizbEnrollment_one_active" ON "HizbEnrollment" ("groupId", "userId") WHERE "endDay" IS NULL;
ALTER TABLE "Group" ADD CONSTRAINT "Group_hizbPlan_valid" CHECK ("hizbPlan" IS NULL OR ("kind" = 'HIZB' AND "hizbPlan" IN (0,7,15,33)));
ALTER TABLE "Group" ADD CONSTRAINT "Group_inactivity_valid" CHECK ("inactivityDays" IS NULL OR "inactivityDays" BETWEEN 1 AND 365);
ALTER TABLE "HizbEnrollment" ADD CONSTRAINT "HizbEnrollment_plan_valid" CHECK ("planDays" IN (7,15,33) AND "planVersion" = 1);
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_repetitions_valid" CHECK ("repetitions" BETWEEN 0 AND 19);
