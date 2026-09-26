ALTER TABLE "Group" ADD COLUMN "hizbIndividual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hizbStartPortion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Group" ADD CONSTRAINT "Group_hizbIndividual_valid" CHECK (
  (NOT "hizbIndividual" AND "hizbStartPortion" = 1) OR
  ("hizbIndividual" AND "kind" = 'HIZB' AND "hizbPlan" IS NOT NULL AND "hizbPlan" IN (7,15,33)
   AND "hizbStartPortion" BETWEEN 1 AND "hizbPlan"
   AND "visibility" = 'PRIVATE' AND NOT "openToJoin" AND "inactivityDays" IS NULL)
);
