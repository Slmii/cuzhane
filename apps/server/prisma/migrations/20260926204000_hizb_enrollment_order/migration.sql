ALTER TABLE "HizbEnrollment" ADD COLUMN "ordinal" INTEGER NOT NULL DEFAULT 0;
WITH numbered AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY "groupId" ORDER BY "createdAt", id) AS ordinal FROM "HizbEnrollment")
UPDATE "HizbEnrollment" e SET ordinal=n.ordinal FROM numbered n WHERE e.id=n.id;
UPDATE "Group" g SET "hizbNextSlot"=GREATEST("hizbNextSlot",COALESCE((SELECT MAX(ordinal)+1 FROM "HizbEnrollment" e WHERE e."groupId"=g.id),1));
