-- CreateTable
CREATE TABLE "GroupPartRepetition" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPartRepetition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupPartRepetition_userId_idx" ON "GroupPartRepetition"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPartRepetition_groupId_userId_roundIndex_partNumber_key" ON "GroupPartRepetition"("groupId", "userId", "roundIndex", "partNumber");

-- AddForeignKey
ALTER TABLE "GroupPartRepetition" ADD CONSTRAINT "GroupPartRepetition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
