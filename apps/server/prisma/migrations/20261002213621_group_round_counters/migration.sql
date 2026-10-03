-- CreateTable
CREATE TABLE "GroupRoundCounter" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "delailCount" INTEGER NOT NULL DEFAULT 0,
    "istighfarCount" INTEGER NOT NULL DEFAULT 0,
    "istighfarTarget" INTEGER NOT NULL DEFAULT 11,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupRoundCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupRoundCounter_userId_idx" ON "GroupRoundCounter"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoundCounter_groupId_userId_roundIndex_key" ON "GroupRoundCounter"("groupId", "userId", "roundIndex");

-- AddForeignKey
ALTER TABLE "GroupRoundCounter" ADD CONSTRAINT "GroupRoundCounter_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
