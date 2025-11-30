// src/lib/searchSync.ts
// Background sync service for MeiliSearch with retry queue
import type { FastifyInstance } from 'fastify';

// Track sync failures for monitoring
let syncFailureCount = 0;
let lastSyncFailure: Date | null = null;

// Redis key for failed sync queue
const FAILED_SYNC_QUEUE = 'meilisearch:failed_syncs';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 30000; // 30 seconds

// Track retry processor state
let retryProcessorInterval: NodeJS.Timeout | null = null;

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
export async function getSyncHealth(fastify: FastifyInstance) {
  let queueLength = 0;
  try {
    if (fastify.redis) {
      queueLength = await fastify.redis.llen(FAILED_SYNC_QUEUE);
    }
  } catch {
    // Ignore redis errors for health check
  }

  return {
    failureCount: syncFailureCount,
    lastFailure: lastSyncFailure,
    pendingRetries: queueLength,
    retryProcessorRunning: retryProcessorInterval !== null,
  };
}

/**
 * Queue a failed sync for retry
 */
async function queueFailedSync(
  fastify: FastifyInstance,
  postId: string,
  attempt: number = 1
): Promise<void> {
  if (!fastify.redis) {
    fastify.log.warn({ postId }, 'Redis not available, cannot queue failed sync for retry');
    return;
  }

  if (attempt > MAX_RETRY_ATTEMPTS) {
    fastify.log.error({ postId, attempts: attempt }, 'Max retry attempts exceeded for post sync');
    return;
  }

  try {
    const item = JSON.stringify({ postId, attempt, queuedAt: Date.now() });
    await fastify.redis.rpush(FAILED_SYNC_QUEUE, item);
    fastify.log.info({ postId, attempt }, 'Queued post for MeiliSearch sync retry');
  } catch (error) {
    fastify.log.error({ err: error, postId }, 'Failed to queue sync retry');
  }
}

/**
 * Process the retry queue
 */
async function processRetryQueue(fastify: FastifyInstance): Promise<number> {
  if (!fastify.redis || !fastify.meilisearch) {
    return 0;
  }

  let processed = 0;

  // Check if MeiliSearch is available before processing
  const available = await isMeiliAvailable(fastify);
  if (!available) {
    fastify.log.debug('MeiliSearch unavailable, skipping retry queue processing');
    return 0;
  }

  // Process up to 10 items per cycle
  const maxBatchSize = 10;

  for (let i = 0; i < maxBatchSize; i++) {
    try {
      const item = await fastify.redis.lpop(FAILED_SYNC_QUEUE);
      if (!item) break;

      const { postId, attempt } = JSON.parse(item);
      fastify.log.debug({ postId, attempt }, 'Retrying failed MeiliSearch sync');

      try {
        await syncPostToMeiliInternal(fastify, postId);
        fastify.log.info({ postId, attempt }, 'Successfully retried MeiliSearch sync');
        processed++;
      } catch (error) {
        // Re-queue with incremented attempt
        await queueFailedSync(fastify, postId, attempt + 1);
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Error processing retry queue');
      break;
    }
  }

  return processed;
}

/**
 * Start the background retry processor
 */
export function startRetryProcessor(fastify: FastifyInstance): void {
  if (retryProcessorInterval) {
    fastify.log.warn('Retry processor already running');
    return;
  }

  retryProcessorInterval = setInterval(async () => {
    try {
      const processed = await processRetryQueue(fastify);
      if (processed > 0) {
        fastify.log.info({ processed }, 'Processed MeiliSearch retry queue');
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Error in retry processor');
    }
  }, RETRY_INTERVAL_MS);

  fastify.log.info({ intervalMs: RETRY_INTERVAL_MS }, 'Started MeiliSearch retry processor');
}

/**
 * Stop the background retry processor
 */
export function stopRetryProcessor(): void {
  if (retryProcessorInterval) {
    clearInterval(retryProcessorInterval);
    retryProcessorInterval = null;
  }
}

/**
 * Manually trigger retry queue processing
 */
export async function triggerRetryProcessing(fastify: FastifyInstance): Promise<number> {
  return processRetryQueue(fastify);
}

/**
 * Internal sync function that throws on error (for retry logic)
 */
async function syncPostToMeiliInternal(
  fastify: FastifyInstance,
  postId: string
): Promise<void> {
  if (!fastify.meilisearch) {
    throw new Error('MeiliSearch not configured');
  }

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
    // Post doesn't exist (might be deleted), nothing to sync
    return;
  }

  const index = fastify.meilisearch.index('posts');

  if (post.deletedAt) {
    // Remove from index if deleted
    await index.deleteDocument(postId);
    fastify.log.debug({ postId }, 'Removed post from MeiliSearch');
  } else {
    // Add or update in index with enriched data
    await index.addDocuments(
      [
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
      ],
      { primaryKey: 'id' }
    );
    fastify.log.debug({ postId }, 'Synced post to MeiliSearch');
  }
}

/**
 * Sync a post to MeiliSearch (fire-and-forget with retry on failure)
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
    await syncPostToMeiliInternal(fastify, postId);
  } catch (error) {
    // Track failure for monitoring
    syncFailureCount++;
    lastSyncFailure = new Date();
    fastify.log.error({ err: error, postId }, 'Failed to sync post to MeiliSearch');

    // Queue for retry
    await queueFailedSync(fastify, postId, 1);
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

// Canonical index settings - keep in sync with plugins/meilisearch.ts
const POSTS_INDEX_SETTINGS = {
  searchableAttributes: ['searchableContent', 'title', 'content', 'authorUsername', 'nodeName'],
  filterableAttributes: ['authorId', 'nodeId', 'nodeSlug', 'postType', 'createdAt'],
  sortableAttributes: ['createdAt', 'updatedAt'],
  rankingRules: [
    'words',
    'typo',
    'proximity',
    'attribute',
    'sort',
    'exactness',
    'createdAt:desc',
  ],
};

/**
 * Ensure the posts index exists with proper settings.
 * Note: The meilisearch plugin handles this on startup. This function is for
 * manual recovery or testing purposes.
 */
export async function ensurePostsIndex(fastify: FastifyInstance): Promise<void> {
  if (!fastify.meilisearch) {
    fastify.log.warn('MeiliSearch not configured, skipping index setup');
    return;
  }

  try {
    const client = fastify.meilisearch;

    // Create index if it doesn't exist
    try {
      const createTask = await client.createIndex('posts', { primaryKey: 'id' });
      await client.waitForTask(createTask.taskUid);
      fastify.log.info('Created MeiliSearch posts index');
    } catch (e: any) {
      if (e.code !== 'index_already_exists' && !e.message?.includes('already exists')) {
        throw e;
      }
    }

    // Configure index settings
    const index = client.index('posts');
    const settingsTask = await index.updateSettings(POSTS_INDEX_SETTINGS);
    await client.waitForTask(settingsTask.taskUid);
    fastify.log.info('MeiliSearch posts index configured');
  } catch (error) {
    fastify.log.error({ err: error }, 'Failed to configure MeiliSearch index');
  }
}

