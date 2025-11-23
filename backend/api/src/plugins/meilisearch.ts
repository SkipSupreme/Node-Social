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
  }

  fastify.decorate('meilisearch', client);

  // Initialize posts index on startup
  try {
    const index = client.index('posts');
    await index.updateSettings({
      searchableAttributes: ['content', 'title'],
      filterableAttributes: ['nodeId', 'authorId', 'createdAt'],
      sortableAttributes: ['createdAt'],
    });
    fastify.log.info('MeiliSearch posts index configured');
  } catch (error) {
    fastify.log.warn({ err: error }, 'Failed to configure MeiliSearch index (may already exist)');
  }
});

export default meilisearchPlugin;
