-- CreateEnum
CREATE TYPE "GroupVisibility" AS ENUM ('OPEN', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GroupSplitMode" AS ENUM ('FIXED', 'FREE');

-- CreateEnum
CREATE TYPE "GroupCycle" AS ENUM ('DAILY', 'WEEKLY', 'ONE_OFF', 'OPEN_ENDED');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "AppLanguage" AS ENUM ('tr', 'en');

-- CreateTable
CREATE TABLE
    "Group" (
        "id" TEXT NOT NULL,
        "ownerUserId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "dedication" TEXT,
        "visibility" "GroupVisibility" NOT NULL DEFAULT 'OPEN',
        "splitMode" "GroupSplitMode" NOT NULL DEFAULT 'FIXED',
        "cycle" "GroupCycle" NOT NULL DEFAULT 'WEEKLY',
        "spots" INTEGER NOT NULL DEFAULT 20,
        "inviteCode" TEXT NOT NULL,
        "openToJoin" BOOLEAN NOT NULL DEFAULT true,
        "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
        "reminderTime" TEXT NOT NULL DEFAULT '21:30',
        "nudgeEnabled" BOOLEAN NOT NULL DEFAULT true,
        "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endsAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "GroupMember" (
        "id" TEXT NOT NULL,
        "groupId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "displayName" TEXT NOT NULL,
        "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
        "slotIndex" INTEGER NOT NULL,
        "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "GroupBab" (
        "id" TEXT NOT NULL,
        "groupId" TEXT NOT NULL,
        "number" INTEGER NOT NULL,
        "assignedUserId" TEXT,
        "readByUserId" TEXT,
        "readAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "GroupBab_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "Cheer" (
        "id" TEXT NOT NULL,
        "groupId" TEXT NOT NULL,
        "fromUserId" TEXT NOT NULL,
        "toUserId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Cheer_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "GroupWaitlistEntry" (
        "id" TEXT NOT NULL,
        "groupId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GroupWaitlistEntry_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "UserSettings" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "language" "AppLanguage" NOT NULL DEFAULT 'en',
        "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
        "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
        "reminderTime" TEXT NOT NULL DEFAULT '21:30',
        "nudgeEnabled" BOOLEAN NOT NULL DEFAULT true,
        "hasSeenOnboarding" BOOLEAN NOT NULL DEFAULT false,
        "readerFontScale" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "PushToken" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
    );

-- CreateIndex
CREATE UNIQUE INDEX "Group_inviteCode_key" ON "Group" ("inviteCode");

-- CreateIndex
CREATE INDEX "Group_ownerUserId_idx" ON "Group" ("ownerUserId");

-- CreateIndex
CREATE INDEX "Group_visibility_openToJoin_createdAt_idx" ON "Group" ("visibility", "openToJoin", "createdAt");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember" ("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember" ("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_slotIndex_key" ON "GroupMember" ("groupId", "slotIndex");

-- CreateIndex
CREATE INDEX "GroupBab_groupId_assignedUserId_idx" ON "GroupBab" ("groupId", "assignedUserId");

-- CreateIndex
CREATE INDEX "GroupBab_groupId_readAt_idx" ON "GroupBab" ("groupId", "readAt");

-- CreateIndex
CREATE INDEX "GroupBab_readByUserId_readAt_idx" ON "GroupBab" ("readByUserId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBab_groupId_number_key" ON "GroupBab" ("groupId", "number");

-- CreateIndex
CREATE INDEX "Cheer_groupId_toUserId_idx" ON "Cheer" ("groupId", "toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Cheer_groupId_fromUserId_toUserId_key" ON "Cheer" ("groupId", "fromUserId", "toUserId");

-- CreateIndex
CREATE INDEX "GroupWaitlistEntry_userId_idx" ON "GroupWaitlistEntry" ("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupWaitlistEntry_groupId_userId_key" ON "GroupWaitlistEntry" ("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings" ("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken" ("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken" ("userId");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBab" ADD CONSTRAINT "GroupBab_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupWaitlistEntry" ADD CONSTRAINT "GroupWaitlistEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
