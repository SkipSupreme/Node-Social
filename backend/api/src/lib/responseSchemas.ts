/**
 * Shared JSON Schema fragments for Fastify response serialization.
 *
 * When a route defines `schema.response`, Fastify activates fast-json-stringify
 * which compiles a type-specific serializer at startup — roughly 2× faster than
 * generic JSON.stringify for the shapes we return.
 *
 * Using `additionalProperties: true` on first pass so unknown fields pass through
 * rather than being silently dropped. Can tighten to `false` once we've verified
 * every client-consumed field is enumerated.
 */

// ──────────────────────────── Error response (shared by all routes) ─────────

const errorResponse = {
  type: 'object' as const,
  properties: {
    error: { type: 'string' as const },
    message: { type: 'string' as const },
    statusCode: { type: 'integer' as const },
  },
  additionalProperties: true,
};

/** Merge into any response schema to allow error status codes through fast-json-stringify */
const errorStatuses = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  429: errorResponse,
  500: errorResponse,
};

// ──────────────────────────── Reusable fragments ────────────────────────────

const nullable = (schema: Record<string, unknown>) => ({
  oneOf: [schema, { type: 'null' as const }],
});

export const authorSummarySchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    id: { type: 'string' as const },
    username: { type: 'string' as const },
    firstName: nullable({ type: 'string' as const }),
    lastName: nullable({ type: 'string' as const }),
    avatar: nullable({ type: 'string' as const }),
    era: nullable({ type: 'string' as const }),
    cred: { type: 'number' as const },
  },
};

export const nodeSummarySchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    id: { type: 'string' as const },
    slug: { type: 'string' as const },
    name: { type: 'string' as const },
    description: nullable({ type: 'string' as const }),
  },
};

export const vibeAggregateSchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    postId: { type: 'string' as const },
    insightfulSum: { type: 'number' as const },
    joySum: { type: 'number' as const },
    fireSum: { type: 'number' as const },
    supportSum: { type: 'number' as const },
    shockSum: { type: 'number' as const },
    questionableSum: { type: 'number' as const },
    insightfulCount: { type: 'integer' as const },
    joyCount: { type: 'integer' as const },
    fireCount: { type: 'integer' as const },
    supportCount: { type: 'integer' as const },
    shockCount: { type: 'integer' as const },
    questionableCount: { type: 'integer' as const },
    totalReactors: { type: 'integer' as const },
    totalIntensity: { type: 'number' as const },
    qualityScore: { type: 'number' as const },
    engagementScore: { type: 'number' as const },
    flagScore: { type: 'number' as const },
    updatedAt: { type: 'string' as const },
  },
};

export const linkMetaSchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    id: { type: 'string' as const },
    url: { type: 'string' as const },
    title: nullable({ type: 'string' as const }),
    description: nullable({ type: 'string' as const }),
    image: nullable({ type: 'string' as const }),
    domain: nullable({ type: 'string' as const }),
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const },
  },
};

// ──────────────────────────── Feed / Post schemas ────────────────────────────

export const postItemSchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    id: { type: 'string' as const },
    content: nullable({ type: 'string' as const }),
    contentJson: {},  // complex JSON — pass through
    contentFormat: { type: 'string' as const },
    title: nullable({ type: 'string' as const }),
    postType: { type: 'string' as const },
    visibility: { type: 'string' as const },
    mediaUrl: nullable({ type: 'string' as const }),
    mediaType: nullable({ type: 'string' as const }),
    galleryUrls: { type: 'array' as const, items: { type: 'string' as const } },
    linkUrl: nullable({ type: 'string' as const }),
    textLength: nullable({ type: 'integer' as const }),
    textDensity: nullable({ type: 'string' as const }),
    expertGateCred: nullable({ type: 'number' as const }),
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const },
    editedAt: nullable({ type: 'string' as const }),
    authorId: { type: 'string' as const },
    nodeId: nullable({ type: 'string' as const }),
    author: authorSummarySchema,
    node: nullable(nodeSummarySchema),
    linkMeta: nullable(linkMetaSchema),
    vibeAggregate: nullable(vibeAggregateSchema),
    commentCount: { type: 'integer' as const },
    isSaved: { type: 'boolean' as const },
    myReaction: {},  // JSON intensities object or null — pass through
    comments: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        additionalProperties: true,
        properties: {
          id: { type: 'string' as const },
          content: { type: 'string' as const },
          createdAt: { type: 'string' as const },
          authorId: { type: 'string' as const },
          author: authorSummarySchema,
        },
      },
    },
    poll: {},  // complex nested object — pass through for now
  },
};

