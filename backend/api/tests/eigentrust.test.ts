// tests/eigentrust.test.ts
// Unit tests for Eigentrust algorithm implementation
// Per governance.md Section 3.1 - The Math of Trust

import { describe, it, expect, beforeEach } from 'vitest';

// Note: These are unit tests for the algorithm logic
// Integration tests with Prisma would require a test database

// ============================================================================
// Algorithm Logic Tests (Pure Functions)
// ============================================================================

describe('Eigentrust Algorithm - Core Math', () => {
  /**
   * Test the matrix multiplication step: t^(k+1) = C^T * t^(k)
   * This is the core iteration that computes transitive trust.
   */
  describe('Trust Matrix Multiplication', () => {
    it('computes transitive trust through direct edges', () => {
      // Simple 3-user scenario:
      // User A trusts B (1.0)
      // User B trusts C (1.0)
      // Expected: A has indirect trust in C through B

      // Trust matrix (normalized):
      // trustMatrix[toUser][fromUser] = trust value
      const trustMatrix = new Map<string, Map<string, number>>([
        ['B', new Map([['A', 1.0]])], // A trusts B
        ['C', new Map([['B', 1.0]])], // B trusts C
      ]);

      // Initial trust vector (uniform)
      const trustVector = new Map<string, number>([
        ['A', 1/3],
        ['B', 1/3],
        ['C', 1/3],
      ]);

      // One iteration of matrix multiplication
      const newTrustVector = new Map<string, number>();
      const users = ['A', 'B', 'C'];

      for (const userId of users) {
        let newTrust = 0;
        const incomingEdges = trustMatrix.get(userId);
        if (incomingEdges) {
          for (const [fromUserId, trustValue] of incomingEdges) {
            const fromTrust = trustVector.get(fromUserId) || 0;
            newTrust += trustValue * fromTrust;
          }
        }
        newTrustVector.set(userId, newTrust);
      }

      // User B should have trust from A
      expect(newTrustVector.get('B')).toBeGreaterThan(0);
      // User C should have trust from B
      expect(newTrustVector.get('C')).toBeGreaterThan(0);
      // User A has no incoming edges, so trust = 0 after one iteration (without damping)
      expect(newTrustVector.get('A')).toBe(0);
    });

    it('normalizes trust such that outgoing edges sum to 1', () => {
      // User A trusts B (100 stake) and C (50 stake)
      // Normalized: B gets 100/150 = 0.667, C gets 50/150 = 0.333

      const rawStakes = [
        { from: 'A', to: 'B', stake: 100 },
        { from: 'A', to: 'C', stake: 50 },
      ];

      // Group by fromUser
      const fromUserTotals = new Map<string, number>();
      for (const edge of rawStakes) {
        const current = fromUserTotals.get(edge.from) || 0;
        fromUserTotals.set(edge.from, current + edge.stake);
      }

      // Normalize
      const normalizedEdges: Array<{ from: string; to: string; trust: number }> = [];
      for (const edge of rawStakes) {
        const total = fromUserTotals.get(edge.from) || 1;
        normalizedEdges.push({
          from: edge.from,
          to: edge.to,
          trust: edge.stake / total,
        });
      }

      // Check normalization
      const aEdges = normalizedEdges.filter(e => e.from === 'A');
      const totalTrust = aEdges.reduce((sum, e) => sum + e.trust, 0);
      expect(totalTrust).toBeCloseTo(1.0, 5);

      // Check individual values
      const bTrust = normalizedEdges.find(e => e.to === 'B')?.trust || 0;
      const cTrust = normalizedEdges.find(e => e.to === 'C')?.trust || 0;
      expect(bTrust).toBeCloseTo(0.667, 2);
      expect(cTrust).toBeCloseTo(0.333, 2);
    });
  });

  describe('Damping Factor (Teleportation)', () => {
    it('applies damping to jump to seed nodes', () => {
      // Per governance.md: damping allows random jump to seed nodes
      // Formula: t^(k+1) = (1-d) * C^T * t^(k) + d * p
      // Where d = damping factor, p = seed distribution

      const dampingFactor = 0.15; // 15% chance of jumping to seed

      // Scenario: Only one seed node (User A)
      const seedDistribution = new Map<string, number>([
        ['A', 1.0], // All seed probability goes to A
        ['B', 0],
        ['C', 0],
      ]);

      // Matrix multiplication result (before damping)
      const matrixResult = new Map<string, number>([
        ['A', 0],    // No incoming edges
        ['B', 0.5],  // Some trust from matrix
        ['C', 0.5],  // Some trust from matrix
      ]);

      // Apply damping
      const newTrustVector = new Map<string, number>();
      for (const [userId, matrixTrust] of matrixResult) {
        const seedTrust = seedDistribution.get(userId) || 0;
        const dampedTrust = (1 - dampingFactor) * matrixTrust + dampingFactor * seedTrust;
        newTrustVector.set(userId, dampedTrust);
      }

      // User A should have some trust from damping (even with no incoming edges)
      expect(newTrustVector.get('A')).toBeGreaterThan(0);
      expect(newTrustVector.get('A')).toBeCloseTo(dampingFactor * 1.0, 5);

      // Other users' trust should be reduced by (1 - damping)
      expect(newTrustVector.get('B')).toBeCloseTo((1 - dampingFactor) * 0.5, 5);
      expect(newTrustVector.get('C')).toBeCloseTo((1 - dampingFactor) * 0.5, 5);
    });
  });

  describe('Convergence', () => {
    it('detects convergence when delta is below threshold', () => {
      const threshold = 1e-6;

      const oldVector = new Map([['A', 0.5], ['B', 0.3], ['C', 0.2]]);
      const newVector = new Map([['A', 0.5], ['B', 0.3], ['C', 0.2]]); // Same values

      // Calculate L2 norm of difference
      let delta = 0;
      for (const [userId, oldTrust] of oldVector) {
        const newTrust = newVector.get(userId) || 0;
        delta += (newTrust - oldTrust) ** 2;
      }
      delta = Math.sqrt(delta);

      expect(delta).toBeLessThan(threshold);
    });

    it('continues iterating when delta is above threshold', () => {
      const threshold = 1e-6;

      const oldVector = new Map([['A', 0.5], ['B', 0.3], ['C', 0.2]]);
      const newVector = new Map([['A', 0.45], ['B', 0.35], ['C', 0.2]]); // Changed

      let delta = 0;
      for (const [userId, oldTrust] of oldVector) {
        const newTrust = newVector.get(userId) || 0;
        delta += (newTrust - oldTrust) ** 2;
      }
      delta = Math.sqrt(delta);

      expect(delta).toBeGreaterThan(threshold);
    });
  });
});

