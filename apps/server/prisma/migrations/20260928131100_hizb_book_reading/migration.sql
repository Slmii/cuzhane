-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "readsFromBook" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HizbAssignment" ADD COLUMN     "readFrom" TEXT,
ADD COLUMN     "readPortions" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Rules Prisma cannot express, as in `hizb_constraints`. The istighfar target is any count from
-- 1 to 100 ("Sayıyı gir"), no longer only 11, 33 or 100.
ALTER TABLE "HizbAssignment" DROP CONSTRAINT "HizbAssignment_istighfar_valid";
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_istighfar_valid"
CHECK ("istighfarRepetitions" BETWEEN 0 AND 100 AND "istighfarTarget" BETWEEN 1 AND 100);
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_readFrom_valid"
CHECK ("readFrom" IS NULL OR "readFrom" IN ('APP', 'BOOK'));
