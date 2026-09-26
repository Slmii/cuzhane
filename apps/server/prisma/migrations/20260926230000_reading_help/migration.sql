ALTER TABLE "HizbAssignment" ADD COLUMN "completedByUserId" TEXT;
CREATE TABLE "ReadingHelp" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "groupId" TEXT NOT NULL,
 "requesterUserId" TEXT NOT NULL,
 "helperUserId" TEXT,
 "targetKey" TEXT NOT NULL,
 "assignmentId" TEXT,
 "roundIndex" INTEGER,
 "babNumbers" INTEGER[] NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReadingHelp_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ReadingHelp_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HizbAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReadingHelp_assignmentId_key" ON "ReadingHelp"("assignmentId");
CREATE UNIQUE INDEX "ReadingHelp_groupId_requesterUserId_targetKey_key" ON "ReadingHelp"("groupId", "requesterUserId", "targetKey");
CREATE INDEX "ReadingHelp_groupId_createdAt_idx" ON "ReadingHelp"("groupId", "createdAt");
