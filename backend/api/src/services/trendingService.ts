// Phase C - Trending Service
// Calculates velocity spikes, rising nodes, and personalized recommendations

import { PrismaClient } from '@prisma/client';

// Vibe vector slugs and their emojis
const VIBE_EMOJIS: Record<string, string> = {
  insightful: '💡',
  joy: '😄',
  fire: '🔥',
  support: '💙',
  shock: '😱',
  questionable: '🤔',
};

const VIBE_SLUGS = ['insightful', 'joy', 'fire', 'support', 'shock', 'questionable'];

export interface VelocitySpike {
  vibe: string;
  vibeEmoji: string;
  percentageChange: number;
  nodeId: string;
  nodeSlug: string;
  nodeName: string;
  nodeColor: string | null;
  hashtags: string[];
}

export interface RisingNode {
  id: string;
  slug: string;
  name: string;
  avatar: string | null;
  color: string | null;
  memberCount: number;
  growthToday: number;
}

export interface NodeRecommendation {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar: string | null;
  color: string | null;
  memberCount: number;
  matchReason: string;
}

// Type for the intensities JSON field
interface VibeIntensities {
  insightful?: number;
  joy?: number;
  fire?: number;
  support?: number;
  shock?: number;
  questionable?: number;
  [key: string]: number | undefined;
}

/**
 * Get velocity spikes - vibes accelerating fastest across nodes
 * Compares reaction counts from last hour vs previous hour
 */
