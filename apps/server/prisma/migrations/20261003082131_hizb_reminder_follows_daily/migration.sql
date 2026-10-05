-- Corrects `hizb_reminder_off_for_existing`, which set the Hizb's reminder off for everyone. Until
-- this release the one daily reminder also counted a reader's Hizb groups, so an account that had
-- it on would have lost its Hizb reminder. Every account that exists now keeps what it had: the
-- Hizb's reminder on, at the same time, exactly when the daily reminder was — and off when it was
-- off, so nobody gets a notification they never asked for. Accounts made later start with it on.
UPDATE "UserSettings"
SET "hizbReminderEnabled" = "reminderEnabled",
    "hizbReminderTime" = "reminderTime";
