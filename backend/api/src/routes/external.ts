// Tier 5: External Platform Integration Routes
// API endpoints for fetching Bluesky and Mastodon feeds

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  fetchBlueskyDiscover,
  fetchBlueskyFeed,
  fetchBlueskyUserPosts,
  fetchBlueskyThread,
  fetchMastodonFeed,
  fetchMastodonTrending,
  fetchMastodonContext,
  fetchCombinedFeed,
} from '../services/externalFeedService.js';

const externalRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================
  // BLUESKY ENDPOINTS
  // ============================================

  // Get Bluesky "What's Hot" feed
  fastify.get(
    '/bluesky/discover',
    {
      // Public endpoint - no auth required
    },
    async (request, reply) => {
      const schema = z.object({
        limit: z.coerce.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { limit, cursor } = parsed.data;
      const result = await fetchBlueskyDiscover(limit, cursor);

      return reply.send(result);
    }
  );

  // Get posts from a specific Bluesky feed
  fastify.get(
    '/bluesky/feed',
    async (request, reply) => {
      const schema = z.object({
        feed: z.string().optional(), // AT URI of feed generator
        limit: z.coerce.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { feed, limit, cursor } = parsed.data;
      const result = await fetchBlueskyFeed(feed, limit, cursor);

      return reply.send(result);
    }
  );

  // Get posts from a specific Bluesky user
  fastify.get(
    '/bluesky/user/:handle',
    async (request, reply) => {
      const paramsSchema = z.object({
        handle: z.string().min(1),
      });
      const querySchema = z.object({
        limit: z.coerce.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      });

      const paramsResult = paramsSchema.safeParse(request.params);
      const queryResult = querySchema.safeParse(request.query);

      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({ error: 'Invalid parameters' });
      }

      const { handle } = paramsResult.data;
      const { limit, cursor } = queryResult.data;
      const result = await fetchBlueskyUserPosts(handle, limit, cursor);

      return reply.send(result);
    }
  );

  // Get thread/replies for a Bluesky post
  fastify.get(
    '/bluesky/thread',
    async (request, reply) => {
      const schema = z.object({
        uri: z.string(), // AT URI of the post
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters - uri required' });
      }

      const { uri } = parsed.data;
      const result = await fetchBlueskyThread(uri);

      return reply.send(result);
    }
  );

  // ============================================
  // MASTODON ENDPOINTS
  // ============================================

  // Get Mastodon public timeline
  fastify.get(
    '/mastodon/timeline',
    async (request, reply) => {
      const schema = z.object({
        instance: z.string().default('mastodon.social'),
        timeline: z.enum(['public', 'local']).default('public'),
        limit: z.coerce.number().min(1).max(50).default(20),
        cursor: z.string().optional(), // max_id for pagination
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { instance, timeline, limit, cursor } = parsed.data;
      const result = await fetchMastodonFeed(instance, timeline, limit, cursor);

      return reply.send(result);
    }
  );

  // Get Mastodon trending posts
  fastify.get(
    '/mastodon/trending',
    async (request, reply) => {
      const schema = z.object({
        instance: z.string().default('mastodon.social'),
        limit: z.coerce.number().min(1).max(50).default(20),
        offset: z.coerce.number().min(0).default(0),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { instance, limit, offset } = parsed.data;
      const result = await fetchMastodonTrending(instance, limit, offset);

      return reply.send(result);
    }
  );

  // Get thread/replies for a Mastodon post
  fastify.get(
    '/mastodon/thread',
    async (request, reply) => {
      const schema = z.object({
        instance: z.string().default('mastodon.social'),
        statusId: z.string(), // Status ID
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters - statusId required' });
      }

      const { instance, statusId } = parsed.data;
      const result = await fetchMastodonContext(instance, statusId);

      return reply.send(result);
    }
  );

  // ============================================
  // COMBINED FEED
  // ============================================

  // Get combined feed from multiple platforms
  fastify.get(
    '/combined',
    async (request, reply) => {
      const schema = z.object({
        limit: z.coerce.number().min(1).max(50).default(20),
        platforms: z.string().optional(), // comma-separated: "bluesky,mastodon"
        mastodonInstance: z.string().optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }

      const { limit, platforms, mastodonInstance } = parsed.data;

      // Parse platforms
      const platformList = platforms
        ? platforms.split(',').map(p => p.trim().toLowerCase())
        : ['bluesky', 'mastodon'];

      const sources: Array<{ platform: 'bluesky' | 'mastodon'; config?: any }> = [];

      if (platformList.includes('bluesky')) {
        sources.push({ platform: 'bluesky' });
      }
      if (platformList.includes('mastodon')) {
        sources.push({
          platform: 'mastodon',
          config: { instance: mastodonInstance || 'mastodon.social' },
        });
      }

      if (sources.length === 0) {
        return reply.status(400).send({ error: 'At least one platform must be specified' });
      }

      const posts = await fetchCombinedFeed(sources, limit);

      return reply.send({
        posts,
        platforms: platformList,
      });
    }
  );

  // ============================================
  // AVAILABLE FEEDS METADATA
  // ============================================

  // Get list of available external feeds
  fastify.get(
    '/available',
    async (request, reply) => {
      return reply.send({
        platforms: [
          {
            id: 'bluesky',
            name: 'Bluesky',
            icon: '🦋',
            feeds: [
              { id: 'discover', name: "What's Hot", description: 'Popular posts from Bluesky' },
              { id: 'user', name: 'User Feed', description: 'Posts from a specific user', requiresHandle: true },
            ],
          },
          {
            id: 'mastodon',
            name: 'Mastodon',
            icon: '🦣',
            feeds: [
              { id: 'public', name: 'Federated', description: 'Public posts from across the Fediverse' },
              { id: 'local', name: 'Local', description: 'Posts from a specific instance' },
              { id: 'trending', name: 'Trending', description: 'Currently trending posts' },
            ],
            popularInstances: [
              'mastodon.social',
              'mas.to',
              'hachyderm.io',
              'fosstodon.org',
              'infosec.exchange',
              'techhub.social',
            ],
          },
        ],
      });
    }
  );
};

export default externalRoutes;
