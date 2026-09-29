-- Rules Prisma cannot express, carried over from the Hizb branch's migrations. Separate from
-- `add_hizb_groups` because Postgres refuses a newly added enum value ('HIZB') in the same
-- transaction that adds it.

-- One active enrollment per member of a group.
CREATE UNIQUE INDEX "HizbEnrollment_one_active" ON "HizbEnrollment" ("groupId", "userId") WHERE "endDay" IS NULL;

ALTER TABLE "Group" ADD CONSTRAINT "Group_hizbPlan_valid" CHECK ("hizbPlan" IS NULL OR ("kind" = 'HIZB' AND "hizbPlan" IN (0,7,15,33)));
ALTER TABLE "Group" ADD CONSTRAINT "Group_inactivity_valid" CHECK ("inactivityDays" IS NULL OR "inactivityDays" BETWEEN 1 AND 365);
ALTER TABLE "Group" ADD CONSTRAINT "Group_hizbIndividual_valid" CHECK (
  (NOT "hizbIndividual" AND "hizbStartPortion" = 1) OR
  ("hizbIndividual" AND "kind" = 'HIZB' AND "hizbPlan" IS NOT NULL AND "hizbPlan" IN (7,15,33)
   AND "hizbStartPortion" BETWEEN 1 AND "hizbPlan"
   AND "visibility" = 'PRIVATE' AND NOT "openToJoin" AND "inactivityDays" IS NULL)
);

ALTER TABLE "HizbEnrollment" ADD CONSTRAINT "HizbEnrollment_plan_valid" CHECK ("planDays" IN (7,15,33) AND "planVersion" = 1);

ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_repetitions_valid" CHECK ("repetitions" BETWEEN 0 AND 19);
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_istighfar_valid"
CHECK ("istighfarRepetitions" BETWEEN 0 AND 100 AND "istighfarTarget" IN (11,33,100));
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_delail_valid" CHECK ("delailRepetitions" BETWEEN 0 AND 3);
