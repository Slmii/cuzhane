-- Drops the retired `ONE_OFF` cycle from `GroupCycle`, leaving only the two that roll.
--
-- `ONE_OFF` was the last cycle with no round length: `ROUND_DAYS` mapped it to null and
-- `roundEndsAt` fell back to an invented 30-day window purely so the UI had a countdown to
-- show. Removing it means every cycle now has a real round length, and the fudge goes with it.
--
-- Existing one-off groups become WEEKLY. That is the closest surviving cycle — it is the
-- column default and the longest round — and it changes their behaviour in one visible way:
-- a group that used to sit on round 0 for ever now rolls at each week boundary. Their read
-- history is untouched; `BabRead` is append-only and keyed by round, so past rounds stay
-- readable exactly as they were.
-- Their `endsAt` is 30 days past the start, which is not a boundary any weekly round would
-- land on. It has to be corrected here, while the rows are still identifiable as one-offs,
-- and before the value is rewritten. `roundStartedAt` needs no fixing: a one-off never left
-- round 0, and round 0 begins at `startedAt` by definition. From the next request onward
-- `ensureCurrentRound` recomputes both. Rows still GATHERING have no `startedAt` and keep
-- their nulls.
UPDATE "Group"
SET "endsAt" = "roundStartedAt" + interval '7 days'
WHERE "cycle" = 'ONE_OFF' AND "roundStartedAt" IS NOT NULL;

UPDATE "Group" SET "cycle" = 'WEEKLY' WHERE "cycle" = 'ONE_OFF';

ALTER TYPE "GroupCycle" RENAME TO "GroupCycle_old";

CREATE TYPE "GroupCycle" AS ENUM ('DAILY', 'WEEKLY');

-- The default has to come off before the type changes and go back afterwards: it is
-- stored as an expression typed against the old enum.
ALTER TABLE "Group" ALTER COLUMN "cycle" DROP DEFAULT;

ALTER TABLE "Group"
    ALTER COLUMN "cycle" TYPE "GroupCycle" USING ("cycle"::text::"GroupCycle");

ALTER TABLE "Group" ALTER COLUMN "cycle" SET DEFAULT 'WEEKLY';

DROP TYPE "GroupCycle_old";
