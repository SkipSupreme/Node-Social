-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "postType" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public';
