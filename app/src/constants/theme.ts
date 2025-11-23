
export const COLORS = {
    node: {
        bg: '#0f1115',
        panel: '#181a20',
        border: '#2a2d35',
        accent: '#6366f1', // Indigo
        text: '#e2e8f0',
        muted: '#94a3b8'
    },
    vibe: {
        insightful: '#3b82f6',
        funny: '#eab308',
        cursed: '#a855f7',
        novel: '#10b981',
    }
};

export const ERAS: Record<string, { bg: string, border: string, text: string }> = {
    'Villain Era': { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: '#f87171' },
    'Builder Era': { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
    'Lurker Era': { bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.2)', text: '#94a3b8' },
    'Teacher Era': { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
    'Healing Era': { bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.2)', text: '#22d3ee' },
    'Main Character Era': { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.2)', text: '#facc15' },
    'Flop Era': { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.2)', text: '#fb923c' },
    'Touch Grass Era': { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: '#4ade80' },
    'Monk Mode': { bg: 'rgba(120, 113, 108, 0.1)', border: 'rgba(120, 113, 108, 0.2)', text: '#a8a29e' },
    'Goblin Mode': { bg: 'rgba(132, 204, 22, 0.1)', border: 'rgba(132, 204, 22, 0.2)', text: '#a3e635' },
    'Grindset Era': { bg: 'rgba(217, 70, 239, 0.1)', border: 'rgba(217, 70, 239, 0.2)', text: '#e879f9' },
    'Default': { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.2)', text: '#c084fc' }
};

export const SCOPE_COLORS = [
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#10b981'  // Green
];
