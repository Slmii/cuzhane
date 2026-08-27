-- Drops the retired `OPEN_ENDED` cycle from `GroupCycle`.
--
-- Postgres cannot remove a member from an enum, so the type is rebuilt without it and the
-- column is swapped over. Any row still carrying the retired value is converted first —
-- to `ONE_OFF`, which is how the application has been reading such rows since the cycle
-- was taken out of the API. Without this step the type swap would fail on a database that
-- still has open-ended groups.
UPDATE "Group" SET "cycle" = 'ONE_OFF' WHERE "cycle" = 'OPEN_ENDED';

ALTER TYPE "GroupCycle" RENAME TO "GroupCycle_old";

CREATE TYPE "GroupCycle" AS ENUM ('DAILY', 'WEEKLY', 'ONE_OFF');

-- The default has to come off before the type changes and go back afterwards: it is
-- stored as an expression typed against the old enum.
ALTER TABLE "Group" ALTER COLUMN "cycle" DROP DEFAULT;

ALTER TABLE "Group"
    ALTER COLUMN "cycle" TYPE "GroupCycle" USING ("cycle"::text::"GroupCycle");

ALTER TABLE "Group" ALTER COLUMN "cycle" SET DEFAULT 'WEEKLY';

DROP TYPE "GroupCycle_old";
