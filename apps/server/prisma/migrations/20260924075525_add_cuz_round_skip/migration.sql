-- CreateTable
CREATE TABLE "CuzRoundSkip" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuzRoundSkip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuzRoundSkip_userId_idx" ON "CuzRoundSkip"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CuzRoundSkip_groupId_userId_roundIndex_key" ON "CuzRoundSkip"("groupId", "userId", "roundIndex");

-- AddForeignKey
ALTER TABLE "CuzRoundSkip" ADD CONSTRAINT "CuzRoundSkip_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
