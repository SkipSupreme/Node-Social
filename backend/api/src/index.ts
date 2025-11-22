// src/index.ts
import 'dotenv/config'; // loads .env
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import meilisearchPlugin from './plugins/meilisearch.js';
import authRoutes from './routes/auth.js';
import nodeRoutes from './routes/nodes.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import feedPreferenceRoutes from './routes/feedPreferences.js';
import searchRoutes from './routes/search.js';
import moderationRoutes from './routes/moderation.js';
import reactionRoutes from './routes/reactions.js';
import { registerEmailQueue } from './lib/emailQueue.js';

const app = Fastify({ logger: true });

// plugins
// CORS: Allow all origins in dev, or specific domains in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : true; // true = allow all (dev mode)
app.register(cors, { origin: allowedOrigins });
app.register(redisPlugin);
app.register(prismaPlugin);
app.register(meilisearchPlugin);

app.after(() => {
  registerEmailQueue(app);
});

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
});

// Add authenticate decorator for protected routes
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

app.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Register rate limit after Redis is available
app.register(async (fastify) => {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: fastify.redis, // Use Redis for shared rate limiting across instances
  });
});

// routes
app.register(authRoutes, { prefix: '/auth' });
app.register(nodeRoutes, { prefix: '/nodes' });
app.register(postRoutes, { prefix: '/posts' });
app.register(commentRoutes, { prefix: '/' }); // Comments are nested under /posts or at root /comments
app.register(feedPreferenceRoutes, { prefix: '/' });
app.register(searchRoutes, { prefix: '/' });
app.register(moderationRoutes, { prefix: '/' });
app.register(reactionRoutes, { prefix: '/reactions' }); // Phase 0.1 - Vibe Vector reactions

// health check
app.get('/health', async () => ({ ok: true }));

// Example protected route
app.get(
  '/me',
  {
    onRequest: [app.authenticate],
  },
  async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true, createdAt: true },
    });
    return { user };
  }
);

// start server
const port = Number(process.env.PORT) || 3000;

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`API running on http://localhost:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