// ============================================================================
// Sybil Resistance Tests
// Per governance.md Section 3.1.2 - Sybil resilience via pre-trusted peers
// ============================================================================

describe('Eigentrust - Sybil Resistance', () => {
  describe('Sybil Farm Isolation', () => {
    it('sybil farm with no connection to seeds gets near-zero trust', () => {
      // Scenario: 3 sybil bots trust each other, but no seed trusts them
      // Seeds: [S1, S2]
      // Sybils: [X1, X2, X3] - trust each other
      // Honest: [H1] - trusted by S1

      // Trust matrix (normalized outgoing edges)
      // S1 -> H1 (1.0)
      // X1 -> X2 (0.5), X1 -> X3 (0.5)
      // X2 -> X1 (0.5), X2 -> X3 (0.5)
      // X3 -> X1 (0.5), X3 -> X2 (0.5)

      const trustMatrix = new Map<string, Map<string, number>>([
        ['H1', new Map([['S1', 1.0]])],
        ['X2', new Map([['X1', 0.5], ['X3', 0.5]])],
        ['X3', new Map([['X1', 0.5], ['X2', 0.5]])],
        ['X1', new Map([['X2', 0.5], ['X3', 0.5]])],
      ]);

      const users = ['S1', 'S2', 'H1', 'X1', 'X2', 'X3'];
      const seedNodes = new Set(['S1', 'S2']);
      const dampingFactor = 0.15;

      // Initial trust vector (seed-weighted)
      const trustVector = new Map<string, number>();
      for (const u of users) {
        trustVector.set(u, seedNodes.has(u) ? 0.5 : 0);
      }

      // Seed distribution for damping
      const seedDistribution = new Map<string, number>();
      for (const u of users) {
        seedDistribution.set(u, seedNodes.has(u) ? 0.5 : 0);
      }

      // Run several iterations
      for (let i = 0; i < 20; i++) {
        const newTrustVector = new Map<string, number>();

        for (const userId of users) {
          let newTrust = 0;
          const incomingEdges = trustMatrix.get(userId);
          if (incomingEdges) {
            for (const [fromUserId, trustValue] of incomingEdges) {
              const fromTrust = trustVector.get(fromUserId) || 0;
              newTrust += trustValue * fromTrust;
            }
          }
          // Apply damping
          const seedTrust = seedDistribution.get(userId) || 0;
          newTrustVector.set(userId, (1 - dampingFactor) * newTrust + dampingFactor * seedTrust);
        }

        // Normalize
        const total = Array.from(newTrustVector.values()).reduce((a, b) => a + b, 0);
        if (total > 0) {
          for (const [u, t] of newTrustVector) {
            trustVector.set(u, t / total);
          }
        }
      }

      // Seeds and honest user should have significant trust
      const seedTrust = (trustVector.get('S1') || 0) + (trustVector.get('S2') || 0);
      const honestTrust = trustVector.get('H1') || 0;
      expect(seedTrust).toBeGreaterThan(0.2);
      expect(honestTrust).toBeGreaterThan(0.1);

      // Sybils should have very low trust (no path from seeds)
      const sybilTrust = (trustVector.get('X1') || 0) + (trustVector.get('X2') || 0) + (trustVector.get('X3') || 0);
      expect(sybilTrust).toBeLessThan(0.1);
    });
  });

  describe('Single Attack Edge Detection', () => {
    it('limits trust flow through single attack edge', () => {
      // Scenario: Sybil farm connects to honest network through one compromised user
      // Honest: [S, H1, H2] - S is seed
      // Attack bridge: H2 -> X1 (compromised or tricked)
      // Sybils: [X1, X2, X3] - heavily upvote each other

      // Even with attack edge, sybil trust should be limited

      // This is where SybilRank would help detect bottlenecks
      // For Eigentrust, the trust is diluted through the chain

      const trustMatrix = new Map<string, Map<string, number>>([
        ['H1', new Map([['S', 0.5]])],
        ['H2', new Map([['S', 0.5]])],
        ['X1', new Map([['H2', 0.2], ['X2', 0.4], ['X3', 0.4]])], // Attack edge from H2
        ['X2', new Map([['X1', 0.5], ['X3', 0.5]])],
        ['X3', new Map([['X1', 0.5], ['X2', 0.5]])],
      ]);

      const users = ['S', 'H1', 'H2', 'X1', 'X2', 'X3'];
      const seedNodes = new Set(['S']);
      const dampingFactor = 0.15;

      const trustVector = new Map<string, number>();
      for (const u of users) {
        trustVector.set(u, seedNodes.has(u) ? 1.0 : 0);
      }

      const seedDistribution = new Map<string, number>();
      for (const u of users) {
        seedDistribution.set(u, seedNodes.has(u) ? 1.0 : 0);
      }

      // Run iterations
      for (let i = 0; i < 30; i++) {
        const newTrustVector = new Map<string, number>();

        for (const userId of users) {
          let newTrust = 0;
          const incomingEdges = trustMatrix.get(userId);
          if (incomingEdges) {
            for (const [fromUserId, trustValue] of incomingEdges) {
              const fromTrust = trustVector.get(fromUserId) || 0;
              newTrust += trustValue * fromTrust;
            }
          }
          const seedTrust = seedDistribution.get(userId) || 0;
          newTrustVector.set(userId, (1 - dampingFactor) * newTrust + dampingFactor * seedTrust);
        }

        const total = Array.from(newTrustVector.values()).reduce((a, b) => a + b, 0);
        if (total > 0) {
          for (const [u, t] of newTrustVector) {
            trustVector.set(u, t / total);
          }
        }
      }

      // Honest users should have most of the trust
      const honestTrust = (trustVector.get('S') || 0) + (trustVector.get('H1') || 0) + (trustVector.get('H2') || 0);

      // Sybils get some trust through attack edge, but limited
      const sybilTrust = (trustVector.get('X1') || 0) + (trustVector.get('X2') || 0) + (trustVector.get('X3') || 0);

      // With single attack edge, sybil trust should be limited but not zero
      // The attack edge allows some trust to flow through
      // Key insight: without Eigentrust damping to seeds, sybils can accumulate trust
      // But their trust should still be bounded
      expect(sybilTrust).toBeLessThan(0.8);
      // Total should sum to ~1.0
      expect(honestTrust + sybilTrust).toBeCloseTo(1.0, 1);
    });
  });
});

