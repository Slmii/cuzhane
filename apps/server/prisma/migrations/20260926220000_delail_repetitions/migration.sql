ALTER TABLE "HizbAssignment" ADD COLUMN "delailRepetitions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HizbAssignment" ADD CONSTRAINT "HizbAssignment_delail_valid" CHECK ("delailRepetitions" BETWEEN 0 AND 3);
