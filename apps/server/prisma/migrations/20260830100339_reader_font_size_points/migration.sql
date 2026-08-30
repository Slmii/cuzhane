/*
  Warnings:

  - You are about to drop the column `readerFontScale` on the `UserSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "readerFontScale",
ADD COLUMN     "readerFontSize" INTEGER NOT NULL DEFAULT 23;
