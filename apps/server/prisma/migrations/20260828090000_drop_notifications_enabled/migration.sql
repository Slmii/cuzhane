-- Drops `UserSettings.notificationsEnabled`.
--
-- Destructive, and deliberately so: the column had an update endpoint but no control in
-- any screen, so nothing ever wrote anything but its `true` default. Leaving it in place
-- meant a row could hold `false` and silently stop every reminder while the Reminders
-- toggle still read "on". Nothing reads it, so there is no data of meaning to lose.

-- DropColumn
ALTER TABLE "UserSettings" DROP COLUMN "notificationsEnabled";
