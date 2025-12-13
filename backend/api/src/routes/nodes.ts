import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const NODE_AVATAR_SIZE = 200; // Node avatar size
const NODE_BANNER_WIDTH = 800; // Node banner width
const NODE_BANNER_HEIGHT = 200; // Node banner height
const JPEG_QUALITY = 80;

// Helper to ensure uploads directory exists
async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// Helper to check if user is node admin (or global site admin)
async function isNodeAdmin(prisma: any, nodeId: string, userId: string): Promise<boolean> {
  // First check if user is a global site admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === 'admin') return true;

  // Otherwise check node-level admin
  const sub = await prisma.nodeSubscription.findUnique({
    where: { userId_nodeId: { userId, nodeId } },
    select: { role: true },
  });
  return sub?.role === 'admin';
}

// Helper to calculate relative time string
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

const nodeRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure uploads dir exists
  await ensureUploadsDir();

  // Create a new node
  fastify.post(
    '/',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
    },
    async (request, reply) => {
      const schema = z.object({
        name: z.string().min(3).max(50),
        slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
        description: z.string().max(500).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
      }

      const { name, slug, description, color } = parsed.data;
      const userId = (request.user as { sub: string }).sub;

      // Check if slug exists
      const existing = await fastify.prisma.node.findUnique({ where: { slug } });
      if (existing) {
        return reply.status(409).send({ error: 'Node with this slug already exists' });
      }

      const node = await fastify.prisma.node.create({
        data: {
          name,
          slug,
          description: description ?? null,
          color: color ?? '#6366f1', // Default indigo
          creatorId: userId,
          rules: [],
        },
      });

      // Auto-subscribe creator as admin
      await fastify.prisma.nodeSubscription.create({
        data: {
          userId,
          nodeId: node.id,
          role: 'admin',
        },
      });

      return reply.status(201).send({ ...node, subscriberCount: 1, isSubscribed: true });
    }
  );

  // List all nodes (with subscriber counts)
  fastify.get('/', async (request, reply) => {
    const userId = (request.user as { sub: string } | undefined)?.sub;

    const nodes = await fastify.prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { subscriptions: true } },
        ...(userId ? {
          subscriptions: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        } : {}),
      },
    });

    const formatted = nodes.map((node) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      description: node.description,
      color: node.color,
      avatar: node.avatar,
      banner: node.banner,
      createdAt: node.createdAt,
      subscriberCount: node._count.subscriptions,
      isSubscribed: userId ? node.subscriptions?.length > 0 : false,
      myRole: userId ? node.subscriptions?.[0]?.role || null : null,
    }));

    return reply.send(formatted);
  });

  // Get user's subscribed nodes
  fastify.get('/subscribed', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;

    const subscriptions = await fastify.prisma.nodeSubscription.findMany({
      where: { userId },
      include: {
        node: {
          include: {
            _count: { select: { subscriptions: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const nodes = subscriptions.map((sub) => ({
      id: sub.node.id,
      name: sub.node.name,
      slug: sub.node.slug,
      description: sub.node.description,
      color: sub.node.color,
      avatar: sub.node.avatar,
      banner: sub.node.banner,
      subscriberCount: sub.node._count.subscriptions,
      isSubscribed: true,
      myRole: sub.role,
      joinedAt: sub.joinedAt,
    }));

    return reply.send(nodes);
  });

  // Get a single node by slug or ID - ENHANCED with full details
  fastify.get('/:idOrSlug', async (request, reply) => {
    const { idOrSlug } = request.params as { idOrSlug: string };

    // Try to get user from auth header if present (optional auth)
    let userId: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = fastify.jwt.decode<{ sub: string }>(token);
        userId = decoded?.sub;
      } catch {
        // Token invalid, proceed without user
      }
    }

    // Try finding by slug first, then ID (if it looks like a UUID)
    let node = await fastify.prisma.node.findUnique({
      where: { slug: idOrSlug },
      include: {
        curatorBot: {
          select: { id: true, username: true, avatar: true, bio: true },
        },
      },
    });

    if (!node && /^[0-9a-fA-F-]{36}$/.test(idOrSlug)) {
      node = await fastify.prisma.node.findUnique({
        where: { id: idOrSlug },
        include: {
          curatorBot: {
            select: { id: true, username: true, avatar: true, bio: true },
          },
        },
      });
    }

    if (!node) {
      return reply.status(404).send({ error: 'Node not found' });
    }

    // Get stats
    const memberCount = await fastify.prisma.nodeSubscription.count({
      where: { nodeId: node.id },
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const growthThisWeek = await fastify.prisma.nodeSubscription.count({
      where: {
        nodeId: node.id,
        joinedAt: { gte: oneWeekAgo },
      },
    });

    const postCount = await fastify.prisma.post.count({
      where: { nodeId: node.id, deletedAt: null },
    });

    // Get council (admins and moderators)
    const council = await fastify.prisma.nodeSubscription.findMany({
      where: {
        nodeId: node.id,
        role: { in: ['admin', 'moderator'] },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // admin comes before moderator alphabetically
        { joinedAt: 'asc' },
      ],
    });

    const councilFormatted = council.map((c) => ({
      userId: c.user.id,
      username: c.user.username,
      avatar: c.user.avatar,
      role: c.role,
      joinedAt: c.joinedAt,
      tenure: getRelativeTime(c.joinedAt),
    }));

    // Get current user's membership if logged in
    let currentUserMembership = null;
    if (userId) {
      const sub = await fastify.prisma.nodeSubscription.findUnique({
        where: { userId_nodeId: { userId, nodeId: node.id } },
      });
      const mute = await fastify.prisma.nodeMute.findUnique({
        where: { userId_nodeId: { userId, nodeId: node.id } },
      });
      if (sub) {
        currentUserMembership = {
          isMember: true,
          role: sub.role,
          joinedAt: sub.joinedAt,
          isMuted: !!mute,
        };
      } else {
        currentUserMembership = {
          isMember: false,
          role: null,
          joinedAt: null,
          isMuted: !!mute,
        };
      }
    }

    // Get recent mod actions (last 3) for posts in this node
    const nodePostIds = await fastify.prisma.post.findMany({
      where: { nodeId: node.id },
      select: { id: true },
    });
    const postIds = nodePostIds.map(p => p.id);

    const recentModActions = await fastify.prisma.modActionLog.findMany({
      where: {
        targetType: 'post',
        targetId: { in: postIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // Get moderator usernames
    const moderatorIds = recentModActions.map(a => a.moderatorId).filter(Boolean) as string[];
    const moderators = moderatorIds.length > 0
      ? await fastify.prisma.user.findMany({
          where: { id: { in: moderatorIds } },
          select: { id: true, username: true },
        })
      : [];
    const modMap = new Map(moderators.map(m => [m.id, m.username]));

    const filteredModActions = recentModActions.map(action => ({
      id: action.id,
      action: action.action,
      targetType: action.targetType,
      reason: action.reason,
      moderatorUsername: action.moderatorId ? modMap.get(action.moderatorId) || 'Unknown' : 'System',
      createdAt: action.createdAt,
    }));

    return reply.send({
      id: node.id,
      slug: node.slug,
      name: node.name,
      description: node.description,
      color: node.color,
      avatar: node.avatar,
      banner: node.banner,
      rules: node.rules || [],
      createdAt: node.createdAt,
      curatorBot: node.curatorBot,
      stats: {
        memberCount,
        growthThisWeek,
        postCount,
      },
      council: councilFormatted,
      currentUserMembership,
      recentModActions: filteredModActions,
    });
  });

  // Update node settings (admin only)
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    // Check admin permission
    const isAdmin = await isNodeAdmin(fastify.prisma, id, userId);
    if (!isAdmin) {
      return reply.status(403).send({ error: 'Only node admins can update settings' });
    }

    const schema = z.object({
      name: z.string().min(3).max(50).optional(),
      description: z.string().max(500).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      rules: z.array(z.string().max(200)).max(10).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
    }

    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.color !== undefined) updateData.color = parsed.data.color;
    if (parsed.data.rules !== undefined) updateData.rules = parsed.data.rules;

    const updated = await fastify.prisma.node.update({
      where: { id },
      data: updateData,
    });

    return reply.send(updated);
  });

  // Upload node avatar (admin only)
  fastify.post('/:id/avatar', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    // Check admin permission
    const isAdmin = await isNodeAdmin(fastify.prisma, id, userId);
    if (!isAdmin) {
      return reply.status(403).send({ error: 'Only node admins can upload avatar' });
    }

    try {
      const data = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' });
      }

      const buffer = await data.toBuffer();

      // Process avatar: square, resize
      const processedImage = await sharp(buffer)
        .flatten({ background: { r: 30, g: 30, b: 46 } })
        .resize(NODE_AVATAR_SIZE, NODE_AVATAR_SIZE, { fit: 'cover', position: 'center' })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

      const filename = `node_avatar_${id}_${randomUUID()}.jpg`;
      const filepath = path.join(UPLOADS_DIR, filename);

      // Delete old avatar if exists
      const node = await fastify.prisma.node.findUnique({
        where: { id },
        select: { avatar: true },
      });

      if (node?.avatar && node.avatar.includes('/uploads/')) {
        const parts = node.avatar.split('/uploads/');
        const oldFilename = parts[1];
        if (oldFilename) {
          try {
            await fs.unlink(path.join(UPLOADS_DIR, oldFilename));
          } catch { /* ignore */ }
        }
      }

      await fs.writeFile(filepath, processedImage);

      const protocol = request.headers['x-forwarded-proto'] || 'http';
      const host = request.headers['x-forwarded-host'] || request.headers.host || `localhost:${process.env.PORT || 3000}`;
      const baseUrl = process.env.API_URL || `${protocol}://${host}`;
      const avatarUrl = `${baseUrl}/uploads/${filename}`;

      const updated = await fastify.prisma.node.update({
        where: { id },
        data: { avatar: avatarUrl },
      });

      return reply.send({ success: true, avatarUrl, node: updated });
    } catch (error: any) {
      console.error('Node avatar upload error:', error);
      if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(400).send({ error: 'File too large. Maximum size is 5MB' });
      }
      return reply.status(500).send({ error: 'Failed to upload avatar' });
    }
  });

  // Upload node banner (admin only)
  fastify.post('/:id/banner', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    // Check admin permission
    const isAdmin = await isNodeAdmin(fastify.prisma, id, userId);
    if (!isAdmin) {
      return reply.status(403).send({ error: 'Only node admins can upload banner' });
    }

    try {
      const data = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' });
      }

      const buffer = await data.toBuffer();

      // Process banner
      const processedImage = await sharp(buffer)
        .flatten({ background: { r: 30, g: 30, b: 46 } })
        .resize(NODE_BANNER_WIDTH, NODE_BANNER_HEIGHT, { fit: 'cover', position: 'center' })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

      const filename = `node_banner_${id}_${randomUUID()}.jpg`;
      const filepath = path.join(UPLOADS_DIR, filename);

      // Delete old banner if exists
      const node = await fastify.prisma.node.findUnique({
        where: { id },
        select: { banner: true },
      });

      if (node?.banner && node.banner.includes('/uploads/')) {
        const parts = node.banner.split('/uploads/');
        const oldFilename = parts[1];
        if (oldFilename) {
          try {
            await fs.unlink(path.join(UPLOADS_DIR, oldFilename));
          } catch { /* ignore */ }
        }
      }

      await fs.writeFile(filepath, processedImage);

      const protocol = request.headers['x-forwarded-proto'] || 'http';
      const host = request.headers['x-forwarded-host'] || request.headers.host || `localhost:${process.env.PORT || 3000}`;
      const baseUrl = process.env.API_URL || `${protocol}://${host}`;
      const bannerUrl = `${baseUrl}/uploads/${filename}`;

      const updated = await fastify.prisma.node.update({
        where: { id },
        data: { banner: bannerUrl },
      });

      return reply.send({ success: true, bannerUrl, node: updated });
    } catch (error: any) {
      console.error('Node banner upload error:', error);
      if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(400).send({ error: 'File too large. Maximum size is 5MB' });
      }
      return reply.status(500).send({ error: 'Failed to upload banner' });
    }
  });

  // Delete node avatar (admin only)
  fastify.delete('/:id/avatar', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const isAdmin = await isNodeAdmin(fastify.prisma, id, userId);
    if (!isAdmin) {
      return reply.status(403).send({ error: 'Only node admins can delete avatar' });
    }

    const node = await fastify.prisma.node.findUnique({
      where: { id },
      select: { avatar: true },
    });

    if (node?.avatar && node.avatar.includes('/uploads/')) {
      const parts = node.avatar.split('/uploads/');
      const oldFilename = parts[1];
      if (oldFilename) {
        try {
          await fs.unlink(path.join(UPLOADS_DIR, oldFilename));
        } catch { /* ignore */ }
      }
    }

    await fastify.prisma.node.update({
      where: { id },
      data: { avatar: null },
    });

    return reply.send({ success: true });
  });

  // Delete node banner (admin only)
  fastify.delete('/:id/banner', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const isAdmin = await isNodeAdmin(fastify.prisma, id, userId);
    if (!isAdmin) {
      return reply.status(403).send({ error: 'Only node admins can delete banner' });
    }

    const node = await fastify.prisma.node.findUnique({
      where: { id },
      select: { banner: true },
    });

    if (node?.banner && node.banner.includes('/uploads/')) {
      const parts = node.banner.split('/uploads/');
      const oldFilename = parts[1];
      if (oldFilename) {
        try {
          await fs.unlink(path.join(UPLOADS_DIR, oldFilename));
        } catch { /* ignore */ }
      }
    }

    await fastify.prisma.node.update({
      where: { id },
      data: { banner: null },
    });

    return reply.send({ success: true });
  });

  // Toggle subscribe to node
  fastify.post('/:id/subscribe', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    // Check node exists
    const node = await fastify.prisma.node.findUnique({ where: { id } });
    if (!node) {
      return reply.status(404).send({ error: 'Node not found' });
    }

    // Check existing subscription
    const existing = await fastify.prisma.nodeSubscription.findUnique({
      where: { userId_nodeId: { userId, nodeId: id } },
    });

    if (existing) {
      // Unsubscribe
      await fastify.prisma.nodeSubscription.delete({
        where: { userId_nodeId: { userId, nodeId: id } },
      });

      const count = await fastify.prisma.nodeSubscription.count({ where: { nodeId: id } });
      return reply.send({ subscribed: false, subscriberCount: count });
    } else {
      // Subscribe
      await fastify.prisma.nodeSubscription.create({
        data: { userId, nodeId: id, role: 'member' },
      });

      const count = await fastify.prisma.nodeSubscription.count({ where: { nodeId: id } });
      return reply.send({ subscribed: true, subscriberCount: count });
    }
  });

  // Join node (explicit join - same as subscribe but clearer intent)
  fastify.post('/:id/join', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const node = await fastify.prisma.node.findUnique({ where: { id } });
    if (!node) {
      return reply.status(404).send({ error: 'Node not found' });
    }

    // Check if already member
    const existing = await fastify.prisma.nodeSubscription.findUnique({
      where: { userId_nodeId: { userId, nodeId: id } },
    });

    if (existing) {
      return reply.send({ success: true, membership: { role: existing.role, joinedAt: existing.joinedAt } });
    }

    const sub = await fastify.prisma.nodeSubscription.create({
      data: { userId, nodeId: id, role: 'member' },
    });

    return reply.send({ success: true, membership: { role: sub.role, joinedAt: sub.joinedAt } });
  });

  // Leave node
  fastify.post('/:id/leave', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const existing = await fastify.prisma.nodeSubscription.findUnique({
      where: { userId_nodeId: { userId, nodeId: id } },
    });

    if (!existing) {
      return reply.status(400).send({ error: 'Not a member of this node' });
    }

    // Don't allow last admin to leave
    if (existing.role === 'admin') {
      const adminCount = await fastify.prisma.nodeSubscription.count({
        where: { nodeId: id, role: 'admin' },
      });
      if (adminCount <= 1) {
        return reply.status(400).send({ error: 'Cannot leave - you are the only admin. Transfer admin role first.' });
      }
    }

    await fastify.prisma.nodeSubscription.delete({
      where: { userId_nodeId: { userId, nodeId: id } },
    });

    return reply.send({ success: true });
  });

  // Mute node (hide from feed without leaving)
  fastify.post('/:id/mute', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const node = await fastify.prisma.node.findUnique({ where: { id } });
    if (!node) {
      return reply.status(404).send({ error: 'Node not found' });
    }

    // Check if already muted
    const existing = await fastify.prisma.nodeMute.findUnique({
      where: { userId_nodeId: { userId, nodeId: id } },
    });

    if (existing) {
      return reply.send({ success: true, muted: true });
    }

    await fastify.prisma.nodeMute.create({
      data: { userId, nodeId: id },
    });

    return reply.send({ success: true, muted: true });
  });

  // Unmute node
  fastify.delete('/:id/mute', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const existing = await fastify.prisma.nodeMute.findUnique({
      where: { userId_nodeId: { userId, nodeId: id } },
    });

    if (!existing) {
      return reply.send({ success: true, muted: false });
    }

    await fastify.prisma.nodeMute.delete({
      where: { userId_nodeId: { userId, nodeId: id } },
    });

    return reply.send({ success: true, muted: false });
  });

  // Get node members
  fastify.get('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      limit: z.coerce.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const { limit, cursor } = parsed.data;

    const subscriptions = await fastify.prisma.nodeSubscription.findMany({
      where: { nodeId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            era: true,
            cred: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = subscriptions.length > limit;
    const members = subscriptions.slice(0, limit).map((sub) => ({
      id: sub.user.id,
      username: sub.user.username,
      avatar: sub.user.avatar,
      era: sub.user.era,
      cred: sub.user.cred,
      role: sub.role,
      joinedAt: sub.joinedAt,
    }));

    return reply.send({
      members,
      nextCursor: hasMore && members.length > 0 ? subscriptions[limit - 1]?.id ?? null : null,
      hasMore,
    });
  });

  // Get node mod log
  fastify.get('/:id/mod-log', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      limit: z.coerce.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      action: z.string().optional(),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const { limit, cursor, action } = parsed.data;

    // Get all post IDs for this node
    const nodePosts = await fastify.prisma.post.findMany({
      where: { nodeId: id },
      select: { id: true },
    });
    const postIds = nodePosts.map(p => p.id);

    const whereClause: any = {
      targetType: 'post',
      targetId: { in: postIds },
    };
    if (action) {
      whereClause.action = action;
    }

    const actions = await fastify.prisma.modActionLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // Get moderator usernames
    const modIds = actions.map(a => a.moderatorId).filter(Boolean) as string[];
    const mods = modIds.length > 0
      ? await fastify.prisma.user.findMany({
          where: { id: { in: modIds } },
          select: { id: true, username: true },
        })
      : [];
    const modMap = new Map(mods.map(m => [m.id, m.username]));

    const hasMore = actions.length > limit;
    const formatted = actions.slice(0, limit).map(a => ({
      id: a.id,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      reason: a.reason,
      moderatorId: a.moderatorId,
      moderatorUsername: a.moderatorId ? modMap.get(a.moderatorId) || 'Unknown' : 'System',
      createdAt: a.createdAt,
    }));

    return reply.send({
      actions: formatted,
      nextCursor: hasMore && formatted.length > 0 ? actions[limit - 1]?.id ?? null : null,
    });
  });

  // Get node curator bot info
  fastify.get('/:id/curator', async (request, reply) => {
    const { id } = request.params as { id: string };

    const node = await fastify.prisma.node.findUnique({
      where: { id },
      include: {
        curatorBot: {
          select: {
            id: true,
            username: true,
            avatar: true,
            bio: true,
            isBot: true,
          },
        },
      },
    });

    if (!node) {
      return reply.status(404).send({ error: 'Node not found' });
    }

    return reply.send({
      curatorBot: node.curatorBot,
    });
  });

  // Update node curator bot (admin only)
  fastify.patch('/:id/curator', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    // Check admin permission
    const isAdmin = await isNodeAdmin(fastify.prisma, id, userId);
    if (!isAdmin) {
      return reply.status(403).send({ error: 'Only node admins can update curator bot' });
    }

    const schema = z.object({
      curatorBotId: z.string().uuid().nullable(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error });
    }

    // If setting a bot, verify it's actually a bot
    if (parsed.data.curatorBotId) {
      const bot = await fastify.prisma.user.findUnique({
        where: { id: parsed.data.curatorBotId },
        select: { isBot: true },
      });
      if (!bot?.isBot) {
        return reply.status(400).send({ error: 'Selected user is not a bot' });
      }
    }

    const updated = await fastify.prisma.node.update({
      where: { id },
      data: { curatorBotId: parsed.data.curatorBotId },
      include: {
        curatorBot: {
          select: {
            id: true,
            username: true,
            avatar: true,
            bio: true,
          },
        },
      },
    });

    return reply.send({ curatorBot: updated.curatorBot });
  });

  // Get all available curator bots
  fastify.get('/bots/available', async (request, reply) => {
    const bots = await fastify.prisma.user.findMany({
      where: { isBot: true },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        botConfig: true,
      },
      orderBy: { username: 'asc' },
    });

    return reply.send({ bots });
  });
};

export default nodeRoutes;
