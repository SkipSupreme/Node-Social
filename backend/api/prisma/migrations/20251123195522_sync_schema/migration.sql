/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - The required column `username` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "connoisseurCred" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "era" TEXT NOT NULL DEFAULT 'Lurker Era',
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "theme" TEXT,
ADD COLUMN     "username" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "federated_identities" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "mod_action_logs" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mod_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feed_preferences" (
    "userId" TEXT NOT NULL,
    "qualityWeight" DOUBLE PRECISION NOT NULL DEFAULT 35.0,
    "recencyWeight" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "engagementWeight" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "personalizationWeight" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "presetMode" TEXT,
    "recencyHalfLife" TEXT NOT NULL DEFAULT '12h',
    "followingOnly" BOOLEAN NOT NULL DEFAULT false,
    "minConnoisseurCred" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_feed_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "vibe_vectors" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vibe_vectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_vibe_weights" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "vectorId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "node_vibe_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vibe_reactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "nodeId" TEXT NOT NULL,
    "intensities" JSONB NOT NULL,
    "totalIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vibe_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mod_action_logs_targetType_targetId_idx" ON "mod_action_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "mod_action_logs_moderatorId_idx" ON "mod_action_logs"("moderatorId");

-- CreateIndex
CREATE INDEX "mod_action_logs_createdAt_idx" ON "mod_action_logs"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vibe_vectors_slug_key" ON "vibe_vectors"("slug");

-- CreateIndex
CREATE INDEX "node_vibe_weights_nodeId_idx" ON "node_vibe_weights"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "node_vibe_weights_nodeId_vectorId_key" ON "node_vibe_weights"("nodeId", "vectorId");

-- CreateIndex
CREATE INDEX "vibe_reactions_postId_nodeId_idx" ON "vibe_reactions"("postId", "nodeId");

-- CreateIndex
CREATE INDEX "vibe_reactions_commentId_nodeId_idx" ON "vibe_reactions"("commentId", "nodeId");

-- CreateIndex
CREATE INDEX "vibe_reactions_userId_createdAt_idx" ON "vibe_reactions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "vibe_reactions_userId_postId_nodeId_idx" ON "vibe_reactions"("userId", "postId", "nodeId");

-- CreateIndex
CREATE INDEX "vibe_reactions_userId_commentId_nodeId_idx" ON "vibe_reactions"("userId", "commentId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "user_feed_preferences" ADD CONSTRAINT "user_feed_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_vibe_weights" ADD CONSTRAINT "node_vibe_weights_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_vibe_weights" ADD CONSTRAINT "node_vibe_weights_vectorId_fkey" FOREIGN KEY ("vectorId") REFERENCES "vibe_vectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_reactions" ADD CONSTRAINT "vibe_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_reactions" ADD CONSTRAINT "vibe_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_reactions" ADD CONSTRAINT "vibe_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_reactions" ADD CONSTRAINT "vibe_reactions_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
