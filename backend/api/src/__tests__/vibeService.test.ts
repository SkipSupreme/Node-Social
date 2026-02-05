/**
 * Unit tests for the Vibe Service (src/services/vibeService.ts).
 *
 * The Vibe Service handles the core Phase 0.1 feature: intensity-based
 * multi-vector reactions. These tests verify the pure logic functions
 * (validateIntensities, calculateTotalIntensity) and the async service
 * functions (createOrUpdateReaction, getReactionsForContent, deleteReaction)
 * against a mock Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateIntensities,
  calculateTotalIntensity,
  createOrUpdateReaction,
  getReactionsForContent,
  deleteReaction,
  getAllVibeVectors,
  type VibeIntensities,
} from '../services/vibeService.js';

// Mock Prisma client for service-layer tests
function createServiceMockPrisma() {
  return {
    vibeReaction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vibeVector: {
      findMany: vi.fn(),
    },
    nodeVibeWeight: {
      findMany: vi.fn(),
    },
    postMetric: {
      upsert: vi.fn(),
    },
  } as any;
}

let mockPrisma: ReturnType<typeof createServiceMockPrisma>;

beforeEach(() => {
  mockPrisma = createServiceMockPrisma();
});

// =========================================================================
// validateIntensities (pure function)
// =========================================================================
describe('validateIntensities', () => {
  it('should accept valid intensities between 0 and 1', () => {
    expect(validateIntensities({ funny: 0.5, insightful: 1.0, angry: 0.0 })).toBe(true);
  });

  it('should reject intensity values greater than 1', () => {
    // WHY: Intensities represent a 0-1 scale; values > 1 are invalid.
    expect(validateIntensities({ funny: 1.5 })).toBe(false);
  });

  it('should reject negative intensity values', () => {
    expect(validateIntensities({ funny: -0.1 })).toBe(false);
  });

  it('should reject non-number intensity values', () => {
    expect(validateIntensities({ funny: 'high' as any })).toBe(false);
  });

  it('should accept an empty intensities object', () => {
    // An empty object is technically valid (no vectors selected).
    expect(validateIntensities({})).toBe(true);
  });

  it('should accept exactly 0 and exactly 1', () => {
    expect(validateIntensities({ funny: 0, insightful: 1 })).toBe(true);
  });
});

// =========================================================================
// calculateTotalIntensity (pure function)
// =========================================================================
describe('calculateTotalIntensity', () => {
  it('should sum all intensity values', () => {
    const intensities: VibeIntensities = { funny: 0.5, insightful: 0.3, novel: 0.2 };
    expect(calculateTotalIntensity(intensities)).toBeCloseTo(1.0, 5);
  });

  it('should return 0 for empty intensities', () => {
    expect(calculateTotalIntensity({})).toBe(0);
  });

  it('should handle a single vector', () => {
    expect(calculateTotalIntensity({ funny: 0.7 })).toBeCloseTo(0.7, 5);
  });

  it('should handle maximum intensities on all vectors', () => {
    const intensities: VibeIntensities = {
      funny: 1.0,
      insightful: 1.0,
      angry: 1.0,
      novel: 1.0,
      cursed: 1.0,
    };
    expect(calculateTotalIntensity(intensities)).toBeCloseTo(5.0, 5);
  });
});

// =========================================================================
// createOrUpdateReaction
// =========================================================================
describe('createOrUpdateReaction', () => {
  it('should create a new reaction when none exists', async () => {
    mockPrisma.vibeReaction.findFirst.mockResolvedValue(null);
    mockPrisma.vibeReaction.create.mockResolvedValue({
      id: 'new-reaction',
      userId: 'user-1',
      postId: 'post-1',
      nodeId: 'node-1',
      intensities: { funny: 0.8 },
      totalIntensity: 0.8,
      user: { id: 'user-1', email: 'test@test.com' },
      node: { id: 'node-1', slug: 'test', name: 'Test' },
    });

    const result = await createOrUpdateReaction(mockPrisma, {
      userId: 'user-1',
      postId: 'post-1',
      nodeId: 'node-1',
      intensities: { funny: 0.8 },
    });

    expect(result.id).toBe('new-reaction');
    expect(mockPrisma.vibeReaction.create).toHaveBeenCalled();
    expect(mockPrisma.vibeReaction.update).not.toHaveBeenCalled();
  });

  it('should update an existing reaction', async () => {
    mockPrisma.vibeReaction.findFirst.mockResolvedValue({
      id: 'existing-reaction',
      userId: 'user-1',
      postId: 'post-1',
      nodeId: 'node-1',
    });
    mockPrisma.vibeReaction.update.mockResolvedValue({
      id: 'existing-reaction',
      userId: 'user-1',
      postId: 'post-1',
      nodeId: 'node-1',
      intensities: { funny: 0.3, insightful: 0.7 },
      totalIntensity: 1.0,
      user: { id: 'user-1', email: 'test@test.com' },
      node: { id: 'node-1', slug: 'test', name: 'Test' },
    });

    const result = await createOrUpdateReaction(mockPrisma, {
      userId: 'user-1',
      postId: 'post-1',
      nodeId: 'node-1',
      intensities: { funny: 0.3, insightful: 0.7 },
    });

    expect(result.id).toBe('existing-reaction');
    expect(mockPrisma.vibeReaction.update).toHaveBeenCalled();
    expect(mockPrisma.vibeReaction.create).not.toHaveBeenCalled();
  });

  it('should throw when neither postId nor commentId is provided', async () => {
    await expect(
      createOrUpdateReaction(mockPrisma, {
        userId: 'user-1',
        nodeId: 'node-1',
        intensities: { funny: 0.5 },
      })
    ).rejects.toThrow('Must provide either postId or commentId, not both');
  });

  it('should throw when both postId and commentId are provided', async () => {
    // WHY: A reaction targets either a post OR a comment, never both.
    await expect(
      createOrUpdateReaction(mockPrisma, {
        userId: 'user-1',
        postId: 'post-1',
        commentId: 'comment-1',
        nodeId: 'node-1',
        intensities: { funny: 0.5 },
      })
    ).rejects.toThrow('Must provide either postId or commentId, not both');
  });

  it('should throw for invalid intensities', async () => {
    await expect(
      createOrUpdateReaction(mockPrisma, {
        userId: 'user-1',
        postId: 'post-1',
        nodeId: 'node-1',
        intensities: { funny: 2.0 }, // > 1.0 is invalid
      })
    ).rejects.toThrow('Invalid intensities');
  });
});

// =========================================================================
// getReactionsForContent
// =========================================================================
describe('getReactionsForContent', () => {
  it('should return reactions and aggregated data for a post', async () => {
    mockPrisma.vibeReaction.findMany.mockResolvedValue([
      {
        id: 'r1',
        intensities: { funny: 0.8, insightful: 0.2 },
        user: { id: 'u1', email: 'u1@test.com' },
        node: { id: 'n1', slug: 'test', name: 'Test' },
      },
      {
        id: 'r2',
        intensities: { funny: 0.3 },
        user: { id: 'u2', email: 'u2@test.com' },
        node: { id: 'n1', slug: 'test', name: 'Test' },
      },
    ]);
    mockPrisma.vibeVector.findMany.mockResolvedValue([
      { slug: 'funny', name: 'Funny', emoji: null },
      { slug: 'insightful', name: 'Insightful', emoji: null },
    ]);

    const result = await getReactionsForContent(mockPrisma, 'post-1');

    expect(result.reactions).toHaveLength(2);
    expect(result.aggregated).toBeInstanceOf(Array);

    // Check aggregation
    const funnyAgg = result.aggregated.find((a) => a.slug === 'funny');
    expect(funnyAgg).toBeDefined();
    expect(funnyAgg!.totalIntensity).toBeCloseTo(1.1, 5); // 0.8 + 0.3
    expect(funnyAgg!.reactionCount).toBe(2);
  });

  it('should throw when neither postId nor commentId is provided', async () => {
    await expect(getReactionsForContent(mockPrisma)).rejects.toThrow(
      'Must provide either postId or commentId, not both'
    );
  });

  it('should throw when both postId and commentId are provided', async () => {
    await expect(
      getReactionsForContent(mockPrisma, 'post-1', 'comment-1')
    ).rejects.toThrow('Must provide either postId or commentId, not both');
  });

  it('should handle empty reactions list', async () => {
    mockPrisma.vibeReaction.findMany.mockResolvedValue([]);
    mockPrisma.vibeVector.findMany.mockResolvedValue([]);

    const result = await getReactionsForContent(mockPrisma, 'empty-post');

    expect(result.reactions).toHaveLength(0);
    expect(result.aggregated).toHaveLength(0);
  });
});

// =========================================================================
// deleteReaction
// =========================================================================
describe('deleteReaction', () => {
  it('should delete an existing reaction', async () => {
    mockPrisma.vibeReaction.findFirst.mockResolvedValue({
      id: 'reaction-to-delete',
      userId: 'user-1',
      postId: 'post-1',
    });
    mockPrisma.vibeReaction.delete.mockResolvedValue({ id: 'reaction-to-delete' });

    const result = await deleteReaction(mockPrisma, 'user-1', 'post-1');
    expect(result.message).toBe('Reaction deleted');
    expect(mockPrisma.vibeReaction.delete).toHaveBeenCalledWith({
      where: { id: 'reaction-to-delete' },
    });
  });

  it('should throw "Reaction not found" when no reaction exists', async () => {
    mockPrisma.vibeReaction.findFirst.mockResolvedValue(null);

    await expect(deleteReaction(mockPrisma, 'user-1', 'post-1')).rejects.toThrow(
      'Reaction not found'
    );
  });

  it('should throw when neither postId nor commentId is provided', async () => {
    await expect(deleteReaction(mockPrisma, 'user-1')).rejects.toThrow(
      'Must provide either postId or commentId, not both'
    );
  });

  it('should filter by nodeId when provided', async () => {
    mockPrisma.vibeReaction.findFirst.mockResolvedValue({
      id: 'node-reaction',
      userId: 'user-1',
      postId: 'post-1',
      nodeId: 'specific-node',
    });
    mockPrisma.vibeReaction.delete.mockResolvedValue({ id: 'node-reaction' });

    await deleteReaction(mockPrisma, 'user-1', 'post-1', undefined, 'specific-node');

    expect(mockPrisma.vibeReaction.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: 'user-1',
        postId: 'post-1',
        nodeId: 'specific-node',
      }),
    });
  });
});

// =========================================================================
// getAllVibeVectors
// =========================================================================
describe('getAllVibeVectors', () => {
  it('should return enabled vectors ordered by display order', async () => {
    const vectors = [
      { id: 'v1', slug: 'funny', name: 'Funny', order: 1, enabled: true },
      { id: 'v2', slug: 'insightful', name: 'Insightful', order: 2, enabled: true },
    ];
    mockPrisma.vibeVector.findMany.mockResolvedValue(vectors);

    const result = await getAllVibeVectors(mockPrisma);

    expect(result).toHaveLength(2);
    expect(mockPrisma.vibeVector.findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      orderBy: { order: 'asc' },
    });
  });
});
