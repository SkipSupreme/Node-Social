// src/routes/search.ts
import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getSyncHealth, isMeiliAvailable, triggerRetryProcessing } from '../lib/searchSync.js';

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // Search posts (public endpoint)
  fastify.get(
    '/search/posts',
    {
      onRequest: [fastify.optionalAuthenticate],
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
        });

        // Reorder posts to match MeiliSearch relevance ordering
        const postMap = new Map(posts.map(p => [p.id, p]));
        const orderedPosts = postIds.map(id => postMap.get(id)).filter((p): p is NonNullable<typeof p> => p != null);

        // Format response
        // TODO: Fix strict typing for post with relations. Using explicit any to resolve implicit any error.
        const formattedPosts = orderedPosts.map((post) => ({
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

  // Search users by username (public endpoint)
  fastify.get(
    '/search/users',
    {
      onRequest: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const schema = z.object({
        q: z.string().min(1).max(50),
        limit: z.coerce.number().min(1).max(50).default(20),
        offset: z.coerce.number().min(0).default(0),
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error });
      }

      const { q, limit, offset } = parsed.data;

      try {
        // Search users by username (case-insensitive prefix/contains match)
        const users = await fastify.prisma.user.findMany({
          where: {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            era: true,
            cred: true,
            isBot: true,
            createdAt: true,
            _count: {
              select: {
                posts: true,
                followers: true,
                following: true,
              },
            },
          },
          orderBy: [
            // Prioritize exact username matches
            { username: 'asc' },
          ],
          take: limit + 1, // Fetch one extra to check if there's more
          skip: offset,
        });

        const hasMore = users.length > limit;
        const resultUsers = hasMore ? users.slice(0, limit) : users;

        // Format response
        const formattedUsers = resultUsers.map((user) => ({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          bio: user.bio,
          era: user.era,
          cred: user.cred,
          isBot: user.isBot,
          createdAt: user.createdAt,
          postCount: user._count.posts,
          followerCount: user._count.followers,
          followingCount: user._count.following,
        }));

        return reply.send({
          users: formattedUsers,
          hasMore,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : undefined;
        const stack = error instanceof Error ? error.stack : undefined;
        fastify.log.error({ err: error, message, stack }, 'User search failed');
        return reply.status(500).send({ error: 'Search failed', details: message });
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
