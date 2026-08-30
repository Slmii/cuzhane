/*
  Warnings:

  - The values [lateef] on the enum `ReaderArabicFont` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReaderArabicFont_new" AS ENUM ('naskh', 'scheherazade', 'amiri');
ALTER TABLE "public"."UserSettings" ALTER COLUMN "readerArabicFont" DROP DEFAULT;
ALTER TABLE "UserSettings" ALTER COLUMN "readerArabicFont" TYPE "ReaderArabicFont_new" USING ("readerArabicFont"::text::"ReaderArabicFont_new");
ALTER TYPE "ReaderArabicFont" RENAME TO "ReaderArabicFont_old";
ALTER TYPE "ReaderArabicFont_new" RENAME TO "ReaderArabicFont";
DROP TYPE "public"."ReaderArabicFont_old";
ALTER TABLE "UserSettings" ALTER COLUMN "readerArabicFont" SET DEFAULT 'scheherazade';
COMMIT;
