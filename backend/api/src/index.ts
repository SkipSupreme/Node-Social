// src/index.ts
import 'dotenv/config'; // loads .env
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import '@fastify/cookie';
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
import usersRoutes from './routes/users.js';
import metadataRoutes from './routes/metadata.js';
import { registerEmailQueue } from './lib/emailQueue.js';

const app = Fastify({ logger: true });
const isProd = process.env.NODE_ENV === 'production';
const cookieDomain = isProd ? process.env.COOKIE_DOMAIN || undefined : undefined;

// plugins
// CORS: Allow all origins in dev, or specific domains in production
const allowedOriginsList = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : null;
const corsOrigin =
  allowedOriginsList && allowedOriginsList.length > 0
    ? ((origin: string, cb: (err: Error | null, allow: boolean | string) => void) => {
      // Allow configured origins in prod, reflect all in dev for local testing
      if (!origin) return cb(null, true);
      if (!isProd) return cb(null, true);
      if (allowedOriginsList.includes(origin)) return cb(null, origin);
      return cb(new Error('Origin not allowed'), false);
    })
    : ((origin: string, cb: (err: Error | null, allow: boolean | string) => void) => {
      cb(null, true); // reflect any origin in dev/tunnel scenarios
    });
app.register(cors, {
  origin: corsOrigin,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
});
app.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'dev-cookie-secret',
});
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", ...(Array.isArray(allowedOriginsList) ? allowedOriginsList : [])],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});
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
    // Fallback to cookie-based access token
    const cookieToken = request.cookies?.accessToken;
    if (cookieToken) {
      try {
        await request.jwtVerify({ token: cookieToken });
        return;
      } catch (cookieErr) {
        app.log.debug({ cookieErr }, 'Cookie JWT verification failed');
      }
    }
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

// CSRF protection for cookie-based sessions (double-submit token)
app.addHook('onRequest', async (request, reply) => {
  const method = request.method.toUpperCase();
  const isSafe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const hasAuthCookie = Boolean(request.cookies?.accessToken || request.cookies?.refreshToken);

  if (!isSafe && hasAuthCookie) {
    const csrfCookie = request.cookies?.csrfToken;
    const csrfHeader = request.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return reply.status(403).send({ error: 'Invalid CSRF token' });
    }
  }
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
app.register(usersRoutes, { prefix: '/users' });
app.register(metadataRoutes, { prefix: '/metadata' });

// health check
app.get('/health', async () => ({ ok: true }));

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
