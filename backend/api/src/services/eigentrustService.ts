/**
 * Eigentrust Algorithm Implementation
 * Per governance.md Section 3.1 - The Math of Trust
 *
 * The Eigentrust algorithm computes global trust scores using transitive trust.
 * Unlike simple Karma (upvotes - downvotes), it accounts for WHO is voting.
 *
 * Key concepts:
 * 1. Direct Trust (c_ij): Normalized trust from user i to user j
 * 2. Global Trust (t_k): Computed via iterative matrix multiplication t^(k+1) = C^T t^(k)
 * 3. Seed Nodes: Pre-trusted peers that anchor the trust graph
 * 4. Sybil Resistance: A Sybil farm only trusting itself gets score ~0 if no seed trusts them
 *
 * References:
 * - Original paper: "The Eigentrust Algorithm for Reputation Management in P2P Networks"
 * - Stanford, 2003
 */

import type { PrismaClient } from '@prisma/client';

// Algorithm parameters
const MAX_ITERATIONS = 100; // Maximum iterations before forced convergence
const CONVERGENCE_THRESHOLD = 1e-6; // Stop when delta < this
const DAMPING_FACTOR = 0.15; // Probability of jumping to seed node (like PageRank)

// Trust tier thresholds (percentiles)
const TIER_THRESHOLDS = {
  gold: 0.95, // Top 5%
  silver: 0.80, // Top 20%
  bronze: 0.50, // Top 50%
  // Below 50th percentile = shadow
};

// Decay parameters (per governance.md Section 3.3)
const DECAY_LAMBDA = 0.01; // Decay rate (lower = slower decay)
const DECAY_TIME_UNIT_MS = 24 * 60 * 60 * 1000; // 1 day

export interface EigentrustResult {
  iterations: number;
  convergenceDelta: number;
  usersProcessed: number;
  edgesProcessed: number;
}

export interface TrustTierStats {
  gold: number;
  silver: number;
  bronze: number;
  shadow: number;
}

/**
 * Compute direct trust edges from vouches and other trust signals.
 * This creates the C matrix (normalized trust matrix).
 *
 * Per governance.md: Direct trust c_ij is computed from positive interactions,
 * and the sum of trust user i gives out must equal 1.0
 */
export async function computeTrustEdges(prisma: PrismaClient): Promise<number> {
  // Get all active vouches
  const vouches = await prisma.vouch.findMany({
    where: { active: true },
    select: {
      voucherId: true,
      voucheeId: true,
      stake: true,
    },
  });

  // Group vouches by voucher and calculate raw weights
  const voucherEdges = new Map<string, Map<string, number>>();

  for (const vouch of vouches) {
    if (!voucherEdges.has(vouch.voucherId)) {
      voucherEdges.set(vouch.voucherId, new Map());
    }
    const edges = voucherEdges.get(vouch.voucherId)!;

    // Raw weight is the stake amount (more stake = more trust)
    const currentWeight = edges.get(vouch.voucheeId) || 0;
    edges.set(vouch.voucheeId, currentWeight + vouch.stake);
  }

  // Normalize edges so sum of outgoing trust = 1.0 per user
  const edgesToCreate: Array<{
    fromUserId: string;
    toUserId: string;
    directTrust: number;
    rawWeight: number;
    source: string;
  }> = [];

  for (const [fromUserId, edges] of voucherEdges) {
    const totalWeight = Array.from(edges.values()).reduce((a, b) => a + b, 0);

    for (const [toUserId, rawWeight] of edges) {
      const directTrust = rawWeight / totalWeight; // Normalize to sum = 1
      edgesToCreate.push({
        fromUserId,
        toUserId,
        directTrust,
        rawWeight,
        source: 'vouch',
      });
    }
  }

  // Clear existing edges and insert new ones
  await prisma.trustEdge.deleteMany({});

  if (edgesToCreate.length > 0) {
    await prisma.trustEdge.createMany({
      data: edgesToCreate,
    });
  }

  return edgesToCreate.length;
}

