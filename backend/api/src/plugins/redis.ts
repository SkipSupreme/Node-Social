// src/plugins/redis.ts
import fp from 'fastify-plugin';
import fastifyRedis from '@fastify/redis';
import type { FastifyRedis } from '@fastify/redis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: FastifyRedis;
  }
}

const redisPlugin = fp(async (fastify) => {
  await fastify.register(fastifyRedis, {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enableAutoPipelining: true,   // Batch concurrent commands into fewer TCP round trips
    keepAlive: 10_000,            // TCP keepalive every 10s (prevents NAT/firewall timeout)
    lazyConnect: true,            // Defer connection until first command (faster startup)
    maxRetriesPerRequest: 3,      // Fail fast on transient errors (default 20 is too patient)
  });
});

export default redisPlugin;
