-- CreateTable
CREATE TABLE "ShareReadNotice" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareReadNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShareReadNotice_groupId_roundIndex_idx" ON "ShareReadNotice"("groupId", "roundIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ShareReadNotice_groupId_userId_roundIndex_key" ON "ShareReadNotice"("groupId", "userId", "roundIndex");

-- AddForeignKey
ALTER TABLE "ShareReadNotice" ADD CONSTRAINT "ShareReadNotice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