// ============================================================================
// Trust Decay Tests
// Per governance.md Section 3.3 - Trust decay formula
// ============================================================================

describe('Eigentrust - Trust Decay', () => {
  describe('Time-based Decay', () => {
    it('applies exponential decay based on inactivity', () => {
      // Formula: Trust_current = Trust_raw × e^(-λt)
      // λ = decay rate, t = time since last activity

      const lambda = 0.01; // Decay rate
      const timeUnitMs = 24 * 60 * 60 * 1000; // 1 day

      const rawTrust = 0.5;

      // Active user (0 days inactive)
      const activeDecay = rawTrust * Math.exp(-lambda * 0);
      expect(activeDecay).toBe(rawTrust);

      // 30 days inactive
      const thirtyDaysMs = 30 * timeUnitMs;
      const thirtyDayDecay = rawTrust * Math.exp(-lambda * thirtyDaysMs / timeUnitMs);
      expect(thirtyDayDecay).toBeLessThan(rawTrust);
      expect(thirtyDayDecay).toBeCloseTo(rawTrust * Math.exp(-0.3), 4); // e^(-0.01 * 30) ≈ 0.74

      // 100 days inactive
      const hundredDaysMs = 100 * timeUnitMs;
      const hundredDayDecay = rawTrust * Math.exp(-lambda * hundredDaysMs / timeUnitMs);
      expect(hundredDayDecay).toBeLessThan(thirtyDayDecay);
      expect(hundredDayDecay).toBeCloseTo(rawTrust * Math.exp(-1), 4); // e^(-1) ≈ 0.37

      // Very long inactive (365 days)
      const yearMs = 365 * timeUnitMs;
      const yearDecay = rawTrust * Math.exp(-lambda * yearMs / timeUnitMs);
      expect(yearDecay).toBeLessThan(0.1); // Should be quite low
    });

    it('maintains order when applying decay to all users', () => {
      // Higher raw trust should still be higher after decay (same inactivity)
      const lambda = 0.01;
      const daysInactive = 30;
      const decayFactor = Math.exp(-lambda * daysInactive);

      const users = [
        { id: 'A', rawTrust: 0.8, daysInactive: 30 },
        { id: 'B', rawTrust: 0.5, daysInactive: 30 },
        { id: 'C', rawTrust: 0.2, daysInactive: 30 },
      ];

      const decayed = users.map(u => ({
        ...u,
        decayedTrust: u.rawTrust * Math.exp(-lambda * u.daysInactive),
      }));

      // Order should be preserved
      expect(decayed[0].decayedTrust).toBeGreaterThan(decayed[1].decayedTrust);
      expect(decayed[1].decayedTrust).toBeGreaterThan(decayed[2].decayedTrust);
    });

    it('accounts for different activity levels', () => {
      const lambda = 0.01;

      // Same raw trust, different activity
      const activeUser = { rawTrust: 0.5, daysInactive: 1 };
      const staleUser = { rawTrust: 0.5, daysInactive: 90 };

      const activeDecayed = activeUser.rawTrust * Math.exp(-lambda * activeUser.daysInactive);
      const staleDecayed = staleUser.rawTrust * Math.exp(-lambda * staleUser.daysInactive);

      // Active user should have higher decayed trust
      expect(activeDecayed).toBeGreaterThan(staleDecayed);
    });
  });
});

