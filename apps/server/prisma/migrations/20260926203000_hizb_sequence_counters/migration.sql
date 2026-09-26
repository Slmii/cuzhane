ALTER TABLE "Group" ADD COLUMN "hizbNext7" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "hizbNext15" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "hizbNext33" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "inactivitySinceDay" INTEGER;
UPDATE "Group" g SET "hizbNext7" = COALESCE((SELECT MAX(sequence)+1 FROM "HizbEnrollment" e WHERE e."groupId"=g.id AND e."planDays"=7),0),
"hizbNext15" = COALESCE((SELECT MAX(sequence)+1 FROM "HizbEnrollment" e WHERE e."groupId"=g.id AND e."planDays"=15),0),
"hizbNext33" = COALESCE((SELECT MAX(sequence)+1 FROM "HizbEnrollment" e WHERE e."groupId"=g.id AND e."planDays"=33),0);
