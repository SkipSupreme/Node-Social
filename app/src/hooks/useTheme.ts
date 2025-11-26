import { COLORS } from '../constants/theme';

export const useTheme = () => {
    const theme = {
        colors: {
            background: COLORS.node.bg,
            card: COLORS.node.panel,
            text: COLORS.node.text,
            textSecondary: COLORS.node.muted,
            primary: COLORS.node.accent,
            border: COLORS.node.border,
            success: COLORS.vibe.novel, // Using novel green for success
            error: '#ef4444', // Red
            warning: COLORS.vibe.funny, // Yellow
            info: COLORS.vibe.insightful, // Blue
        }
    };

    return { theme };
};
