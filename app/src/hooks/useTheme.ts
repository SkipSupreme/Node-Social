import { useThemeStore, type ThemeTokens } from '../store/theme';
import { COLORS } from '../constants/theme';

/**
 * Returns the currently-active theme tokens.
 *
 * Priority chain: previewTheme > nodeThemeOverride > userTheme > DEFAULT_THEME
 * All resolved inside the Zustand store; this hook is just a selector.
 */
export const useAppTheme = (): ThemeTokens => {
    return useThemeStore((s) => s.activeTheme);
};

/**
 * Legacy hook — wraps tokens in a `{ theme: { colors } }` shape
 * so existing consumers don't break during migration.
 */
export const useTheme = () => {
    const tokens = useAppTheme();
    const theme = {
        colors: {
            background: tokens.bg,
            card: tokens.panel,
            text: tokens.text,
            textSecondary: tokens.muted,
            primary: tokens.accent,
            border: tokens.border,
            success: COLORS.vibe.novel,
            error: '#ef4444',
            warning: COLORS.vibe.funny,
            info: COLORS.vibe.insightful,
        },
    };
    return { theme };
};
