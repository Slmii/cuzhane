-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "seesReaders" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HizbAssignment" ADD COLUMN     "readNoticeSentAt" TIMESTAMP(3);

-- The owner of every Hizb plan group starts ticked, as a new group's owner is.
UPDATE "GroupMember" m SET "seesReaders" = true
FROM "Group" g
WHERE g."id" = m."groupId" AND g."kind" = 'HIZB' AND g."hizbPlan" IS NOT NULL AND m."userId" = g."ownerUserId";

-- Days read before notices existed count as told, so undoing and reading one again stays quiet.
UPDATE "HizbAssignment" SET "readNoticeSentAt" = "completedAt" WHERE "completedAt" IS NOT NULL;
