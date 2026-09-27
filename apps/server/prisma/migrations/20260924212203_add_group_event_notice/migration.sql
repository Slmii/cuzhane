-- CreateTable
CREATE TABLE "GroupEventNotice" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupEventNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupEventNotice_groupId_actorUserId_kind_roundIndex_subjec_key" ON "GroupEventNotice"("groupId", "actorUserId", "kind", "roundIndex", "subject");

-- AddForeignKey
ALTER TABLE "GroupEventNotice" ADD CONSTRAINT "GroupEventNotice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
