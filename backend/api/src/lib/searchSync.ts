// src/lib/searchSync.ts
// Background sync service for MeiliSearch
import type { FastifyInstance } from 'fastify';

/**
 * Sync a post to MeiliSearch (fire-and-forget)
 */
export async function syncPostToMeili(
  fastify: FastifyInstance,
  postId: string
): Promise<void> {
  try {
    const post = await fastify.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        content: true,
        title: true,
        authorId: true,
        nodeId: true,
        createdAt: true,
        deletedAt: true,
      },
    });

    if (!post) {
      return;
    }

    const index = fastify.meilisearch.index('posts');

    if (post.deletedAt) {
      // Remove from index if deleted
      await index.deleteDocument(postId);
    } else {
      // Add or update in index
      await index.addDocuments([
        {
          id: postId,
          content: post.content,
          title: post.title || '',
          authorId: post.authorId,
          nodeId: post.nodeId || '',
          createdAt: post.createdAt.toISOString(),
        },
      ]);
    }
  } catch (error) {
    // Log but don't throw - search sync shouldn't break the API
    fastify.log.error({ err: error, postId }, 'Failed to sync post to MeiliSearch');
  }
}

/**
 * Remove a post from MeiliSearch (fire-and-forget)
 */
export async function removePostFromMeili(
  fastify: FastifyInstance,
  postId: string
): Promise<void> {
  try {
    const index = fastify.meilisearch.index('posts');
    await index.deleteDocument(postId);
  } catch (error) {
    fastify.log.error({ err: error, postId }, 'Failed to remove post from MeiliSearch');
  }
}

