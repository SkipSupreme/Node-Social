/*
  Warnings:

  - You are about to drop the column `postType` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `visibility` on the `posts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "posts" DROP COLUMN "postType",
DROP COLUMN "title",
DROP COLUMN "visibility",
ADD COLUMN     "linkMetaId" TEXT,
ADD COLUMN     "linkUrl" TEXT;

-- CreateTable
CREATE TABLE "link_metadata" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "image" TEXT,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "link_metadata_url_key" ON "link_metadata"("url");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_linkMetaId_fkey" FOREIGN KEY ("linkMetaId") REFERENCES "link_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;
