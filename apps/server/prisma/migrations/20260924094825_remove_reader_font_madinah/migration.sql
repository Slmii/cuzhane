/*
  Warnings:

  - The values [madinah] on the enum `ReaderArabicFont` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReaderArabicFont_new" AS ENUM ('naskh', 'amiri', 'uthman');
ALTER TABLE "public"."UserSettings" ALTER COLUMN "readerArabicFont" DROP DEFAULT;
ALTER TABLE "UserSettings" ALTER COLUMN "readerArabicFont" TYPE "ReaderArabicFont_new" USING ("readerArabicFont"::text::"ReaderArabicFont_new");
ALTER TYPE "ReaderArabicFont" RENAME TO "ReaderArabicFont_old";
ALTER TYPE "ReaderArabicFont_new" RENAME TO "ReaderArabicFont";
DROP TYPE "public"."ReaderArabicFont_old";
ALTER TABLE "UserSettings" ALTER COLUMN "readerArabicFont" SET DEFAULT 'uthman';
COMMIT;
