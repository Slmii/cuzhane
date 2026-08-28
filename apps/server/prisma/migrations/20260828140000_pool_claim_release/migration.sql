-- A pool claim that ended because somebody joined the seat it was covering.
-- The push notification is the fast path; this row is the fallback that survives a denied
-- permission, a missing token or a phone that was off. Nothing else records the event:
-- joining clears `GroupBab.assignedUserId` and the claim leaves no other trace.
CREATE TABLE "PoolClaimRelease" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "startBab" INTEGER NOT NULL,
    "endBab" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "PoolClaimRelease_pkey" PRIMARY KEY ("id")
);

-- Reading is always "what has this user not seen yet".
CREATE INDEX "PoolClaimRelease_userId_seenAt_idx" ON "PoolClaimRelease"("userId", "seenAt");
CREATE INDEX "PoolClaimRelease_groupId_roundIndex_idx" ON "PoolClaimRelease"("groupId", "roundIndex");

-- Cascades with the group, like every other per-group table.
ALTER TABLE "PoolClaimRelease"
    ADD CONSTRAINT "PoolClaimRelease_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