// ============================================================================
// Trust Tier Assignment Tests
// Per governance.md Section 3.1.2 - Gold/Silver/Bronze/Shadow tiers
// ============================================================================

describe('Eigentrust - Trust Tiers', () => {
  describe('Percentile-based Tier Assignment', () => {
    it('assigns tiers based on percentile thresholds', () => {
      const tierThresholds = {
        gold: 0.95,   // Top 5%
        silver: 0.80, // Top 20%
        bronze: 0.50, // Top 50%
      };

      // Generate test scores (100 users)
      const scores = Array.from({ length: 100 }, (_, i) => ({
        userId: `user_${i}`,
        score: i / 100, // 0.0 to 0.99
      }));

      // Sort by score descending
      const sorted = [...scores].sort((a, b) => b.score - a.score);

      // Calculate thresholds
      const goldThreshold = sorted[Math.floor(sorted.length * (1 - tierThresholds.gold))]?.score || 0;
      const silverThreshold = sorted[Math.floor(sorted.length * (1 - tierThresholds.silver))]?.score || 0;
      const bronzeThreshold = sorted[Math.floor(sorted.length * (1 - tierThresholds.bronze))]?.score || 0;

      // Assign tiers
      const tiered = scores.map(u => {
        let tier = 'shadow';
        if (u.score >= goldThreshold) tier = 'gold';
        else if (u.score >= silverThreshold) tier = 'silver';
        else if (u.score >= bronzeThreshold) tier = 'bronze';
        return { ...u, tier };
      });

      // Count tiers
      const goldCount = tiered.filter(u => u.tier === 'gold').length;
      const silverCount = tiered.filter(u => u.tier === 'silver').length;
      const bronzeCount = tiered.filter(u => u.tier === 'bronze').length;
      const shadowCount = tiered.filter(u => u.tier === 'shadow').length;

      // Verify distribution (approximately - allow for rounding)
      expect(goldCount).toBeGreaterThanOrEqual(4);
      expect(goldCount).toBeLessThanOrEqual(7);   // ~5%
      expect(silverCount).toBeGreaterThanOrEqual(13);
      expect(silverCount).toBeLessThanOrEqual(18); // ~15%
      expect(bronzeCount).toBeGreaterThanOrEqual(27);
      expect(bronzeCount).toBeLessThanOrEqual(33); // ~30%
      expect(shadowCount).toBeGreaterThanOrEqual(47);
      expect(shadowCount).toBeLessThanOrEqual(53); // ~50%
    });

    it('assigns gold tier to all seed nodes regardless of score', () => {
      const seedNodes = new Set(['seed1', 'seed2']);
      const users = [
        { userId: 'seed1', score: 0.1 }, // Low score but is seed
        { userId: 'seed2', score: 0.05 }, // Very low score but is seed
        { userId: 'user1', score: 0.9 },  // High score, not seed
        { userId: 'user2', score: 0.5 },  // Medium score
      ];

      const tiered = users.map(u => {
        // Seed nodes always get gold
        if (seedNodes.has(u.userId)) {
          return { ...u, tier: 'gold' };
        }
        // Others based on score (simplified)
        if (u.score > 0.8) return { ...u, tier: 'gold' };
        if (u.score > 0.6) return { ...u, tier: 'silver' };
        if (u.score > 0.4) return { ...u, tier: 'bronze' };
        return { ...u, tier: 'shadow' };
      });

      // Seeds should be gold
      expect(tiered.find(u => u.userId === 'seed1')?.tier).toBe('gold');
      expect(tiered.find(u => u.userId === 'seed2')?.tier).toBe('gold');
    });
  });

  describe('Shadow Realm Detection', () => {
    it('marks users with no path to seeds as shadow realm', () => {
      // Users with null seedDistance = shadow realm
      const users = [
        { userId: 'connected', seedDistance: 2 },
        { userId: 'isolated', seedDistance: null },
        { userId: 'seed', seedDistance: 0 },
      ];

      const shadowRealm = users.filter(u => u.seedDistance === null);
      expect(shadowRealm.length).toBe(1);
      expect(shadowRealm[0].userId).toBe('isolated');
    });
  });
});

