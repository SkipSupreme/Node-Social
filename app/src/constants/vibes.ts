export const VECTORS = [
    'insightful',
    'joy',
    'fire',
    'support',
    'shock',
    'questionable'
] as const;

export type VibeVectorType = typeof VECTORS[number];

