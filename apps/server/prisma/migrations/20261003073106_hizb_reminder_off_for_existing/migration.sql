-- The Hizb's daily reminder is on for accounts made from now on, but every account that exists
-- today starts with it off: those readers chose their reminders before the switch existed, and a
-- nightly notification they never asked for would arrive out of nowhere.
UPDATE "UserSettings" SET "hizbReminderEnabled" = false;
