import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  getVelocitySpikes,
  getRisingNodes,
  getNodeRecommendations,
  getPopularNodes,
  getNodeTrendingHashtags,
} from '../services/trendingService.js';

const trendingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /trending/vibes
   * Get velocity spikes - which vibes are accelerating fastest across nodes
   */
  fastify.get('/trending/vibes', async (request, reply) => {
    const spikes = await getVelocitySpikes(fastify.prisma, 5);

    // Enrich with hashtags for top 3 spikes
    const enrichedSpikes = await Promise.all(
      spikes.slice(0, 3).map(async (spike) => {
        const hashtags = await getNodeTrendingHashtags(
          fastify.prisma,
          spike.nodeId,
          3
        );
        return { ...spike, hashtags };
      })
    );

    // Combine enriched + remaining
    const finalSpikes = [
      ...enrichedSpikes,
      ...spikes.slice(3),
    ];

    return {
      spikes: finalSpikes,
      calculatedAt: new Date().toISOString(),
    };
  });

  /**
   * GET /trending/nodes
   * Get fastest growing nodes by member count
   */
  fastify.get('/trending/nodes', async (request, reply) => {
    const nodes = await getRisingNodes(fastify.prisma, 5);

    return {
      nodes,
      calculatedAt: new Date().toISOString(),
    };
  });

  /**
   * GET /discover/nodes
   * Authenticated: personalized recommendations (excludes user's nodes)
   * Anonymous: popular nodes sorted by member count
   */
  fastify.get('/discover/nodes', {
    preHandler: [fastify.optionalAuthenticate],
  }, async (request, reply) => {
    const userId = (request.user as { sub: string } | undefined)?.sub;

    const recommendations = userId
      ? await getNodeRecommendations(fastify.prisma, userId, 50)
      : await getPopularNodes(fastify.prisma, new Set(), 50);

    return {
      recommendations,
      calculatedAt: new Date().toISOString(),
    };
  });
};

export default trendingRoutes;
