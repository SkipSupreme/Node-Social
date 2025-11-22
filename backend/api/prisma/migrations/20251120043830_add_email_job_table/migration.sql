-- CreateEnum
CREATE TYPE "EmailTemplate" AS ENUM ('VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "template" "EmailTemplate" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailJob_status_nextAttemptAt_idx" ON "EmailJob"("status", "nextAttemptAt");
