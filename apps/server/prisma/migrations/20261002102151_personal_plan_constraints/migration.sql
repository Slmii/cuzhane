-- A Şahsi Cevşen or Kur'an reading: `planDays` on the group, one person's private plan read through
-- `HizbEnrollment`. Rules Prisma cannot express, widening those `hizb_constraints` set for the Hizb.

-- The length: the Cevşen over 1–90 days, the Kur'an over 1–30, never beside a Hizb plan.
ALTER TABLE "Group" ADD CONSTRAINT "Group_planDays_valid" CHECK (
  "planDays" IS NULL OR
  ("hizbPlan" IS NULL AND (("kind" = 'CEVSEN' AND "planDays" BETWEEN 1 AND 90) OR
                           ("kind" = 'HATIM' AND "planDays" BETWEEN 1 AND 30)))
);

-- Individual reading is now a Hizb plan's, or a Şahsi reading's — which is always individual, from the
-- first part.
ALTER TABLE "Group" DROP CONSTRAINT "Group_hizbIndividual_valid";
ALTER TABLE "Group" ADD CONSTRAINT "Group_hizbIndividual_valid" CHECK (
  (NOT "hizbIndividual" AND "hizbStartPortion" = 1 AND "planDays" IS NULL) OR
  ("hizbIndividual" AND "kind" = 'HIZB' AND "hizbPlan" IS NOT NULL AND "hizbPlan" IN (7,15,33)
   AND "hizbStartPortion" BETWEEN 1 AND "hizbPlan"
   AND "visibility" = 'PRIVATE' AND NOT "openToJoin" AND "inactivityDays" IS NULL) OR
  ("hizbIndividual" AND "planDays" IS NOT NULL AND "hizbStartPortion" = 1
   AND "visibility" = 'PRIVATE' AND NOT "openToJoin" AND "inactivityDays" IS NULL)
);

-- An enrollment's length is its group's: 7/15/33 on a Hizb, up to 90 on a Şahsi reading. A check
-- cannot see the group, so this is the outer bound; `Group_planDays_valid` holds the rest.
ALTER TABLE "HizbEnrollment" DROP CONSTRAINT "HizbEnrollment_plan_valid";
ALTER TABLE "HizbEnrollment" ADD CONSTRAINT "HizbEnrollment_plan_valid" CHECK ("planDays" BETWEEN 1 AND 90 AND "planVersion" = 1);
