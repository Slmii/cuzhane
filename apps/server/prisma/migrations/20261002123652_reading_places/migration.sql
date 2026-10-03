-- CreateTable
CREATE TABLE "ReadingPlace" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "position" INTEGER,
    "textPagesRead" INTEGER NOT NULL DEFAULT 0,
    "husrevPagesRead" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingPlace_userId_idx" ON "ReadingPlace"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingPlace_groupId_userId_roundIndex_unitNumber_key" ON "ReadingPlace"("groupId", "userId", "roundIndex", "unitNumber");

-- AddForeignKey
ALTER TABLE "ReadingPlace" ADD CONSTRAINT "ReadingPlace_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