export const feedResponseSchema = {
  ...errorStatuses,
  200: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      posts: { type: 'array' as const, items: postItemSchema },
      nextCursor: { type: 'string' as const },
      hasMore: { type: 'boolean' as const },
    },
  },
};

// ──────────────────────────── Comments ────────────────────────────

export const commentItemSchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    id: { type: 'string' as const },
    content: { type: 'string' as const },
    createdAt: { type: 'string' as const },
    updatedAt: { type: 'string' as const },
    authorId: { type: 'string' as const },
    postId: { type: 'string' as const },
    parentId: nullable({ type: 'string' as const }),
    author: authorSummarySchema,
    replyCount: { type: 'integer' as const },
    myReaction: {},  // JSON intensities or null
  },
};

export const commentsResponseSchema = {
  ...errorStatuses,
  200: {
    type: 'array' as const,
    items: commentItemSchema,
  },
};

// ──────────────────────────── Reactions ────────────────────────────

export const vectorsResponseSchema = {
  ...errorStatuses,
  200: {
    type: 'object' as const,
    properties: {
      vectors: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          additionalProperties: true,
          properties: {
            id: { type: 'string' as const },
            slug: { type: 'string' as const },
            name: { type: 'string' as const },
            emoji: { type: 'string' as const },
            description: nullable({ type: 'string' as const }),
            order: { type: 'integer' as const },
            enabled: { type: 'boolean' as const },
          },
        },
      },
    },
  },
};

export const postReactionsResponseSchema = {
  ...errorStatuses,
  200: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      reactions: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
      aggregated: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
    },
  },
};

// ──────────────────────────── Trending ────────────────────────────

export const trendingVibesResponseSchema = {
  ...errorStatuses,
  200: {
    type: 'object' as const,
    properties: {
      spikes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          additionalProperties: true,
          properties: {
            vibe: { type: 'string' as const },
            vibeEmoji: { type: 'string' as const },
            percentageChange: { type: 'number' as const },
            nodeId: { type: 'string' as const },
            nodeSlug: { type: 'string' as const },
            nodeName: { type: 'string' as const },
            nodeColor: nullable({ type: 'string' as const }),
            hashtags: { type: 'array' as const, items: { type: 'string' as const } },
          },
        },
      },
      calculatedAt: { type: 'string' as const },
    },
  },
};

export const trendingNodesResponseSchema = {
  ...errorStatuses,
  200: {
    type: 'object' as const,
    properties: {
      nodes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          additionalProperties: true,
          properties: {
            id: { type: 'string' as const },
            slug: { type: 'string' as const },
            name: { type: 'string' as const },
            avatar: nullable({ type: 'string' as const }),
            color: nullable({ type: 'string' as const }),
            memberCount: { type: 'integer' as const },
            growthToday: { type: 'integer' as const },
          },
        },
      },
      calculatedAt: { type: 'string' as const },
    },
  },
};

export const discoverNodesResponseSchema = {
  ...errorStatuses,
  200: {
    type: 'object' as const,
    properties: {
      recommendations: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          additionalProperties: true,
          properties: {
            id: { type: 'string' as const },
            slug: { type: 'string' as const },
            name: { type: 'string' as const },
            description: nullable({ type: 'string' as const }),
            avatar: nullable({ type: 'string' as const }),
            color: nullable({ type: 'string' as const }),
            memberCount: { type: 'integer' as const },
            matchReason: { type: 'string' as const },
          },
        },
      },
      calculatedAt: { type: 'string' as const },
    },
  },
};

// ──────────────────────────── Search ────────────────────────────

export const searchPostsResponseSchema = {
  ...errorStatuses,
  200: {
    type: 'object' as const,
    additionalProperties: true,
    properties: {
      posts: { type: 'array' as const, items: postItemSchema },
      total: { type: 'integer' as const },
      hasMore: { type: 'boolean' as const },
    },
  },
};
