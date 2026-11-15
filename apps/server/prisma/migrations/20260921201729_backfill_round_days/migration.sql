-- `roundDays` is the calendar's input from here on, and its default of 7 is only correct
-- for the WEEKLY groups that were the default. A DAILY group backfilled to 7 would have
-- its rounds silently become weekly: `ROUND_DAYS` used to map DAILY -> 1, and nothing
-- else recorded that.
--
-- Written by hand because a data backfill cannot be derived from the schema; the
-- directory and its timestamp are Prisma's, so replay order stays its business.
UPDATE "Group" SET "roundDays" = 1 WHERE "cycle" = 'DAILY';
