-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('CEVSEN', 'HIZB');

-- AlterEnum
ALTER TYPE "GroupCycle" ADD VALUE 'MONTHLY';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "kind" "GroupKind" NOT NULL DEFAULT 'CEVSEN';
