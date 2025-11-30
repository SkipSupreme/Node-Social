// src/plugins/meilisearch.ts
import fp from 'fastify-plugin';
import { MeiliSearch } from 'meilisearch';
import type { Config as MeiliConfig } from 'meilisearch';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    meilisearch: MeiliSearch;
  }
}

// Canonical index settings - keep in sync with backfillMeili.ts
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

const meilisearchPlugin = fp(async (fastify: FastifyInstance) => {
  const meiliUrl = process.env.MEILISEARCH_URL || 'http://localhost:7700';
  const meiliKey = process.env.MEILISEARCH_MASTER_KEY;

  const clientConfig: MeiliConfig = {
    host: meiliUrl,
    ...(meiliKey ? { apiKey: meiliKey } : {}),
  };

  const client = new MeiliSearch(clientConfig);

  // Test connection
  try {
    await client.health();
    fastify.log.info('MeiliSearch connected');
  } catch (error) {
    fastify.log.warn({ err: error }, 'MeiliSearch connection failed (will retry on use)');
    fastify.decorate('meilisearch', client);
    return;
  }

  fastify.decorate('meilisearch', client);

  // Initialize posts index on startup
  try {
    // Create index with explicit primary key if it doesn't exist
    try {
      const createTask = await client.createIndex('posts', { primaryKey: 'id' });
      await client.waitForTask(createTask.taskUid);
      fastify.log.info('Created MeiliSearch posts index');
    } catch (e: any) {
      if (e.code !== 'index_already_exists' && !e.message?.includes('already exists')) {
        throw e;
      }
      // Index exists - verify primary key is set
      const index = client.index('posts');
      const info = await index.fetchInfo();
      if (!info.primaryKey) {
        const updateTask = await index.update({ primaryKey: 'id' });
        await client.waitForTask(updateTask.taskUid);
        fastify.log.info('Set primary key on existing MeiliSearch posts index');
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
});

export default meilisearchPlugin;