/**
 * Get seed node user IDs.
 * These are the pre-trusted peers that anchor the trust graph.
 */
export async function getSeedNodeIds(prisma: PrismaClient): Promise<Set<string>> {
  const seedNodes = await prisma.seedNode.findMany({
    where: { active: true },
    select: { userId: true },
  });
  return new Set(seedNodes.map((s) => s.userId));
}

/**
 * Run the Eigentrust algorithm.
 *
 * The algorithm:
 * 1. Start with uniform trust vector (or seed-weighted)
 * 2. Iterate: t^(k+1) = (1-d) * C^T * t^(k) + d * p
 *    where d = damping factor, p = seed distribution
 * 3. Stop when ||t^(k+1) - t^(k)|| < threshold
 *
 * This is essentially PageRank applied to trust relationships.
 */
export async function runEigentrust(prisma: PrismaClient): Promise<EigentrustResult> {
  // Create computation log
  const log = await prisma.trustComputationLog.create({
    data: { status: 'running' },
  });

  try {
    // Step 1: Compute/refresh trust edges from vouches
    const edgesProcessed = await computeTrustEdges(prisma);

    // Step 2: Get all users and seed nodes
    const allUsers = await prisma.user.findMany({
      select: { id: true, lastActiveAt: true },
    });
    const userIds = allUsers.map((u) => u.id);
    const userIdSet = new Set(userIds);
    const userCount = userIds.length;

    if (userCount === 0) {
      await prisma.trustComputationLog.update({
        where: { id: log.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          usersProcessed: 0,
          edgesProcessed: 0,
          iterations: 0,
        },
      });
      return { iterations: 0, convergenceDelta: 0, usersProcessed: 0, edgesProcessed: 0 };
    }

    const seedNodeIds = await getSeedNodeIds(prisma);

    // Step 3: Build trust matrix in memory
    // trustMatrix[toUserId] = Map<fromUserId, trust>
    // This is C^T (transposed) for efficient iteration
    const trustMatrix = new Map<string, Map<string, number>>();
    const edges = await prisma.trustEdge.findMany({});

    for (const edge of edges) {
      if (!trustMatrix.has(edge.toUserId)) {
        trustMatrix.set(edge.toUserId, new Map());
      }
      trustMatrix.get(edge.toUserId)!.set(edge.fromUserId, edge.directTrust);
    }

    // Step 4: Initialize trust vector
    // Seed nodes get higher initial trust
    const trustVector = new Map<string, number>();
    const seedCount = seedNodeIds.size || 1;
    const uniformTrust = 1.0 / userCount;
    const seedTrust = 1.0 / seedCount;

    for (const userId of userIds) {
      if (seedNodeIds.has(userId)) {
        trustVector.set(userId, seedTrust);
      } else {
        trustVector.set(userId, uniformTrust);
      }
    }

    // Step 5: Build seed distribution vector (for damping)
    const seedDistribution = new Map<string, number>();
    for (const userId of userIds) {
      seedDistribution.set(userId, seedNodeIds.has(userId) ? seedTrust : 0);
    }

    // Step 6: Iterate until convergence
    let iterations = 0;
    let convergenceDelta = Infinity;

    while (iterations < MAX_ITERATIONS && convergenceDelta > CONVERGENCE_THRESHOLD) {
      const newTrustVector = new Map<string, number>();

      // t^(k+1) = (1-d) * C^T * t^(k) + d * p
      for (const userId of userIds) {
        let newTrust = 0;

        // Multiply by trust matrix (C^T * t^(k))
        const incomingEdges = trustMatrix.get(userId);
        if (incomingEdges) {
          for (const [fromUserId, trustValue] of incomingEdges) {
            const fromTrust = trustVector.get(fromUserId) || 0;
            newTrust += trustValue * fromTrust;
          }
        }

        // Apply damping factor
        const dampedTrust =
          (1 - DAMPING_FACTOR) * newTrust +
          DAMPING_FACTOR * (seedDistribution.get(userId) || 0);

        newTrustVector.set(userId, dampedTrust);
      }

      // Normalize to ensure sum = 1
      const totalTrust = Array.from(newTrustVector.values()).reduce((a, b) => a + b, 0);
      if (totalTrust > 0) {
        for (const [userId, trust] of newTrustVector) {
          newTrustVector.set(userId, trust / totalTrust);
        }
      }

      // Calculate convergence delta (L2 norm of difference)
      convergenceDelta = 0;
      for (const userId of userIds) {
        const oldTrust = trustVector.get(userId) || 0;
        const newTrust = newTrustVector.get(userId) || 0;
        convergenceDelta += (newTrust - oldTrust) ** 2;
      }
      convergenceDelta = Math.sqrt(convergenceDelta);

      // Update trust vector
      for (const [userId, trust] of newTrustVector) {
        trustVector.set(userId, trust);
      }

      iterations++;
    }

    // Step 7: Compute seed distances via BFS
    const seedDistances = computeSeedDistances(trustMatrix, seedNodeIds, userIdSet);

    // Step 8: Apply trust decay based on activity
    const now = Date.now();
    const userActivityMap = new Map(allUsers.map((u) => [u.id, u.lastActiveAt]));

    for (const [userId, rawScore] of trustVector) {
      const lastActive = userActivityMap.get(userId);
      if (lastActive) {
        const timeSinceActive = now - lastActive.getTime();
        const decayFactor = Math.exp(
          (-DECAY_LAMBDA * timeSinceActive) / DECAY_TIME_UNIT_MS
        );
        trustVector.set(userId, rawScore * decayFactor);
      }
    }

    // Step 9: Calculate tier thresholds based on percentiles
    const sortedScores = Array.from(trustVector.values())
      .filter((s) => s > 0)
      .sort((a, b) => b - a);

    const goldThreshold = sortedScores[Math.floor(sortedScores.length * (1 - TIER_THRESHOLDS.gold))] || 0;
    const silverThreshold = sortedScores[Math.floor(sortedScores.length * (1 - TIER_THRESHOLDS.silver))] || 0;
    const bronzeThreshold = sortedScores[Math.floor(sortedScores.length * (1 - TIER_THRESHOLDS.bronze))] || 0;

    // Step 10: Store results
    const trustScoreUpserts = [];
    for (const [userId, decayedScore] of trustVector) {
      // Determine tier
      let tier = 'shadow';
      if (decayedScore >= goldThreshold && goldThreshold > 0) {
        tier = 'gold';
      } else if (decayedScore >= silverThreshold && silverThreshold > 0) {
        tier = 'silver';
      } else if (decayedScore >= bronzeThreshold && bronzeThreshold > 0) {
        tier = 'bronze';
      }

      // Seed nodes are always gold tier
      if (seedNodeIds.has(userId)) {
        tier = 'gold';
      }

      trustScoreUpserts.push({
        userId,
        rawScore: trustVector.get(userId) || 0,
        decayedScore,
        tier,
        seedDistance: seedDistances.get(userId) ?? null,
        computedAt: new Date(),
        lastActiveAt: userActivityMap.get(userId) || new Date(),
      });
    }

    // Batch upsert trust scores in a transaction for atomicity
    await prisma.$transaction(
      trustScoreUpserts.map((data) =>
        prisma.trustScore.upsert({
          where: { userId: data.userId },
          update: {
            rawScore: data.rawScore,
            decayedScore: data.decayedScore,
            tier: data.tier,
            seedDistance: data.seedDistance,
            computedAt: data.computedAt,
            lastActiveAt: data.lastActiveAt,
          },
          create: data,
        })
      )
    );

    // Update computation log
    await prisma.trustComputationLog.update({
      where: { id: log.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        usersProcessed: userCount,
        edgesProcessed,
        iterations,
        convergenceDelta,
      },
    });

    return {
      iterations,
      convergenceDelta,
      usersProcessed: userCount,
      edgesProcessed,
    };
  } catch (error) {
    // Log failure
    await prisma.trustComputationLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

/**
 * Compute shortest distance from each user to nearest seed node.
 * Uses BFS from seed nodes.
 */
function computeSeedDistances(
  trustMatrix: Map<string, Map<string, number>>,
  seedNodeIds: Set<string>,
  allUserIds: Set<string>
): Map<string, number> {
  const distances = new Map<string, number>();

  // Seed nodes have distance 0
  for (const seedId of seedNodeIds) {
    distances.set(seedId, 0);
  }

  // Build reverse adjacency (who trusts whom -> who is trusted by whom)
  // We want to find path TO seed, so we traverse reverse edges
  const reverseAdj = new Map<string, Set<string>>();
  for (const [toUserId, fromMap] of trustMatrix) {
    for (const fromUserId of fromMap.keys()) {
      if (!reverseAdj.has(fromUserId)) {
        reverseAdj.set(fromUserId, new Set());
      }
      reverseAdj.get(fromUserId)!.add(toUserId);
    }
  }

  // BFS from seed nodes
  const queue: Array<{ userId: string; distance: number }> = [];
  for (const seedId of seedNodeIds) {
    queue.push({ userId: seedId, distance: 0 });
  }

  while (queue.length > 0) {
    const { userId, distance } = queue.shift()!;

    // Find who this user trusts (edges going out from userId)
    // In trust direction: userId -> voucheeId, so we check who userId vouched for
    // But for distance, we want "who can reach seed" not "who seed can reach"
    // So we check reverse: who vouched for userId (they are closer to userId than to seed)

    // Actually, let's think about this more carefully:
    // Seed distance = how many hops to reach a seed via trust edges
    // If A vouches for B, there's a trust edge A -> B
    // Seed distance for B = min distance via vouchers
    // So if Seed S exists, S has distance 0
    // If A vouches for S (A -> S), then A has distance 1
    // If B vouches for A (B -> A), then B has distance 2

    // We need: for each user, find shortest path to any seed following trust edges backward
    // Actually simpler: for each user, find if there's a trust path FROM them TO seed

    // Let's redo: trustMatrix[toUserId][fromUserId] = trust
    // Edge direction is fromUserId -> toUserId
    // To find path FROM user TO seed, we follow edges normally
    // So BFS starting from all users, trying to reach seeds

    // Actually, let's use a different approach: BFS from seeds outward using reverse edges
    // Reverse edge: if A -> B exists, reverse is B -> A
    // BFS from seeds on reverse graph gives distance TO seed

    // Check reverse edges (users who this user has vouched for)
    const outgoingTo = reverseAdj.get(userId);
    if (outgoingTo) {
      for (const voucheeId of outgoingTo) {
        if (!distances.has(voucheeId)) {
          distances.set(voucheeId, distance + 1);
          queue.push({ userId: voucheeId, distance: distance + 1 });
        }
      }
    }
  }

  return distances;
}

/**
 * Get trust score for a specific user.
 */
export async function getUserTrustScore(
  prisma: PrismaClient,
  userId: string
): Promise<{
  rawScore: number;
  decayedScore: number;
  tier: string;
  seedDistance: number | null;
} | null> {
  const trustScore = await prisma.trustScore.findUnique({
    where: { userId },
  });

  if (!trustScore) return null;

  return {
    rawScore: trustScore.rawScore,
    decayedScore: trustScore.decayedScore,
    tier: trustScore.tier,
    seedDistance: trustScore.seedDistance,
  };
}

/**
 * Get trust tier statistics.
 */
export async function getTrustTierStats(prisma: PrismaClient): Promise<TrustTierStats> {
  const [gold, silver, bronze, shadow] = await Promise.all([
    prisma.trustScore.count({ where: { tier: 'gold' } }),
    prisma.trustScore.count({ where: { tier: 'silver' } }),
    prisma.trustScore.count({ where: { tier: 'bronze' } }),
    prisma.trustScore.count({ where: { tier: 'shadow' } }),
  ]);

  return { gold, silver, bronze, shadow };
}

/**
 * Add a user as a seed node.
 */
export async function addSeedNode(
  prisma: PrismaClient,
  userId: string,
  reason?: string,
  addedBy?: string
): Promise<void> {
  await prisma.seedNode.upsert({
    where: { userId },
    update: { active: true, reason: reason ?? null, addedBy: addedBy ?? null },
    create: { userId, reason: reason ?? null, addedBy: addedBy ?? null },
  });
}

/**
 * Remove a user from seed nodes.
 */
export async function removeSeedNode(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  await prisma.seedNode.update({
    where: { userId },
    data: { active: false },
  });
}

/**
 * Get users in a specific trust tier.
 */
export async function getUsersByTier(
  prisma: PrismaClient,
  tier: 'gold' | 'silver' | 'bronze' | 'shadow',
  limit: number = 50
): Promise<Array<{ userId: string; decayedScore: number; seedDistance: number | null }>> {
  const scores = await prisma.trustScore.findMany({
    where: { tier },
    orderBy: { decayedScore: 'desc' },
    take: limit,
    select: {
      userId: true,
      decayedScore: true,
      seedDistance: true,
    },
  });

  return scores;
}

/**
 * Check if a user is in the "Shadow Realm" (no path to seed nodes).
 * Per governance.md: Shadow realm users' content is invisible unless exploration mode.
 */
export async function isInShadowRealm(
  prisma: PrismaClient,
  userId: string
): Promise<boolean> {
  const trustScore = await prisma.trustScore.findUnique({
    where: { userId },
    select: { tier: true, seedDistance: true },
  });

  // User is in shadow realm if:
  // 1. No trust score computed yet
  // 2. Tier is 'shadow'
  // 3. No path to seed nodes (seedDistance is null)
  if (!trustScore) return true;
  if (trustScore.tier === 'shadow') return true;
  if (trustScore.seedDistance === null) return true;

  return false;
}

/**
 * Get trust network for feed personalization.
 * Returns a map of userId -> trustWeight for users within N hops.
 */
export async function getTrustNetworkForUser(
  prisma: PrismaClient,
  userId: string,
  maxHops: number = 3
): Promise<Map<string, number>> {
  const network = new Map<string, number>();

  // Get direct vouches
  const vouches = await prisma.vouch.findMany({
    where: { voucherId: userId, active: true },
    select: { voucheeId: true, stake: true },
  });

  // BFS to build network
  const queue: Array<{ id: string; distance: number; weight: number }> = [];
  const visited = new Set<string>([userId]);

  for (const vouch of vouches) {
    queue.push({ id: vouch.voucheeId, distance: 1, weight: vouch.stake });
    visited.add(vouch.voucheeId);
    network.set(vouch.voucheeId, vouch.stake);
  }

  while (queue.length > 0) {
    const { id, distance, weight } = queue.shift()!;

    if (distance >= maxHops) continue;

    // Get vouches from this user
    const nextVouches = await prisma.vouch.findMany({
      where: { voucherId: id, active: true },
      select: { voucheeId: true, stake: true },
    });

    for (const v of nextVouches) {
      if (!visited.has(v.voucheeId)) {
        visited.add(v.voucheeId);
        // Decay trust by distance
        const decayedWeight = weight * v.stake * Math.pow(0.5, distance);
        network.set(v.voucheeId, decayedWeight);
        queue.push({ id: v.voucheeId, distance: distance + 1, weight: decayedWeight });
      }
    }
  }

  return network;
}

export const eigentrustConstants = {
  MAX_ITERATIONS,
  CONVERGENCE_THRESHOLD,
  DAMPING_FACTOR,
  TIER_THRESHOLDS,
  DECAY_LAMBDA,
  DECAY_TIME_UNIT_MS,
};
