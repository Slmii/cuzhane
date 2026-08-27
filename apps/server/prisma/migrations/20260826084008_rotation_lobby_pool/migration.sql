-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('GATHERING', 'RUNNING');

-- AlterEnum
ALTER TYPE "GroupSplitMode" ADD VALUE 'ROTATION';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "autoStartWhenFull" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "GroupStatus" NOT NULL DEFAULT 'GATHERING',
ALTER COLUMN "splitMode" SET DEFAULT 'ROTATION';