export async function getVelocitySpikes(
  prisma: PrismaClient,
  limit: number = 5
): Promise<VelocitySpike[]> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Get all reactions from the last 2 hours with their post's node
  const recentReactions = await prisma.vibeReaction.findMany({
    where: {
      createdAt: { gte: twoHoursAgo },
      postId: { not: null },
    },
    select: {
      createdAt: true,
      intensities: true,
      post: {
        select: {
          nodeId: true,
          node: {
            select: {
              id: true,
              slug: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
  });

  // Group reactions by node and vibe, separating by time period
  const nodeVibeStats: Map<string, {
    node: { id: string; slug: string; name: string; color: string | null };
    vibes: {
      [vibe: string]: { lastHour: number; previousHour: number };
    };
  }> = new Map();

  for (const reaction of recentReactions) {
    if (!reaction.post?.node) continue;

    const nodeId = reaction.post.node.id;
    const isLastHour = reaction.createdAt >= oneHourAgo;
    const intensities = reaction.intensities as VibeIntensities;

    if (!nodeVibeStats.has(nodeId)) {
      nodeVibeStats.set(nodeId, {
        node: reaction.post.node,
        vibes: Object.fromEntries(
          VIBE_SLUGS.map((v) => [v, { lastHour: 0, previousHour: 0 }])
        ),
      });
    }

    const stats = nodeVibeStats.get(nodeId)!;
    const period = isLastHour ? 'lastHour' : 'previousHour';

    // Count each vibe with intensity > 0.2 (meaningful reaction)
    for (const vibe of VIBE_SLUGS) {
      const intensity = intensities[vibe];
      if (intensity && intensity > 0.2) {
        const vibeStats = stats.vibes[vibe];
        if (vibeStats) {
          vibeStats[period]++;
        }
      }
    }
  }

  // Calculate velocity spikes
  const spikes: VelocitySpike[] = [];

  for (const [nodeId, data] of nodeVibeStats) {
    for (const [vibe, counts] of Object.entries(data.vibes)) {
      // Need at least 2 reactions in previous hour to calculate meaningful percentage
      if (counts.previousHour >= 2 && counts.lastHour > counts.previousHour) {
        const percentageChange = Math.round(
          ((counts.lastHour - counts.previousHour) / counts.previousHour) * 100
        );

        // Only include spikes > 50%
        if (percentageChange >= 50) {
          spikes.push({
            vibe,
            vibeEmoji: VIBE_EMOJIS[vibe] || '✨',
            percentageChange,
            nodeId: data.node.id,
            nodeSlug: data.node.slug,
            nodeName: data.node.name,
            nodeColor: data.node.color,
            hashtags: [], // Would need to extract from posts - simplified for now
          });
        }
      }
    }
  }

  // Sort by percentage change and return top N
  return spikes
    .sort((a, b) => b.percentageChange - a.percentageChange)
    .slice(0, limit);
}

/**
 * Get trending hashtags for a node in the last hour
 * (Helper function for velocity spikes)
 */
export async function getNodeTrendingHashtags(
  prisma: PrismaClient,
  nodeId: string,
  limit: number = 3
): Promise<string[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Get posts from last hour in this node that have reactions
  const posts = await prisma.post.findMany({
    where: {
      nodeId,
      createdAt: { gte: oneHourAgo },
    },
    select: {
      content: true,
    },
  });

  // Extract hashtags from content
  const hashtagCounts: Map<string, number> = new Map();
  const hashtagRegex = /#(\w+)/g;

  for (const post of posts) {
    if (!post.content) continue;
    let match;
    while ((match = hashtagRegex.exec(post.content)) !== null) {
      const captured = match[1];
      if (captured) {
        const tag = `#${captured.toLowerCase()}`;
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
      }
    }
  }

  // Sort by count and return top N
  return Array.from(hashtagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * Get rising nodes - fastest growing by member count
 */
export async function getRisingNodes(
  prisma: PrismaClient,
  limit: number = 5
): Promise<RisingNode[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get subscription counts grouped by node for last 24 hours
  const newSubscriptions = await prisma.nodeSubscription.groupBy({
    by: ['nodeId'],
    where: {
      joinedAt: { gte: oneDayAgo },
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        nodeId: 'desc',
      },
    },
    take: limit,
  });

  if (newSubscriptions.length === 0) {
    return [];
  }

  // Get node details and total member counts
  const nodeIds = newSubscriptions.map((s) => s.nodeId);
  const nodes = await prisma.node.findMany({
    where: { id: { in: nodeIds } },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
  });

  // Create a map for quick lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return newSubscriptions
    .map((sub) => {
      const node = nodeMap.get(sub.nodeId);
      if (!node) return null;

      return {
        id: node.id,
        slug: node.slug,
        name: node.name,
        avatar: node.avatar,
        color: node.color,
        memberCount: node._count.subscriptions,
        growthToday: sub._count._all,
      };
    })
    .filter((n): n is RisingNode => n !== null);
}

/**
 * Get personalized node recommendations based on user's vibe history
 * Returns ALL nodes the user isn't a member of
 */
export async function getNodeRecommendations(
  prisma: PrismaClient,
  userId: string,
  limit: number = 50 // High default to show all nodes
): Promise<NodeRecommendation[]> {
  // Get user's nodes (to exclude from recommendations)
  const userNodes = await prisma.nodeSubscription.findMany({
    where: { userId },
    select: { nodeId: true },
  });
  const userNodeIds = new Set(userNodes.map((n) => n.nodeId));

  // Get ALL nodes the user isn't a member of (excluding global)
  const nodes = await prisma.node.findMany({
    where: {
      id: { notIn: Array.from(userNodeIds) },
      slug: { not: 'global' }, // Exclude global node
    },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
    orderBy: [
      { subscriptions: { _count: 'desc' } }, // Most popular first
      { createdAt: 'desc' }, // Then newest
    ],
    take: limit,
  });

  // Analyze user's reaction patterns for match reason
  const userReactions = await prisma.vibeReaction.findMany({
    where: { userId },
    select: {
      intensities: true,
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });

  let matchReason = 'Discover this community';

  if (userReactions.length > 0) {
    // Sum up vibe intensities to find dominant vibes
    const vibeScores: Record<string, number> = Object.fromEntries(
      VIBE_SLUGS.map((v) => [v, 0])
    );

    for (const reaction of userReactions) {
      const intensities = reaction.intensities as VibeIntensities;
      for (const vibe of VIBE_SLUGS) {
        const currentScore = vibeScores[vibe] ?? 0;
        vibeScores[vibe] = currentScore + (intensities[vibe] || 0);
      }
    }

    const sortedVibes = Object.entries(vibeScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1);

    const dominantVibe = sortedVibes[0]?.[0] || 'insightful';
    const dominantVibeEmoji = VIBE_EMOJIS[dominantVibe] || '✨';
    matchReason = `You often react with ${dominantVibeEmoji} ${dominantVibe.charAt(0).toUpperCase() + dominantVibe.slice(1)}`;
  }

  return nodes.map((node) => ({
    id: node.id,
    slug: node.slug,
    name: node.name,
    description: node.description,
    avatar: node.avatar,
    color: node.color,
    memberCount: node._count.subscriptions,
    matchReason: node._count.subscriptions > 0
      ? matchReason
      : 'New community - be the first to join!',
  }));
}

/**
 * Get popular nodes (fallback for users with no reaction history)
 */
async function getPopularNodes(
  prisma: PrismaClient,
  excludeNodeIds: Set<string>,
  limit: number
): Promise<NodeRecommendation[]> {
  const nodes = await prisma.node.findMany({
    where: {
      id: { notIn: Array.from(excludeNodeIds) },
      slug: { not: 'global' }, // Exclude global node
    },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
    orderBy: {
      subscriptions: {
        _count: 'desc',
      },
    },
    take: limit,
  });

  return nodes.map((node) => ({
    id: node.id,
    slug: node.slug,
    name: node.name,
    description: node.description,
    avatar: node.avatar,
    color: node.color,
    memberCount: node._count.subscriptions,
    matchReason: 'Popular in the community',
  }));
}
