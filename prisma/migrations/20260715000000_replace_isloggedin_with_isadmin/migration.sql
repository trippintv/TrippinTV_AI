-- AlterTable
ALTER TABLE "User" DROP COLUMN "isLoggedIn",
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;
