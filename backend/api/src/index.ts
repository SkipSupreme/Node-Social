// src/index.ts
import 'dotenv/config'; // loads .env
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors, { type OriginFunction } from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
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
import trendingRoutes from './routes/trending.js';
import trustRoutes from './routes/trust.js';
import externalRoutes from './routes/external.js';
import externalAccountRoutes from './routes/external-accounts.js';
import themeRoutes from './routes/themes.js';
import { registerEmailQueue } from './lib/emailQueue.js';
import { trackUserActivity } from './lib/activityTracker.js';
import { startRetryProcessor, stopRetryProcessor } from './lib/searchSync.js';

// Tell @fastify/jwt what shape our JWT payload has
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

// Add authenticate decorator for protected routes
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireVerified: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
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

  // Fail-fast: require real secrets in production
  if (isProd) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me') {
      throw new Error('JWT_SECRET must be set in production');
    }
    if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET === 'dev-cookie-secret') {
      throw new Error('COOKIE_SECRET must be set in production');
    }
  }

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
  // 30 days + immutable — all uploaded files use UUID filenames, so they never collide
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    immutable: true,
  });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Fallback to cookie-based access token
      const cookieToken = request.cookies?.accessToken;
      if (cookieToken) {
        try {
          await (request.jwtVerify as Function)({ token: cookieToken });
          return;
        } catch (cookieErr) {
          app.log.debug({ cookieErr }, 'Cookie JWT verification failed');
        }
      }
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Optional authentication - sets request.user if token valid, but doesn't fail if not
  // Used for public endpoints that have enhanced features for logged-in users
  app.decorate('optionalAuthenticate', async function (request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Fallback to cookie-based access token
      const cookieToken = request.cookies?.accessToken;
      if (cookieToken) {
        try {
          await (request.jwtVerify as Function)({ token: cookieToken });
          return;
        } catch (cookieErr) {
          // Silent fail - user stays anonymous
        }
      }
      // Don't set request.user - they're anonymous
    }
  });

  // Email verification gate — use as preHandler AFTER authenticate
  app.decorate('requireVerified', async function (request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as { sub: string }).sub;
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });
    if (!user?.emailVerified) {
      return reply.status(403).send({ error: 'Please verify your email to perform this action' });
    }
  });

  // Activity tracking - update lastActiveAt for authenticated users
  app.addHook('onRequest', async (request) => {
    if (request.user?.sub) {
      const userId = request.user.sub;
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
  // Exempt auth endpoints - login/register don't have valid CSRF yet, refresh might have stale cookies
  const csrfExemptPaths = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/google', '/auth/apple', '/auth/logout'];
  app.addHook('onRequest', async (request, reply) => {
    const method = request.method.toUpperCase();
    const isSafe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    const hasAuthCookie = Boolean(request.cookies?.accessToken || request.cookies?.refreshToken);
    const isExempt = csrfExemptPaths.some(path => request.url.startsWith(path));

    if (!isSafe && hasAuthCookie && !isExempt) {
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
    await fastify.register(trustRoutes, { prefix: '/api/v1/trust' });
    await fastify.register(themeRoutes, { prefix: '/api/v1/themes' });
  });
  await app.register(usersRoutes, { prefix: '/users' });
  await app.register(metadataRoutes, { prefix: '/metadata' });
  await app.register(messagesRoutes, { prefix: '/api' }); // Prefix /api so it becomes /api/conversations
  await app.register(searchRoutes); // Search routes - /search/posts
  await app.register(uploadsRoutes, { prefix: '/api/uploads' }); // File upload routes (separate from static /uploads)
  await app.register(trendingRoutes); // Trending routes - /trending/vibes, /trending/nodes, /discover/nodes
  await app.register(externalRoutes, { prefix: '/external' }); // Tier 5: External platform feeds (Bluesky, Mastodon)
  await app.register(externalAccountRoutes, { prefix: '/external-accounts' }); // Linked Bluesky/Mastodon accounts + interactions

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
      // Graceful shutdown handlers
      let isShuttingDown = false;
      const shutdown = async (signal: string) => {
        if (isShuttingDown) {
          app.log.info(`Received ${signal} again, forcing exit`);
          process.exit(1);
        }
        isShuttingDown = true;
        app.log.info(`Received ${signal}, shutting down gracefully...`);

        // Force exit after 5 seconds if graceful shutdown hangs
        const forceTimer = setTimeout(() => {
          app.log.error('Shutdown timed out after 5s, forcing exit');
          process.exit(1);
        }, 5_000);
        forceTimer.unref();

        // Disconnect all socket.io clients first so server.close() can complete
        if (app.io) {
          app.io.disconnectSockets(true);
        }

        try {
          await app.close();
        } catch (err) {
          app.log.error({ err }, 'Error during shutdown');
        }
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

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
