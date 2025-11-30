// src/routes/search.ts
import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getSyncHealth, isMeiliAvailable, triggerRetryProcessing } from '../lib/searchSync.js';

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // Search posts
  fastify.get(
    '/search/posts',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const schema = z.object({
        q: z.string().min(1).max(200),
        limit: z.coerce.number().min(1).max(50).default(20),
        offset: z.coerce.number().min(0).default(0),
        nodeId: z.string().uuid().optional(),
        authorId: z.string().uuid().optional(),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
      }

      const { q, limit, offset, nodeId, authorId } = parsed.data;

      try {
        const index = fastify.meilisearch.index('posts');

        // Build filters
        const filters: string[] = [];
        if (nodeId) filters.push(`nodeId = "${nodeId}"`);
        if (authorId) filters.push(`authorId = "${authorId}"`);

        // Search MeiliSearch
        const filter = filters.length > 0 ? filters.join(' AND ') : undefined;
        const searchParams: {
          limit: number;
          offset: number;
          filter?: string;
          sort: string[];
        } = {
          limit,
          offset,
          sort: ['createdAt:desc'],
        };
        if (filter !== undefined) {
          searchParams.filter = filter;
        }

        const searchResults = await index.search(q, searchParams);

        // Extract post IDs
        const postIds = searchResults.hits.map((hit) => hit.id);

        if (postIds.length === 0) {
          return reply.send({
            posts: [],
            total: 0,
            hasMore: false,
          });
        }

        // Fetch full posts from Postgres (with relations)
        const posts = await fastify.prisma.post.findMany({
          where: {
            id: { in: postIds },
            deletedAt: null,
          },
          include: {
            author: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                era: true,
                cred: true,
              },
            },
            node: true,
            _count: {
              select: { comments: true },
            },
            comments: {
              take: 3,
              orderBy: { createdAt: 'desc' },
              include: {
                author: {
                  select: {
                    id: true,
                    email: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    era: true,
                    cred: true,
                  }
                }
              }
            },
            vibeAggregate: true,
            poll: {
              include: {
                options: {
                  include: {
                    _count: { select: { votes: true } }
                  }
                }
              }
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Format response
        // TODO: Fix strict typing for post with relations. Using explicit any to resolve implicit any error.
        const formattedPosts = posts.map((post: any) => ({
          ...post,
          commentCount: post._count.comments,
          _count: undefined,
        }));

        return reply.send({
          posts: formattedPosts,
          total: searchResults.estimatedTotalHits,
          hasMore: offset + limit < searchResults.estimatedTotalHits,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'MeiliSearch query failed');
        return reply.status(500).send({ error: 'Search service unavailable' });
      }
    }
  );

  // Search health check - check MeiliSearch status and sync queue
  fastify.get('/search/health', async (request, reply) => {
    const [meiliAvailable, syncHealth] = await Promise.all([
      isMeiliAvailable(fastify),
      getSyncHealth(fastify),
    ]);

    let indexStats = null;
    if (meiliAvailable) {
      try {
        const index = fastify.meilisearch.index('posts');
        indexStats = await index.getStats();
      } catch {
        // Ignore errors fetching stats
      }
    }

    return reply.send({
      meilisearch: {
        available: meiliAvailable,
        indexStats,
      },
      sync: syncHealth,
    });
  });

  // Manually trigger retry queue processing (for admin use)
  fastify.post(
    '/search/retry',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const processed = await triggerRetryProcessing(fastify);
      return reply.send({
        processed,
        message: `Processed ${processed} items from retry queue`,
      });
    }
  );
};

export default searchRoutes;
