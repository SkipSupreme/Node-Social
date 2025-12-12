
export const COLORS = {
    node: {
        bg: '#0a0b0d',      // Deeper, richer black
        bgAlt: '#0f1115',   // Slightly lighter for layering
        panel: '#141519',   // Card background
        panelHover: '#1a1b21',
        border: '#23252b',
        borderLight: '#2e3138',
        accent: '#6366f1',  // Indigo
        accentGlow: 'rgba(99, 102, 241, 0.4)',
        text: '#f1f5f9',    // Brighter white
        textSecondary: '#cbd5e1',
        muted: '#64748b',
        mutedLight: '#94a3b8'
    },
    vibe: {
        insightful: '#3b82f6',
        funny: '#eab308',
        cursed: '#a855f7',
        novel: '#10b981',
    },
    // Semantic colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#0ea5e9',
};

// Typography scale - using custom fonts
export const TYPOGRAPHY = {
    fonts: {
        display: 'BricolageGrotesque_700Bold',
        displayMedium: 'BricolageGrotesque_500Medium',
        displayLight: 'BricolageGrotesque_400Regular',
        body: 'DMSans_400Regular',
        bodyMedium: 'DMSans_500Medium',
        bodySemibold: 'DMSans_600SemiBold',
        bodyBold: 'DMSans_700Bold',
        // Fallbacks for when fonts aren't loaded
        system: 'System',
    },
    sizes: {
        // Display sizes
        hero: 48,
        h1: 32,
        h2: 24,
        h3: 20,
        h4: 18,
        // Body sizes
        body: 15,
        small: 13,
        xs: 11,
        // Stats
        statLarge: 36,
        statMedium: 28,
    },
    lineHeights: {
        tight: 1.1,
        normal: 1.4,
        relaxed: 1.6,
    },
    letterSpacing: {
        tight: -0.5,
        normal: 0,
        wide: 0.5,
        wider: 1,
        caps: 1.5,
    }
};

// Spacing scale
export const SPACING = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
};

// Border radius scale
export const RADIUS = {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    xxl: 28,
    full: 9999,
};

// Shadows with era-aware glow
export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    glow: (color: string) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    }),
};

