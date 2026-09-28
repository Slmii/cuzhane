-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "hatimGroupReadsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hatimPoolClaimEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hatimRoundCompleteEnabled" BOOLEAN NOT NULL DEFAULT true;
