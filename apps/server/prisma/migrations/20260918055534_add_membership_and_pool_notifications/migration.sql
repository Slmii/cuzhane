-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'POOL_BAB_CLAIMED';
ALTER TYPE "NotificationKind" ADD VALUE 'MEMBER_JOINED';
ALTER TYPE "NotificationKind" ADD VALUE 'MEMBER_LEFT';

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "memberJoinedEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memberLeftEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "poolClaimEnabled" BOOLEAN NOT NULL DEFAULT false;
