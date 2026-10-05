-- The Hizbü'l-Hakaik moves from 33 portions to the family calendar's 32. The cuts from the
-- Evrâd on are new, so what was kept against the old ones is dropped or reset rather than
-- renumbered; the readers then pick the plan up on the new division.

ALTER TABLE "Group" DROP CONSTRAINT "Group_hizbPlan_valid";
ALTER TABLE "Group" DROP CONSTRAINT "Group_hizbIndividual_valid";

-- A 33-day plan's days name portions of a division that no longer exists, and every read path
-- would ask for it. Its enrollments go (their assignments cascade); members start the 32-day plan.
DELETE FROM "HizbEnrollment" e
USING "Group" g
WHERE g."id" = e."groupId" AND g."kind" = 'HIZB' AND e."planDays" = 33;

UPDATE "Group" SET "hizbPlan" = 32 WHERE "kind" = 'HIZB' AND "hizbPlan" = 33;
UPDATE "Group" SET "hizbStartPortion" = 32 WHERE "kind" = 'HIZB' AND "hizbStartPortion" > 32;

-- The counter numbered the 33-day plan's enrollments, all gone; it now numbers the 32-day plan's.
ALTER TABLE "Group" RENAME COLUMN "hizbNext33" TO "hizbNext32";
UPDATE "Group" SET "hizbNext32" = 0 WHERE "kind" = 'HIZB';

-- 7- and 15-day plans keep their days, but an unfinished day's board ticks name the old board's
-- portions, and its bookmark a page of the old cut.
UPDATE "HizbAssignment" a
SET "readPortions" = '{}', "bookmark" = 0
FROM "HizbEnrollment" e, "Group" g
WHERE e."id" = a."enrollmentId" AND g."id" = e."groupId" AND g."kind" = 'HIZB' AND a."completedAt" IS NULL;

-- "Kaldığım yer" in a Hizb group is a page within a portion, and the pages moved.
DELETE FROM "ReadingPlace" r
USING "Group" g
WHERE g."id" = r."groupId" AND g."kind" = 'HIZB';

-- A seat-divided group's portion 33 is gone, with whatever was kept against it.
DELETE FROM "GroupBab" b
USING "Group" g
WHERE g."id" = b."groupId" AND g."kind" = 'HIZB' AND b."number" > 32;
DELETE FROM "BabRead" r
USING "Group" g
WHERE g."id" = r."groupId" AND g."kind" = 'HIZB' AND r."babNumber" > 32;
DELETE FROM "GroupPartRepetition" p
USING "Group" g
WHERE g."id" = p."groupId" AND g."kind" = 'HIZB' AND p."partNumber" > 32;

ALTER TABLE "Group" ADD CONSTRAINT "Group_hizbPlan_valid" CHECK ("hizbPlan" IS NULL OR ("kind" = 'HIZB' AND "hizbPlan" IN (0,7,15,32)));
ALTER TABLE "Group" ADD CONSTRAINT "Group_hizbIndividual_valid" CHECK (
  (NOT "hizbIndividual" AND "hizbStartPortion" = 1 AND "planDays" IS NULL) OR
  ("hizbIndividual" AND "kind" = 'HIZB' AND "hizbPlan" IS NOT NULL AND "hizbPlan" IN (7,15,32)
   AND "hizbStartPortion" BETWEEN 1 AND "hizbPlan"
   AND "visibility" = 'PRIVATE' AND NOT "openToJoin" AND "inactivityDays" IS NULL) OR
  ("hizbIndividual" AND "planDays" IS NOT NULL AND "hizbStartPortion" = 1
   AND "visibility" = 'PRIVATE' AND NOT "openToJoin" AND "inactivityDays" IS NULL)
);
