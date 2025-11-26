export const VECTORS = [
    'insightful',
    'joy',
    'fire',
    'support',
    'shock',
    'questionable'
] as const;

export type VibeVectorType = typeof VECTORS[number];

export const VECTOR_COLORS: Record<VibeVectorType, string> = {
    insightful: '#00BFFF',
    joy: '#FFD700',
    fire: '#FF4500',
    support: '#FF69B4',
    shock: '#32CD32',
    questionable: '#9370DB',
};

export const VECTOR_ICONS: Record<VibeVectorType, string> = {
    insightful: '💡',
    joy: '😄',
    fire: '🔥',
    support: '💙',
    shock: '⚡',
    questionable: '🤔',
};

export const VECTOR_LABELS: Record<VibeVectorType, string> = {
    insightful: 'Insightful',
    joy: 'Joy',
    fire: 'Fire',
    support: 'Support',
    shock: 'Shock',
    questionable: 'Questionable',
};
