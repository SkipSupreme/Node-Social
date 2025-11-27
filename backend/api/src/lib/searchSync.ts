// src/lib/searchSync.ts
// Background sync service for MeiliSearch
import type { FastifyInstance } from 'fastify';

// Track sync failures for monitoring
let syncFailureCount = 0;
let lastSyncFailure: Date | null = null;

/**
 * Check if MeiliSearch is available
 */
export async function isMeiliAvailable(fastify: FastifyInstance): Promise<boolean> {
  try {
    if (!fastify.meilisearch) return false;
    await fastify.meilisearch.health();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get sync health stats
 */
export function getSyncHealth() {
  return {
    failureCount: syncFailureCount,
    lastFailure: lastSyncFailure,
  };
}

/**
 * Sync a post to MeiliSearch (fire-and-forget)
 */
export async function syncPostToMeili(
  fastify: FastifyInstance,
  postId: string
): Promise<void> {
  // Skip if MeiliSearch is not configured
  if (!fastify.meilisearch) {
    return;
  }

  try {
    const post = await fastify.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        content: true,
        title: true,
        authorId: true,
        nodeId: true,
        postType: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        author: {
          select: {
            username: true,
          },
        },
        node: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });

    if (!post) {
      return;
    }

    const index = fastify.meilisearch.index('posts');

    if (post.deletedAt) {
      // Remove from index if deleted
      await index.deleteDocument(postId);
      fastify.log.debug({ postId }, 'Removed post from MeiliSearch');
    } else {
      // Add or update in index with enriched data
      await index.addDocuments([
        {
          id: postId,
          content: post.content,
          title: post.title || '',
          authorId: post.authorId,
          authorUsername: post.author?.username || '',
          nodeId: post.nodeId || '',
          nodeSlug: post.node?.slug || '',
          nodeName: post.node?.name || '',
          postType: post.postType,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
          // Combine for full-text search
          searchableContent: `${post.title || ''} ${post.content}`.toLowerCase(),
        },
      ]);
      fastify.log.debug({ postId }, 'Synced post to MeiliSearch');
    }
  } catch (error) {
    // Track failure for monitoring
    syncFailureCount++;
    lastSyncFailure = new Date();
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
  if (!fastify.meilisearch) return;

  try {
    const index = fastify.meilisearch.index('posts');
    await index.deleteDocument(postId);
  } catch (error) {
    syncFailureCount++;
    lastSyncFailure = new Date();
    fastify.log.error({ err: error, postId }, 'Failed to remove post from MeiliSearch');
  }
}

/**
 * Ensure the posts index exists with proper settings
 */
export async function ensurePostsIndex(fastify: FastifyInstance): Promise<void> {
  if (!fastify.meilisearch) {
    fastify.log.warn('MeiliSearch not configured, skipping index setup');
    return;
  }

  try {
    const index = fastify.meilisearch.index('posts');

    // Create index if it doesn't exist
    try {
      await fastify.meilisearch.createIndex('posts', { primaryKey: 'id' });
      fastify.log.info('Created MeiliSearch posts index');
    } catch (e: any) {
      // Index already exists, that's fine
      if (!e.message?.includes('already exists')) {
        throw e;
      }
    }

    // Configure searchable and filterable attributes
    await index.updateSettings({
      searchableAttributes: ['searchableContent', 'title', 'content', 'authorUsername', 'nodeName'],
      filterableAttributes: ['authorId', 'nodeId', 'nodeSlug', 'postType', 'createdAt'],
      sortableAttributes: ['createdAt', 'updatedAt'],
    });

    fastify.log.info('MeiliSearch posts index configured');
  } catch (error) {
    fastify.log.error({ err: error }, 'Failed to configure MeiliSearch index');
  }
}

