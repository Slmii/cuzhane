-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReadingCadence" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ReadingGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "numberOfParts" INTEGER NOT NULL,
    "cadence" "ReadingCadence" NOT NULL,
    "timezone" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextJoinSequence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReadingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "joinSequence" INTEGER NOT NULL,
    "rotationOffset" INTEGER NOT NULL,
    "joinedStep" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReadingMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingCycle" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "scheduleAnchor" TIMESTAMP(3) NOT NULL,
    "scheduleIndex" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReadingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingAssignment" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "partIndex" INTEGER NOT NULL,
    "rotationStep" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReadingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingGroup_inviteCode_key" ON "ReadingGroup"("inviteCode");

-- CreateIndex
CREATE INDEX "ReadingGroup_ownerUserId_idx" ON "ReadingGroup"("ownerUserId");

-- CreateIndex
CREATE INDEX "ReadingMembership_groupId_active_idx" ON "ReadingMembership"("groupId", "active");

-- CreateIndex
CREATE INDEX "ReadingMembership_userId_groupId_idx" ON "ReadingMembership"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingMembership_groupId_joinSequence_key" ON "ReadingMembership"("groupId", "joinSequence");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingCycle_membershipId_index_key" ON "ReadingCycle"("membershipId", "index");

-- CreateIndex
CREATE INDEX "ReadingAssignment_cycleId_completedAt_idx" ON "ReadingAssignment"("cycleId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingAssignment_cycleId_ordinal_key" ON "ReadingAssignment"("cycleId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingAssignment_cycleId_partIndex_key" ON "ReadingAssignment"("cycleId", "partIndex");

-- AddForeignKey
ALTER TABLE "ReadingMembership" ADD CONSTRAINT "ReadingMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReadingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingCycle" ADD CONSTRAINT "ReadingCycle_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "ReadingMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingAssignment" ADD CONSTRAINT "ReadingAssignment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReadingCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rejoining creates a new membership, but two active memberships are forbidden.
CREATE UNIQUE INDEX "ReadingMembership_one_active_user" ON "ReadingMembership"("groupId", "userId") WHERE "active" = true;
ALTER TABLE "ReadingGroup" ADD CONSTRAINT "ReadingGroup_positive_parts" CHECK ("numberOfParts" > 0);
ALTER TABLE "ReadingMembership" ADD CONSTRAINT "ReadingMembership_valid_state" CHECK ("joinSequence" > 0 AND "rotationOffset" >= 0 AND "joinedStep" >= 0 AND ("active" = ("leftAt" IS NULL)));
ALTER TABLE "ReadingAssignment" ADD CONSTRAINT "ReadingAssignment_valid_state" CHECK ("ordinal" >= 0 AND "partIndex" >= 0 AND ("completedAt" IS NULL OR "completedAt" >= "assignedAt"));