// Era system with enhanced visual properties
export const ERAS: Record<string, {
    bg: string,
    border: string,
    text: string,
    gradient: string[],
    glow: string,
}> = {
    // Account age based eras (auto-calculated)
    'Newborn Era': {
        bg: 'rgba(236, 72, 153, 0.1)',
        border: 'rgba(236, 72, 153, 0.3)',
        text: '#f472b6',
        gradient: ['#ec4899', '#f472b6', '#fda4af'],
        glow: 'rgba(236, 72, 153, 0.4)',
    },
    'Explorer Era': {
        bg: 'rgba(6, 182, 212, 0.1)',
        border: 'rgba(6, 182, 212, 0.3)',
        text: '#22d3ee',
        gradient: ['#06b6d4', '#22d3ee', '#67e8f9'],
        glow: 'rgba(6, 182, 212, 0.4)',
    },
    'Settler Era': {
        bg: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 0.3)',
        text: '#60a5fa',
        gradient: ['#3b82f6', '#60a5fa', '#93c5fd'],
        glow: 'rgba(59, 130, 246, 0.4)',
    },
    'Citizen Era': {
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.3)',
        text: '#34d399',
        gradient: ['#10b981', '#34d399', '#6ee7b7'],
        glow: 'rgba(16, 185, 129, 0.4)',
    },
    'Veteran Era': {
        bg: 'rgba(168, 85, 247, 0.1)',
        border: 'rgba(168, 85, 247, 0.3)',
        text: '#c084fc',
        gradient: ['#a855f7', '#c084fc', '#d8b4fe'],
        glow: 'rgba(168, 85, 247, 0.4)',
    },
    'Elder Era': {
        bg: 'rgba(234, 179, 8, 0.1)',
        border: 'rgba(234, 179, 8, 0.3)',
        text: '#facc15',
        gradient: ['#eab308', '#facc15', '#fde047'],
        glow: 'rgba(234, 179, 8, 0.4)',
    },
    'Legend Era': {
        bg: 'rgba(251, 191, 36, 0.15)',
        border: 'rgba(251, 191, 36, 0.4)',
        text: '#fbbf24',
        gradient: ['#f59e0b', '#fbbf24', '#fcd34d'],
        glow: 'rgba(251, 191, 36, 0.5)',
    },
    // Custom eras (user selectable)
    'Villain Era': {
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.3)',
        text: '#f87171',
        gradient: ['#dc2626', '#ef4444', '#f87171'],
        glow: 'rgba(239, 68, 68, 0.4)',
    },
    'Builder Era': {
        bg: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 0.3)',
        text: '#60a5fa',
        gradient: ['#2563eb', '#3b82f6', '#60a5fa'],
        glow: 'rgba(59, 130, 246, 0.4)',
    },
    'Lurker Era': {
        bg: 'rgba(100, 116, 139, 0.1)',
        border: 'rgba(100, 116, 139, 0.3)',
        text: '#94a3b8',
        gradient: ['#475569', '#64748b', '#94a3b8'],
        glow: 'rgba(100, 116, 139, 0.3)',
    },
    'Teacher Era': {
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.3)',
        text: '#34d399',
        gradient: ['#059669', '#10b981', '#34d399'],
        glow: 'rgba(16, 185, 129, 0.4)',
    },
    'Healing Era': {
        bg: 'rgba(6, 182, 212, 0.1)',
        border: 'rgba(6, 182, 212, 0.3)',
        text: '#22d3ee',
        gradient: ['#0891b2', '#06b6d4', '#22d3ee'],
        glow: 'rgba(6, 182, 212, 0.4)',
    },
    'Main Character Era': {
        bg: 'rgba(234, 179, 8, 0.15)',
        border: 'rgba(234, 179, 8, 0.4)',
        text: '#facc15',
        gradient: ['#ca8a04', '#eab308', '#facc15'],
        glow: 'rgba(234, 179, 8, 0.5)',
    },
    'Flop Era': {
        bg: 'rgba(249, 115, 22, 0.1)',
        border: 'rgba(249, 115, 22, 0.3)',
        text: '#fb923c',
        gradient: ['#ea580c', '#f97316', '#fb923c'],
        glow: 'rgba(249, 115, 22, 0.4)',
    },
    'Touch Grass Era': {
        bg: 'rgba(34, 197, 94, 0.1)',
        border: 'rgba(34, 197, 94, 0.3)',
        text: '#4ade80',
        gradient: ['#16a34a', '#22c55e', '#4ade80'],
        glow: 'rgba(34, 197, 94, 0.4)',
    },
    'Monk Mode': {
        bg: 'rgba(120, 113, 108, 0.1)',
        border: 'rgba(120, 113, 108, 0.3)',
        text: '#a8a29e',
        gradient: ['#57534e', '#78716c', '#a8a29e'],
        glow: 'rgba(120, 113, 108, 0.3)',
    },
    'Goblin Mode': {
        bg: 'rgba(132, 204, 22, 0.15)',
        border: 'rgba(132, 204, 22, 0.3)',
        text: '#a3e635',
        gradient: ['#65a30d', '#84cc16', '#a3e635'],
        glow: 'rgba(132, 204, 22, 0.4)',
    },
    'Grindset Era': {
        bg: 'rgba(217, 70, 239, 0.1)',
        border: 'rgba(217, 70, 239, 0.3)',
        text: '#e879f9',
        gradient: ['#c026d3', '#d946ef', '#e879f9'],
        glow: 'rgba(217, 70, 239, 0.4)',
    },
    'Default': {
        bg: 'rgba(99, 102, 241, 0.1)',
        border: 'rgba(99, 102, 241, 0.3)',
        text: '#818cf8',
        gradient: ['#4f46e5', '#6366f1', '#818cf8'],
        glow: 'rgba(99, 102, 241, 0.4)',
    }
};

export const SCOPE_COLORS = [
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#10b981'  // Green
];

// Responsive breakpoints - account for sidebars (left ~240px, right ~320px)
// Desktop layout only kicks in when there's enough room WITH sidebars open
export const BREAKPOINTS = {
    mobile: 0,
    tablet: 768,
    desktop: 1280, // Increased from 1024 to account for sidebars
    wide: 1536,    // Increased from 1280 for ultrawide
};

// Sidebar widths for reference
export const SIDEBAR = {
    leftOpen: 240,
    leftCollapsed: 56,
    right: 320,
};

// Animation presets
export const ANIMATIONS = {
    spring: {
        type: 'spring',
        damping: 20,
        stiffness: 300,
    },
    ease: {
        duration: 200,
    },
    slow: {
        duration: 400,
    },
};