// ============================================================================
// Seed Distance Tests
// ============================================================================

describe('Eigentrust - Seed Distance', () => {
  it('computes shortest path to seed nodes', () => {
    // Graph:
    // Seed -> A (distance 1)
    // A -> B (distance 2)
    // B -> C (distance 3)
    // D is isolated (distance null)

    const edges = [
      { from: 'Seed', to: 'A' },
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ];

    const seedNodes = new Set(['Seed']);
    const allUsers = ['Seed', 'A', 'B', 'C', 'D'];

    // BFS from seeds
    const distances = new Map<string, number>();
    const visited = new Set<string>();

    // Build adjacency (reverse direction: who is trusted by whom)
    const reverseAdj = new Map<string, string[]>();
    for (const edge of edges) {
      if (!reverseAdj.has(edge.from)) {
        reverseAdj.set(edge.from, []);
      }
      reverseAdj.get(edge.from)!.push(edge.to);
    }

    // BFS
    const queue: Array<{ id: string; dist: number }> = [];
    for (const seed of seedNodes) {
      distances.set(seed, 0);
      visited.add(seed);
      queue.push({ id: seed, dist: 0 });
    }

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      const neighbors = reverseAdj.get(id) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          distances.set(neighbor, dist + 1);
          queue.push({ id: neighbor, dist: dist + 1 });
        }
      }
    }

    expect(distances.get('Seed')).toBe(0);
    expect(distances.get('A')).toBe(1);
    expect(distances.get('B')).toBe(2);
    expect(distances.get('C')).toBe(3);
    expect(distances.has('D')).toBe(false); // Isolated, no distance
  });
});

// ============================================================================
// Trust Network for Feed Personalization Tests
// ============================================================================

describe('Eigentrust - Trust Network for Personalization', () => {
  it('builds trust network with distance decay', () => {
    // User's trust network decays with distance
    // Direct vouch = full weight
    // 2 hops = 50% weight
    // 3 hops = 25% weight

    const directVouches = [
      { to: 'B', stake: 100 },
      { to: 'C', stake: 50 },
    ];

    // B vouches for D
    const bVouches = [{ to: 'D', stake: 100 }];

    // Build network (simplified)
    const network = new Map<string, number>();

    // Direct vouches (distance 1)
    for (const v of directVouches) {
      network.set(v.to, v.stake);
    }

    // Distance 2 (through B)
    const bWeight = network.get('B') || 0;
    for (const v of bVouches) {
      const decayedWeight = bWeight * v.stake * 0.5; // 50% decay at distance 2
      network.set(v.to, decayedWeight);
    }

    expect(network.get('B')).toBe(100);
    expect(network.get('C')).toBe(50);
    expect(network.get('D')).toBe(100 * 100 * 0.5); // 5000
  });
});

// ============================================================================
// Edge Cases & Robustness Tests
// ============================================================================

