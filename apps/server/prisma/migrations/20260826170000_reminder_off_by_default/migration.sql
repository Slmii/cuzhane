-- A new account has never seen the OS notification prompt, so the daily reminder starts
-- off. Existing rows keep whatever the person already chose.
ALTER TABLE "UserSettings" ALTER COLUMN "reminderEnabled" SET DEFAULT false;
