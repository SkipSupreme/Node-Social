import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { encryptToken, decryptToken } from '../lib/tokenEncryption.js';
import {
  createBlueskySession,
  getBlueskyToken,
  blueskyLike,
  blueskyUnlike,
  blueskyRepost,
  blueskyUnrepost,
  blueskyReply,
  registerMastodonApp,
  exchangeMastodonCode,
  getMastodonUser,
  getMastodonToken,
  mastodonLike,
  mastodonUnlike,
  mastodonBoost,
  mastodonUnboost,
  mastodonReply,
  extractMastodonStatusId,
  extractMastodonInstance,
} from '../services/externalInteractionService.js';

const externalAccountRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================
  // Account Management
  // ============================================

  // List linked accounts (redacted — no tokens returned)
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      const accounts = await fastify.prisma.linkedAccount.findMany({
        where: { userId },
        select: {
          id: true,
          platform: true,
          handle: true,
          platformUserId: true,
          instanceUrl: true,
          active: true,
          lastUsedAt: true,
          lastError: true,
          createdAt: true,
        },
      });

      return reply.send({ accounts });
    }
  );

  // Disconnect a linked account
  fastify.delete(
    '/:platform',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { platform } = request.params as { platform: string };

      if (platform !== 'bluesky' && platform !== 'mastodon') {
        return reply.status(400).send({ error: 'Invalid platform' });
      }

      await fastify.prisma.linkedAccount.deleteMany({
        where: { userId, platform },
      });

      return reply.send({ success: true });
    }
  );

  // ============================================
  // Bluesky Connection
  // ============================================

  fastify.post(
    '/bluesky/connect',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      const schema = z.object({
        handle: z.string().min(1).max(100),
        appPassword: z.string().min(1).max(100),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid handle or app password' });
      }

      const { handle, appPassword } = parsed.data;

      try {
        // Create session with Bluesky (validates credentials)
        const session = await createBlueskySession(handle, appPassword);

        // Upsert linked account — app password is NOT stored, only session tokens
        await fastify.prisma.linkedAccount.upsert({
          where: { userId_platform: { userId, platform: 'bluesky' } },
          update: {
            handle: session.handle,
            platformUserId: session.did,
            accessTokenEnc: encryptToken(session.accessJwt),
            refreshTokenEnc: encryptToken(session.refreshJwt),
            tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // ~2h
            active: true,
            lastError: null,
          },
          create: {
            userId,
            platform: 'bluesky',
            handle: session.handle,
            platformUserId: session.did,
            accessTokenEnc: encryptToken(session.accessJwt),
            refreshTokenEnc: encryptToken(session.refreshJwt),
            tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
            active: true,
          },
        });

        return reply.send({
          success: true,
          handle: session.handle,
          did: session.did,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ err: error, handle, message }, 'Failed to connect Bluesky account');
        // Use 422 instead of 401 — 401 gets intercepted by frontend auth refresh logic
        return reply.status(422).send({
          error: `Failed to connect Bluesky: ${message}`,
        });
      }
    }
  );

  // ============================================
  // Mastodon Connection (OAuth2)
  // ============================================

  // Step 1: Initialize OAuth — returns auth URL
  fastify.post(
    '/mastodon/init',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      const schema = z.object({
        instance: z.string().min(1).max(200),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid instance URL' });
      }

      let { instance } = parsed.data;

      // Strip username@ prefix if user entered their full handle (e.g. "user@mastodon.social")
      if (instance.includes('@') && !instance.includes('://')) {
        instance = instance.split('@').pop()!;
      }

      // Normalize instance URL
      if (!instance.startsWith('http')) {
        instance = `https://${instance}`;
      }
      // Remove trailing slash
      instance = instance.replace(/\/+$/, '');

      const redirectUri = process.env.MASTODON_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

      try {
        // Register app on the Mastodon instance
        const app = await registerMastodonApp(instance, redirectUri);

        // Generate state token for CSRF protection
        const state = randomBytes(24).toString('hex');

        // Store state + app credentials in Redis (5 min TTL)
        await fastify.redis.set(
          `mastodon_oauth:${state}`,
          JSON.stringify({
            userId,
            instance,
            clientId: app.client_id,
            clientSecret: app.client_secret,
            redirectUri,
          }),
          'EX',
          300
        );

        // Build OAuth authorization URL
        const authUrl = `${instance}/oauth/authorize?` +
          `client_id=${encodeURIComponent(app.client_id)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent('read write')}` +
          `&state=${state}`;

        return reply.send({ authUrl, state });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ err: error, instance, message }, 'Failed to initialize Mastodon OAuth');
        return reply.status(400).send({
          error: `Failed to connect to Mastodon: ${message}`,
        });
      }
    }
  );

  // Step 2: Complete OAuth — exchange code for token
  fastify.post(
    '/mastodon/callback',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      const schema = z.object({
        code: z.string().min(1),
        state: z.string().min(1),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Missing code or state' });
      }

      const { code, state } = parsed.data;

      // Retrieve and validate state from Redis
      const stateData = await fastify.redis.get(`mastodon_oauth:${state}`);
      if (!stateData) {
        return reply.status(400).send({ error: 'Invalid or expired OAuth state' });
      }

      const { userId: storedUserId, instance, clientId, clientSecret, redirectUri } =
        JSON.parse(stateData) as {
          userId: string;
          instance: string;
          clientId: string;
          clientSecret: string;
          redirectUri: string;
        };

      // Verify the state belongs to this user
      if (storedUserId !== userId) {
        return reply.status(403).send({ error: 'OAuth state mismatch' });
      }

      // Clean up state
      await fastify.redis.del(`mastodon_oauth:${state}`);

      try {
        // Exchange code for access token
        const tokenResponse = await exchangeMastodonCode(
          instance, clientId, clientSecret, code, redirectUri
        );

        // Fetch user info to get handle
        const mastodonUser = await getMastodonUser(instance, tokenResponse.access_token);

        const handle = mastodonUser.acct.includes('@')
          ? mastodonUser.acct
          : `${mastodonUser.acct}@${new URL(instance).hostname}`;

        // Store linked account
        await fastify.prisma.linkedAccount.upsert({
          where: { userId_platform: { userId, platform: 'mastodon' } },
          update: {
            handle,
            platformUserId: mastodonUser.id,
            instanceUrl: instance,
            accessTokenEnc: encryptToken(tokenResponse.access_token),
            tokenScope: tokenResponse.scope,
            clientId,
            clientSecretEnc: encryptToken(clientSecret),
            active: true,
            lastError: null,
          },
          create: {
            userId,
            platform: 'mastodon',
            handle,
            platformUserId: mastodonUser.id,
            instanceUrl: instance,
            accessTokenEnc: encryptToken(tokenResponse.access_token),
            tokenScope: tokenResponse.scope,
            clientId,
            clientSecretEnc: encryptToken(clientSecret),
            active: true,
          },
        });

        return reply.send({
          success: true,
          handle,
          instance,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ err: error, instance, message }, 'Failed to complete Mastodon OAuth');
        return reply.status(400).send({
          error: `Failed to complete Mastodon auth: ${message}`,
        });
      }
    }
  );

  // ============================================
  // Interactions
  // ============================================

  // Like a post on Bluesky or Mastodon
  fastify.post(
    '/:platform/like',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { platform } = request.params as { platform: string };

      const schema = z.object({
        externalId: z.string().min(1),
        cid: z.string().optional(),
        platformStatusId: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request' });
      }

      const account = await fastify.prisma.linkedAccount.findUnique({
        where: { userId_platform: { userId, platform } },
      });

      if (!account || !account.active) {
        return reply.status(404).send({ error: `No linked ${platform} account` });
      }

      try {
        let recordUri: string | undefined;
        if (platform === 'bluesky') {
          if (!parsed.data.cid) {
            return reply.status(400).send({ error: 'CID required for Bluesky interactions' });
          }
          const { token, did } = await getBlueskyToken(account, fastify.prisma);
          const result = await blueskyLike(token, did, parsed.data.externalId, parsed.data.cid);
          recordUri = result.uri;
        } else if (platform === 'mastodon') {
          const token = getMastodonToken(account);
          const instanceUrl = extractMastodonInstance(account);
          const statusId = extractMastodonStatusId(parsed.data.externalId, parsed.data.platformStatusId);
          await mastodonLike(instanceUrl, token, statusId);
        } else {
          return reply.status(400).send({ error: 'Invalid platform' });
        }

        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastUsedAt: new Date(), lastError: null },
        });

        return reply.send({ success: true, recordUri });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ err: error, platform, userId }, 'External like failed');
        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastError: message },
        });
        return reply.status(500).send({ error: message });
      }
    }
  );

  // Unlike/unfavourite a post
  fastify.delete(
    '/:platform/like',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { platform } = request.params as { platform: string };

      const schema = z.object({
        externalId: z.string().min(1),
        recordUri: z.string().optional(),
        platformStatusId: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request' });
      }

      const account = await fastify.prisma.linkedAccount.findUnique({
        where: { userId_platform: { userId, platform } },
      });

      if (!account || !account.active) {
        return reply.status(404).send({ error: `No linked ${platform} account` });
      }

      try {
        if (platform === 'bluesky') {
          if (!parsed.data.recordUri) {
            return reply.status(400).send({ error: 'recordUri required for Bluesky unlike' });
          }
          const { token, did } = await getBlueskyToken(account, fastify.prisma);
          await blueskyUnlike(token, did, parsed.data.recordUri);
        } else if (platform === 'mastodon') {
          const token = getMastodonToken(account);
          const instanceUrl = extractMastodonInstance(account);
          const statusId = extractMastodonStatusId(parsed.data.externalId, parsed.data.platformStatusId);
          await mastodonUnlike(instanceUrl, token, statusId);
        } else {
          return reply.status(400).send({ error: 'Invalid platform' });
        }

        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastUsedAt: new Date(), lastError: null },
        });

        return reply.send({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ err: error, platform, userId }, 'External unlike failed');
        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastError: message },
        });
        return reply.status(500).send({ error: message });
      }
    }
  );

  // Repost/boost a post
  fastify.post(
    '/:platform/repost',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { platform } = request.params as { platform: string };

      const schema = z.object({
        externalId: z.string().min(1),
        cid: z.string().optional(),
        platformStatusId: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request' });
      }

      const account = await fastify.prisma.linkedAccount.findUnique({
        where: { userId_platform: { userId, platform } },
      });

      if (!account || !account.active) {
        return reply.status(404).send({ error: `No linked ${platform} account` });
      }

      try {
        let recordUri: string | undefined;
        if (platform === 'bluesky') {
          if (!parsed.data.cid) {
            return reply.status(400).send({ error: 'CID required for Bluesky interactions' });
          }
          const { token, did } = await getBlueskyToken(account, fastify.prisma);
          const result = await blueskyRepost(token, did, parsed.data.externalId, parsed.data.cid);
          recordUri = result.uri;
        } else if (platform === 'mastodon') {
          const token = getMastodonToken(account);
          const instanceUrl = extractMastodonInstance(account);
          const statusId = extractMastodonStatusId(parsed.data.externalId, parsed.data.platformStatusId);
          await mastodonBoost(instanceUrl, token, statusId);
        } else {
          return reply.status(400).send({ error: 'Invalid platform' });
        }

        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastUsedAt: new Date(), lastError: null },
        });

        return reply.send({ success: true, recordUri });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ err: error, platform, userId }, 'External repost failed');
        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastError: message },
        });
        return reply.status(500).send({ error: message });
      }
    }
  );

  // Unrepost/unboost a post
  fastify.delete(
    '/:platform/repost',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { platform } = request.params as { platform: string };

      const schema = z.object({
        externalId: z.string().min(1),
        recordUri: z.string().optional(),
        platformStatusId: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request' });
      }

      const account = await fastify.prisma.linkedAccount.findUnique({
        where: { userId_platform: { userId, platform } },
      });

      if (!account || !account.active) {
        return reply.status(404).send({ error: `No linked ${platform} account` });
      }

      try {
        if (platform === 'bluesky') {
          if (!parsed.data.recordUri) {
            return reply.status(400).send({ error: 'recordUri required for Bluesky unrepost' });
          }
          const { token, did } = await getBlueskyToken(account, fastify.prisma);
          await blueskyUnrepost(token, did, parsed.data.recordUri);
        } else if (platform === 'mastodon') {
          const token = getMastodonToken(account);
          const instanceUrl = extractMastodonInstance(account);
          const statusId = extractMastodonStatusId(parsed.data.externalId, parsed.data.platformStatusId);
          await mastodonUnboost(instanceUrl, token, statusId);
        } else {
          return reply.status(400).send({ error: 'Invalid platform' });
        }

        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastUsedAt: new Date(), lastError: null },
        });

        return reply.send({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ err: error, platform, userId }, 'External unrepost failed');
        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastError: message },
        });
        return reply.status(500).send({ error: message });
      }
    }
  );

  // Reply to a post
  fastify.post(
    '/:platform/reply',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 15, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { platform } = request.params as { platform: string };

      const schema = z.object({
        externalId: z.string().min(1),
        cid: z.string().optional(),
        platformStatusId: z.string().optional(),
        text: z.string().min(1).max(3000),
        rootUri: z.string().optional(),
        rootCid: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request' });
      }

      const account = await fastify.prisma.linkedAccount.findUnique({
        where: { userId_platform: { userId, platform } },
      });

      if (!account || !account.active) {
        return reply.status(404).send({ error: `No linked ${platform} account` });
      }

      try {
        if (platform === 'bluesky') {
          if (!parsed.data.cid) {
            return reply.status(400).send({ error: 'CID required for Bluesky interactions' });
          }
          const { token, did } = await getBlueskyToken(account, fastify.prisma);
          // For reply, root defaults to the parent if not specified (top-level reply)
          const rootUri = parsed.data.rootUri || parsed.data.externalId;
          const rootCid = parsed.data.rootCid || parsed.data.cid;
          await blueskyReply(
            token, did,
            parsed.data.externalId, parsed.data.cid,
            rootUri, rootCid,
            parsed.data.text
          );
        } else if (platform === 'mastodon') {
          const token = getMastodonToken(account);
          const instanceUrl = extractMastodonInstance(account);
          const statusId = extractMastodonStatusId(parsed.data.externalId, parsed.data.platformStatusId);
          await mastodonReply(instanceUrl, token, statusId, parsed.data.text);
        } else {
          return reply.status(400).send({ error: 'Invalid platform' });
        }

        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastUsedAt: new Date(), lastError: null },
        });

        return reply.send({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error, platform, userId }, 'External reply failed');
        await fastify.prisma.linkedAccount.update({
          where: { id: account.id },
          data: { lastError: message },
        });
        return reply.status(500).send({ error: message });
      }
    }
  );
};

export default externalAccountRoutes;