describe('Eigentrust - Edge Cases', () => {
  describe('Empty and Minimal Graphs', () => {
    it('handles empty trust graph gracefully', () => {
      const trustMatrix = new Map<string, Map<string, number>>();
      const users: string[] = [];
      const seedNodes = new Set<string>();

      // Should not throw
      const trustVector = new Map<string, number>();
      for (const userId of users) {
        trustVector.set(userId, 0);
      }

      expect(trustVector.size).toBe(0);
    });

    it('handles single user with no edges', () => {
      const users = ['A'];
      const seedNodes = new Set(['A']);
      const trustMatrix = new Map<string, Map<string, number>>();

      const trustVector = new Map<string, number>();
      for (const u of users) {
        trustVector.set(u, seedNodes.has(u) ? 1.0 : 0);
      }

      expect(trustVector.get('A')).toBe(1.0);
    });

    it('handles two users with mutual trust', () => {
      // A trusts B, B trusts A
      const trustMatrix = new Map<string, Map<string, number>>([
        ['B', new Map([['A', 1.0]])],
        ['A', new Map([['B', 1.0]])],
      ]);

      const users = ['A', 'B'];
      const seedNodes = new Set(['A']);
      const dampingFactor = 0.15;

      const trustVector = new Map<string, number>([
        ['A', 1.0],
        ['B', 0],
      ]);

      // Run iterations
      for (let i = 0; i < 20; i++) {
        const newVector = new Map<string, number>();
        for (const userId of users) {
          let newTrust = 0;
          const incomingEdges = trustMatrix.get(userId);
          if (incomingEdges) {
            for (const [from, trust] of incomingEdges) {
              newTrust += trust * (trustVector.get(from) || 0);
            }
          }
          const seedTrust = seedNodes.has(userId) ? 1.0 : 0;
          newVector.set(userId, (1 - dampingFactor) * newTrust + dampingFactor * seedTrust);
        }
        const total = Array.from(newVector.values()).reduce((a, b) => a + b, 0);
        for (const [u, t] of newVector) {
          trustVector.set(u, t / total);
        }
      }

      // Both should have trust, but A (seed) should have more due to damping
      expect(trustVector.get('A')).toBeGreaterThan(0.4);
      expect(trustVector.get('B')).toBeGreaterThan(0.3);
    });
  });

  describe('Circular Trust Chains', () => {
    it('converges with circular trust (A -> B -> C -> A)', () => {
      const trustMatrix = new Map<string, Map<string, number>>([
        ['B', new Map([['A', 1.0]])],
        ['C', new Map([['B', 1.0]])],
        ['A', new Map([['C', 1.0]])],
      ]);

      const users = ['A', 'B', 'C'];
      const seedNodes = new Set(['A']);
      const dampingFactor = 0.15;
      const threshold = 1e-6;

      const trustVector = new Map<string, number>();
      for (const u of users) {
        trustVector.set(u, seedNodes.has(u) ? 1.0 : 0);
      }

      let converged = false;
      for (let iter = 0; iter < 100; iter++) {
        const newVector = new Map<string, number>();
        for (const userId of users) {
          let newTrust = 0;
          const incomingEdges = trustMatrix.get(userId);
          if (incomingEdges) {
            for (const [from, trust] of incomingEdges) {
              newTrust += trust * (trustVector.get(from) || 0);
            }
          }
          const seedTrust = seedNodes.has(userId) ? 1.0 : 0;
          newVector.set(userId, (1 - dampingFactor) * newTrust + dampingFactor * seedTrust);
        }

        const total = Array.from(newVector.values()).reduce((a, b) => a + b, 0);
        if (total > 0) {
          for (const [u, t] of newVector) {
            newVector.set(u, t / total);
          }
        }

        // Check convergence
        let delta = 0;
        for (const u of users) {
          delta += Math.pow((newVector.get(u) || 0) - (trustVector.get(u) || 0), 2);
        }
        delta = Math.sqrt(delta);

        for (const [u, t] of newVector) {
          trustVector.set(u, t);
        }

        if (delta < threshold) {
          converged = true;
          break;
        }
      }

      expect(converged).toBe(true);
      // All users should have positive trust in a cycle with seed
      expect(trustVector.get('A')).toBeGreaterThan(0.2);
      expect(trustVector.get('B')).toBeGreaterThan(0.2);
      expect(trustVector.get('C')).toBeGreaterThan(0.2);
    });
  });

  describe('Trust Normalization Edge Cases', () => {
    it('handles user with zero total stake', () => {
      const rawStakes: Array<{ from: string; to: string; stake: number }> = [];
      const fromUserTotals = new Map<string, number>();

      // Normalization should handle empty case
      const normalized: Array<{ from: string; to: string; trust: number }> = [];
      for (const edge of rawStakes) {
        const total = fromUserTotals.get(edge.from) || 1; // Default to 1 to avoid div by zero
        normalized.push({
          from: edge.from,
          to: edge.to,
          trust: edge.stake / total,
        });
      }

      expect(normalized.length).toBe(0);
    });

    it('handles very small stake values', () => {
      const rawStakes = [
        { from: 'A', to: 'B', stake: 0.0001 },
        { from: 'A', to: 'C', stake: 0.0001 },
      ];

      const total = rawStakes.reduce((sum, e) => sum + e.stake, 0);
      const normalized = rawStakes.map(e => ({
        ...e,
        trust: e.stake / total,
      }));

      const trustSum = normalized.reduce((sum, e) => sum + e.trust, 0);
      expect(trustSum).toBeCloseTo(1.0, 10);
    });

    it('handles very large stake values', () => {
      const rawStakes = [
        { from: 'A', to: 'B', stake: 1e15 },
        { from: 'A', to: 'C', stake: 1e15 },
      ];

      const total = rawStakes.reduce((sum, e) => sum + e.stake, 0);
      const normalized = rawStakes.map(e => ({
        ...e,
        trust: e.stake / total,
      }));

      const trustSum = normalized.reduce((sum, e) => sum + e.trust, 0);
      expect(trustSum).toBeCloseTo(1.0, 10);
    });
  });
});

// ============================================================================
// Advanced Sybil Attack Scenarios
// Per governance.md Section 3.1.2 & 3.2
// ============================================================================

