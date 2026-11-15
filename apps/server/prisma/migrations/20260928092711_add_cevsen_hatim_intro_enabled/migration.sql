-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "cevsenIntroEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hatimIntroEnabled" BOOLEAN NOT NULL DEFAULT true;
