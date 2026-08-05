-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "WorkflowStatus" NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);
