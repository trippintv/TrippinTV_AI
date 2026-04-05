-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastVoteAt" TIMESTAMP(3),
ADD COLUMN     "voteStreak" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "category" TEXT;
