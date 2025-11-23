// src/routes/search.ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

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
                author: { select: { id: true, email: true } }
              }
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Format response
        const formattedPosts = posts.map((post) => ({
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
};

export default searchRoutes;
