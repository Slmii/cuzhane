-- Gives every group the time zone its day is measured in.
--
-- Round boundaries were bucketed in UTC, which put the reset at 03:00 in Istanbul and 20:00
-- the *previous evening* in New York — an American member's board wiped mid-evening and
-- their heatmap merged two evenings of reading into a single square. The boundary is now a
-- local midnight in this zone.
--
-- Existing rows are backfilled to Europe/Istanbul rather than UTC: the app is Turkish-first,
-- so that is where its groups actually live, and leaving them on UTC would preserve the bug
-- rather than the behaviour. The one-time effect is that each running group's current round
-- ends up to three hours earlier than it would have — a single shortened round, after which
-- everything lands on local midnight. No read history is affected; `BabRead` is keyed by
-- round index and is not touched here.
ALTER TABLE "Group" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul';

-- `roundStartedAt` and `endsAt` were both computed the old way and have to be re-derived
-- against the new anchor, or the stored round stops agreeing with the one the code computes.
--
-- The subtle case is a group whose UTC day and Istanbul day disagree — one started between
-- 21:00Z and midnight, which is already the next day in Istanbul. Under UTC bucketing it has
-- rolled once more than the new math thinks it should have, so `ensureCurrentRound` (guarded
-- on `target <= roundIndex`) will sit still until the calendar catches up. That is
-- unavoidable and harmless — the index must NOT be lowered to match, because `BabRead` is
-- uniquely keyed on `(groupId, roundIndex, babNumber)` and rewinding it would collide with
-- the history already written for that index. What must not happen is the countdown claiming
-- a boundary the group will not act on, so both columns are derived from `startedAt` and the
-- index the group actually holds — exactly what `roundStartedAtFor` and `roundEndsAt` would
-- return. The visible effect is one longer-than-usual round, once.
--
-- The double `AT TIME ZONE` is not redundant. These columns are `timestamp without time
-- zone` holding UTC (Prisma's convention), so the first conversion says "read this as UTC"
-- and the second says "now express it in Istanbul" — giving the local wall clock to truncate
-- against. Adding whole days to the truncated *local* time and converting back is what lands
-- on a real local midnight, which arithmetic on the stored instant would not.
UPDATE "Group"
SET "roundStartedAt" = CASE
        WHEN "roundIndex" = 0 THEN "startedAt"
        ELSE (
            (
                date_trunc('day', "startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')
                + ("roundIndex" * CASE WHEN "cycle" = 'DAILY' THEN interval '1 day' ELSE interval '7 days' END)
            ) AT TIME ZONE 'Europe/Istanbul'
        ) AT TIME ZONE 'UTC'
    END,
    "endsAt" = (
        (
            date_trunc('day', "startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')
            + (("roundIndex" + 1) * CASE WHEN "cycle" = 'DAILY' THEN interval '1 day' ELSE interval '7 days' END)
        ) AT TIME ZONE 'Europe/Istanbul'
    ) AT TIME ZONE 'UTC'
WHERE "status" = 'RUNNING' AND "startedAt" IS NOT NULL;
