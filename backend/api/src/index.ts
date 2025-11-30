// src/index.ts
import 'dotenv/config'; // loads .env
import Fastify, { type FastifyInstance } from 'fastify';
import cors, { type OriginFunction } from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';

import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import meilisearchPlugin from './plugins/meilisearch.js';
import socketPlugin from './plugins/socket.js';
import authRoutes from './routes/auth.js';
import nodeRoutes from './routes/nodes.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import feedPreferenceRoutes from './routes/feedPreferences.js';
import notificationRoutes from './routes/notifications.js';
import moderationRoutes from './routes/moderation.js';
import expertRoutes from './routes/expert.js';
import presetRoutes from './routes/presets.js';
import reactionRoutes from './routes/reactions.js';
import usersRoutes from './routes/users.js';
import metadataRoutes from './routes/metadata.js';
import messagesRoutes from './routes/messages.js';
import reportRoutes from './routes/reports.js';
import vouchRoutes from './routes/vouch.js';
import councilRoutes from './routes/council.js';
import appealRoutes from './routes/appeals.js';
import searchRoutes from './routes/search.js';
import uploadsRoutes from './routes/uploads.js';
import { registerEmailQueue } from './lib/emailQueue.js';
import { trackUserActivity } from './lib/activityTracker.js';
import { startRetryProcessor, stopRetryProcessor } from './lib/searchSync.js';

// Add authenticate decorator for protected routes
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

/**
 * Build the Fastify application instance
 * Exported for testing - tests can import build() to get an app instance
 */
export async function build(): Promise<FastifyInstance> {
  const isTest = process.env.NODE_ENV === 'test';
  const app = Fastify({ logger: !isTest }); // Disable logging in tests
  const isProd = process.env.NODE_ENV === 'production';

  // plugins
  // CORS: Allow all origins in dev, or specific domains in production
  const allowedOriginsList = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : null;
  const corsOrigin: OriginFunction =
    allowedOriginsList && allowedOriginsList.length > 0
      ? (origin, cb) => {
        // Allow configured origins in prod, reflect all in dev for local testing
        if (!origin) return cb(null, true);
        if (!isProd) return cb(null, true);
        if (allowedOriginsList.includes(origin)) return cb(null, origin);
        return cb(new Error('Origin not allowed'), false);
      }
      : (origin, cb) => {
        cb(null, true); // reflect any origin in dev/tunnel scenarios
      };
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'dev-cookie-secret',
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        connectSrc: ["'self'", ...(Array.isArray(allowedOriginsList) ? allowedOriginsList : [])],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded from web app
  });
  await app.register(redisPlugin);
  await app.register(prismaPlugin);
  await app.register(meilisearchPlugin);
  await app.register(socketPlugin);

  app.after(() => {
    registerEmailQueue(app);
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  });

  // Multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  // Static file serving for uploads
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

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

  // Activity tracking - update lastActiveAt for authenticated users
  app.addHook('onRequest', async (request) => {
    if ((request as any).user?.id || (request as any).user?.sub) {
      const userId = (request as any).user?.id || (request as any).user?.sub;
      if (userId) {
        trackUserActivity(app, userId);
      }
    }
  });

  // Register rate limit after Redis is available
  await app.register(async (fastify) => {
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
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(nodeRoutes, { prefix: '/nodes' });
  await app.register(postRoutes, { prefix: '/posts' });
  await app.register(commentRoutes, { prefix: '/' }); // Comments are nested under /posts or at root /comments
  await app.register(feedPreferenceRoutes, { prefix: '/' });
  await app.register(notificationRoutes, { prefix: '/notifications' });
  await app.register(async (fastify) => {
    await fastify.register(reactionRoutes, { prefix: '/api/v1' });
    await fastify.register(moderationRoutes, { prefix: '/api/v1/mod' });
    await fastify.register(expertRoutes, { prefix: '/api/v1/expert' });
    await fastify.register(presetRoutes, { prefix: '/api/v1/presets' });
    await fastify.register(reportRoutes, { prefix: '/api/v1/reports' });
    await fastify.register(vouchRoutes, { prefix: '/api/v1/vouch' });
    await fastify.register(councilRoutes, { prefix: '/api/v1/council' });
    await fastify.register(appealRoutes, { prefix: '/api/v1/appeals' });
  });
  await app.register(usersRoutes, { prefix: '/users' });
  await app.register(metadataRoutes, { prefix: '/metadata' });
  await app.register(messagesRoutes, { prefix: '/api' }); // Prefix /api so it becomes /api/conversations
  await app.register(searchRoutes); // Search routes - /search/posts
  await app.register(uploadsRoutes, { prefix: '/api/uploads' }); // File upload routes (separate from static /uploads)

  // health check
  app.get('/health', async () => ({ ok: true }));

  // Register cleanup hook for MeiliSearch retry processor
  app.addHook('onClose', async () => {
    stopRetryProcessor();
  });

  // Wait for plugins to be ready
  await app.ready();

  // Start MeiliSearch retry processor for failed syncs
  if (app.meilisearch && app.redis) {
    startRetryProcessor(app);
  }

  return app;
}

// Start server only when running directly (not imported for tests)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const port = Number(process.env.PORT) || 3000;

  build()
    .then((app) => {
      app.listen({ port, host: '0.0.0.0' })
        .then(() => {
          app.log.info(`API running on http://localhost:${port}`);
        })
        .catch((err) => {
          app.log.error(err);
          process.exit(1);
        });
    })
    .catch((err) => {
      console.error('Failed to build app:', err);
      process.exit(1);
    });
}