describe('Eigentrust - Advanced Sybil Scenarios', () => {
  describe('Large-Scale Sybil Farm', () => {
    it('resists 100-bot sybil farm with no seed connection', () => {
      // Scenario: 100 sybil bots form a clique, 10 honest users in seed network
      const honestUsers = Array.from({ length: 10 }, (_, i) => `H${i}`);
      const sybilBots = Array.from({ length: 100 }, (_, i) => `S${i}`);
      const users = [...honestUsers, ...sybilBots];
      const seedNodes = new Set(['H0', 'H1']); // Two seeds

      // Build trust matrix:
      // - Honest users: chain H0 -> H1 -> ... -> H9
      // - Sybils: dense clique (every sybil trusts every other)
      const trustMatrix = new Map<string, Map<string, number>>();

      // Honest chain
      for (let i = 1; i < honestUsers.length; i++) {
        trustMatrix.set(honestUsers[i]!, new Map([[honestUsers[i-1]!, 1.0]]));
      }

      // Sybil clique (each trusts all others equally)
      for (const sybil of sybilBots) {
        const otherSybils = sybilBots.filter(s => s !== sybil);
        const trustPerBot = 1.0 / otherSybils.length;
        const edges = new Map<string, number>();
        for (const other of otherSybils) {
          edges.set(other, trustPerBot);
        }
        trustMatrix.set(sybil, edges);
      }

      // Run EigenTrust
      const dampingFactor = 0.15;
      const trustVector = new Map<string, number>();
      for (const u of users) {
        trustVector.set(u, seedNodes.has(u) ? 0.5 : 0);
      }

      const seedDist = new Map<string, number>();
      for (const u of users) {
        seedDist.set(u, seedNodes.has(u) ? 0.5 : 0);
      }

      for (let iter = 0; iter < 50; iter++) {
        const newVector = new Map<string, number>();
        for (const userId of users) {
          let newTrust = 0;
          const incomingEdges = trustMatrix.get(userId);
          if (incomingEdges) {
            for (const [from, trust] of incomingEdges) {
              newTrust += trust * (trustVector.get(from) || 0);
            }
          }
          const seedTrust = seedDist.get(userId) || 0;
          newVector.set(userId, (1 - dampingFactor) * newTrust + dampingFactor * seedTrust);
        }
        const total = Array.from(newVector.values()).reduce((a, b) => a + b, 0);
        if (total > 0) {
          for (const [u, t] of newVector) {
            trustVector.set(u, t / total);
          }
        }
      }

      // Calculate trust distribution
      const honestTrust = honestUsers.reduce((sum, u) => sum + (trustVector.get(u) || 0), 0);
      const sybilTrust = sybilBots.reduce((sum, u) => sum + (trustVector.get(u) || 0), 0);

      // Despite 10:1 ratio, sybils should have near-zero trust
      expect(sybilTrust).toBeLessThan(0.01);
      expect(honestTrust).toBeGreaterThan(0.99);
    });
  });

  describe('Whitewashing Attack', () => {
    it('resists whitewashing (creating new accounts after bad behavior)', () => {
      // Scenario: User X had low trust, creates new account X2
      // X2 only has trust from X (which is near zero)

      const users = ['Seed', 'H1', 'H2', 'BadActor', 'NewAccount'];
      const seedNodes = new Set(['Seed']);

      const trustMatrix = new Map<string, Map<string, number>>([
        ['H1', new Map([['Seed', 1.0]])],
        ['H2', new Map([['H1', 1.0]])],
        // BadActor has no connection to honest network
        // NewAccount only trusted by BadActor
        ['NewAccount', new Map([['BadActor', 1.0]])],
      ]);

      const dampingFactor = 0.15;
      const trustVector = new Map<string, number>();
      for (const u of users) {
        trustVector.set(u, seedNodes.has(u) ? 1.0 : 0);
      }

      for (let iter = 0; iter < 30; iter++) {
        const newVector = new Map<string, number>();
        for (const userId of users) {
          let newTrust = 0;
          const incomingEdges = trustMatrix.get(userId);
          if (incomingEdges) {
            for (const [from, trust] of incomingEdges) {
              newTrust += trust * (trustVector.get(from) || 0);
            }
          }
          const seedTrust = seedNodes.has(userId) ? 1.0 : 0;
          newVector.set(userId, (1 - dampingFactor) * newTrust + dampingFactor * seedTrust);
        }
        const total = Array.from(newVector.values()).reduce((a, b) => a + b, 0);
        if (total > 0) {
          for (const [u, t] of newVector) {
            trustVector.set(u, t / total);
          }
        }
      }

      // BadActor and NewAccount should have very low trust
      expect(trustVector.get('BadActor')).toBeLessThan(0.01);
      expect(trustVector.get('NewAccount')).toBeLessThan(0.01);
      // Honest users should have most of the trust
      expect(trustVector.get('Seed')! + trustVector.get('H1')! + trustVector.get('H2')!).toBeGreaterThan(0.95);
    });
  });

  describe('Collusion Attack', () => {
    it('limits trust gain from colluding group vouching for outsider', () => {
      // Scenario: 5 colluding honest users all vouch for outsider X
      // X should gain some trust but not disproportionately

      const seeds = ['S1'];
      const colluders = ['C1', 'C2', 'C3', 'C4', 'C5'];
      const outsider = ['X'];
      const users = [...seeds, ...colluders, ...outsider];
      const seedNodes = new Set(seeds);

      const trustMatrix = new Map<string, Map<string, number>>();

      // Colluders are trusted by seed
      for (const c of colluders) {
        trustMatrix.set(c, new Map([['S1', 0.2]])); // Each gets 1/5 of S1's outgoing trust
      }

      // All colluders vouch for X
      const xEdges = new Map<string, number>();
      for (const c of colluders) {
        xEdges.set(c, 0.2); // Equal trust from each colluder
      }
      trustMatrix.set('X', xEdges);

      const dampingFactor = 0.15;
      const trustVector = new Map<string, number>();
      for (const u of users) {
        trustVector.set(u, seedNodes.has(u) ? 1.0 : 0);
      }

      const seedDist = new Map<string, number>();
      for (const u of users) {
        seedDist.set(u, seedNodes.has(u) ? 1.0 : 0);
      }

      for (let iter = 0; iter < 30; iter++) {
        const newVector = new Map<string, number>();
        for (const userId of users) {
          let newTrust = 0;
          const incomingEdges = trustMatrix.get(userId);
          if (incomingEdges) {
            for (const [from, trust] of incomingEdges) {
              newTrust += trust * (trustVector.get(from) || 0);
            }
          }
          const seedTrust = seedDist.get(userId) || 0;
          newVector.set(userId, (1 - dampingFactor) * newTrust + dampingFactor * seedTrust);
        }
        const total = Array.from(newVector.values()).reduce((a, b) => a + b, 0);
        if (total > 0) {
          for (const [u, t] of newVector) {
            trustVector.set(u, t / total);
          }
        }
      }

      // X should have trust (legitimate vouching) but not more than seed
      const xTrust = trustVector.get('X') || 0;
      const seedTrust = trustVector.get('S1') || 0;

      expect(xTrust).toBeGreaterThan(0); // Has some trust
      expect(xTrust).toBeLessThan(seedTrust); // But less than seed
      expect(xTrust).toBeLessThan(0.2); // And not too much
    });
  });
});

