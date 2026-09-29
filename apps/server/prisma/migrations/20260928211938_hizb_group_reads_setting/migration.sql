-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "hizbGroupReadsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Hizb groups answered to the Cevşen switch until now: everyone keeps what they had.
UPDATE "UserSettings" SET "hizbGroupReadsEnabled" = "groupReadsEnabled";
