/*
  Warnings:

  - You are about to drop the column `retryCount` on the `TaskRun` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TaskRun" DROP COLUMN "retryCount",
ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0;