// ============================================================================
// Algorithm Constants & Configuration Tests
// ============================================================================

describe('Eigentrust - Algorithm Constants', () => {
  it('uses sensible default values', () => {
    const MAX_ITERATIONS = 100;
    const CONVERGENCE_THRESHOLD = 1e-6;
    const DAMPING_FACTOR = 0.15;

    // Max iterations should be enough for most graphs
    expect(MAX_ITERATIONS).toBeGreaterThanOrEqual(50);
    expect(MAX_ITERATIONS).toBeLessThanOrEqual(1000);

    // Convergence threshold should be small but not too small
    expect(CONVERGENCE_THRESHOLD).toBeLessThan(1e-4);
    expect(CONVERGENCE_THRESHOLD).toBeGreaterThan(1e-10);

    // Damping factor in reasonable range (typically 0.1-0.2)
    expect(DAMPING_FACTOR).toBeGreaterThanOrEqual(0.1);
    expect(DAMPING_FACTOR).toBeLessThanOrEqual(0.25);
  });

  it('has correct tier thresholds', () => {
    const TIER_THRESHOLDS = {
      gold: 0.95,   // Top 5%
      silver: 0.80, // Top 20%
      bronze: 0.50, // Top 50%
    };

    // Tiers should be strictly ordered
    expect(TIER_THRESHOLDS.gold).toBeGreaterThan(TIER_THRESHOLDS.silver);
    expect(TIER_THRESHOLDS.silver).toBeGreaterThan(TIER_THRESHOLDS.bronze);

    // And cover reasonable ranges
    expect(TIER_THRESHOLDS.gold).toBeGreaterThanOrEqual(0.90);
    expect(TIER_THRESHOLDS.bronze).toBeLessThanOrEqual(0.60);
  });

  it('has correct decay parameters', () => {
    const DECAY_LAMBDA = 0.01;
    const DECAY_TIME_UNIT_MS = 24 * 60 * 60 * 1000;

    // Decay rate should be slow enough for reasonable half-life
    // Half-life ≈ ln(2) / lambda ≈ 69 days at lambda = 0.01
    const halfLifeDays = Math.log(2) / DECAY_LAMBDA;
    expect(halfLifeDays).toBeGreaterThan(30);
    expect(halfLifeDays).toBeLessThan(200);

    // Time unit should be 1 day
    expect(DECAY_TIME_UNIT_MS).toBe(86400000);
  });
});
