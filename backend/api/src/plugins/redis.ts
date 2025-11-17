// src/plugins/redis.ts
import fp from 'fastify-plugin';
import fastifyRedis from '@fastify/redis';

const redisPlugin = fp(async (fastify) => {
  await fastify.register(fastifyRedis, {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });
});

export default redisPlugin;
