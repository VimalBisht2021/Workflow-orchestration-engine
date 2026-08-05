-- CreateEnum
CREATE TYPE "BackoffStrategy" AS ENUM ('LINEAR', 'EXPONENTIAL', 'FIXED');

-- CreateTable
CREATE TABLE "TaskDefinition" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handler" TEXT NOT NULL,
    "configuration" JSONB,
    "dependencies" TEXT[],
    "maxRetries" INTEGER NOT NULL DEFAULT 0,
    "retryDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "backoffStrategy" "BackoffStrategy" NOT NULL DEFAULT 'FIXED',
    "timeoutMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskDefinition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaskDefinition" ADD CONSTRAINT "TaskDefinition_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
