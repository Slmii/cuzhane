-- CreateTable
CREATE TABLE "RoundCompleteNotice" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundCompleteNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundCompleteNotice_groupId_roundIndex_key" ON "RoundCompleteNotice"("groupId", "roundIndex");

-- AddForeignKey
ALTER TABLE "RoundCompleteNotice" ADD CONSTRAINT "RoundCompleteNotice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
