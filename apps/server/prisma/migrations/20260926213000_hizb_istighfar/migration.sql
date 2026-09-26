ALTER TABLE "HizbAssignment" ADD COLUMN "istighfarRepetitions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "istighfarTarget" INTEGER NOT NULL DEFAULT 11;
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_istighfar_valid"
CHECK ("istighfarRepetitions" BETWEEN 0 AND 100 AND "istighfarTarget" IN (11,33,100));
