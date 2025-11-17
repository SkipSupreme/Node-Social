// src/index.ts
import 'dotenv/config'; // loads .env
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import authRoutes from './routes/auth.js';

const app = Fastify({ logger: true });

// plugins
app.register(cors, { origin: true });
app.register(redisPlugin);
app.register(prismaPlugin);

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
});

app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  // we can wire Redis in later once everything works
});

// routes
app.register(authRoutes, { prefix: '/auth' });

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
