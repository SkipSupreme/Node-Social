// src/store/theme.ts
// Zustand store managing user themes, node theme overrides, and persistence.
import { create } from "zustand";
import { storage } from "../lib/storage";

// ── Theme token interface ──────────────────────────────────────
export interface ThemeTokens {
  // Core colors
  bg: string;
  bgAlt: string;
  panel: string;
  panelHover: string;
  text: string;
  textSecondary: string;
  muted: string;
  mutedLight: string;
  accent: string;
  accentGlow: string;
  border: string;
  borderLight: string;

  // Surfaces
  inputBg: string;
  headerBg: string;
  sidebarBg: string;

  // Typography
  fontFamily: string;
  fontFamilyMono: string;

  // Effects
  shadow: string;
  radius: number;

  // Profile-specific (MySpace flair)
  profileBg?: string;
  profileBgImage?: string;
  profileAccent?: string;
  postCardBg?: string;
  postCardBorder?: string;
}

// ── Default theme: extracted from COLORS.node ──────────────────
export const DEFAULT_THEME: ThemeTokens = {
  bg: "#0a0b0d",
  bgAlt: "#0f1115",
  panel: "#141519",
  panelHover: "#1a1b21",
  text: "#f1f5f9",
  textSecondary: "#cbd5e1",
  muted: "#64748b",
  mutedLight: "#94a3b8",
  accent: "#6366f1",
  accentGlow: "rgba(99, 102, 241, 0.4)",
  border: "#23252b",
  borderLight: "#2e3138",

  inputBg: "#141519",
  headerBg: "#0a0b0d",
  sidebarBg: "#0f1115",

  fontFamily: "DMSans_400Regular",
  fontFamilyMono: "monospace",

  shadow: "0px 4px 8px rgba(0, 0, 0, 0.2)",
  radius: 10,
};

// ── Store shape ────────────────────────────────────────────────
interface ThemeState {
  /** The user's personal theme (persisted) */
  userTheme: ThemeTokens;
  /** Active node community theme override – merged on top of userTheme */
  nodeThemeOverride: Partial<ThemeTokens> | null;
  /** Computed active theme: nodeOverride merged over userTheme */
  activeTheme: ThemeTokens;
  /** Whether a "try-on" / preview is active (not saved yet) */
  previewTheme: Partial<ThemeTokens> | null;
  /** Whether the store has been hydrated from persistence */
  hydrated: boolean;

  // ── Actions ──────────────────────────────────────────────────
  setUserTheme: (theme: Partial<ThemeTokens>) => void;
  setNodeThemeOverride: (theme: Partial<ThemeTokens> | null) => void;
  clearNodeOverride: () => void;
  setPreviewTheme: (theme: Partial<ThemeTokens> | null) => void;
  clearPreview: () => void;
  resetToDefault: () => void;
  hydrate: () => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────

/** Merge partial tokens over a base, producing a complete ThemeTokens. */
function mergeTheme(
  base: ThemeTokens,
  ...overrides: (Partial<ThemeTokens> | null | undefined)[]
): ThemeTokens {
  const merged = { ...base };
  for (const override of overrides) {
    if (!override) continue;
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined && value !== null) {
        (merged as any)[key] = value;
      }
    }
  }
  return merged;
}

/** Recompute activeTheme from the current pieces. */
function computeActive(state: {
  userTheme: ThemeTokens;
  nodeThemeOverride: Partial<ThemeTokens> | null;
  previewTheme: Partial<ThemeTokens> | null;
}): ThemeTokens {
  return mergeTheme(
    DEFAULT_THEME,
    state.userTheme,
    state.nodeThemeOverride,
    state.previewTheme,
  );
}

const STORAGE_KEY = "node_social_user_theme";

// ── Store creation ─────────────────────────────────────────────
export const useThemeStore = create<ThemeState>((set, get) => ({
  userTheme: { ...DEFAULT_THEME },
  nodeThemeOverride: null,
  activeTheme: { ...DEFAULT_THEME },
  previewTheme: null,
  hydrated: false,

  setUserTheme: (partial) => {
    const userTheme = mergeTheme(get().userTheme, partial);
    const newState = { ...get(), userTheme };
    set({ userTheme, activeTheme: computeActive(newState) });
    // Persist to local storage (fire-and-forget)
    storage
      .setItem(STORAGE_KEY, JSON.stringify(userTheme))
      .catch((e) => console.error("[ThemeStore] persist error:", e));
  },

  setNodeThemeOverride: (theme) => {
    const newState = { ...get(), nodeThemeOverride: theme };
    set({ nodeThemeOverride: theme, activeTheme: computeActive(newState) });
  },

  clearNodeOverride: () => {
    const newState = { ...get(), nodeThemeOverride: null };
    set({ nodeThemeOverride: null, activeTheme: computeActive(newState) });
  },

  setPreviewTheme: (theme) => {
    const newState = { ...get(), previewTheme: theme };
    set({ previewTheme: theme, activeTheme: computeActive(newState) });
  },

  clearPreview: () => {
    const newState = { ...get(), previewTheme: null };
    set({ previewTheme: null, activeTheme: computeActive(newState) });
  },

  resetToDefault: () => {
    set({
      userTheme: { ...DEFAULT_THEME },
      nodeThemeOverride: null,
      previewTheme: null,
      activeTheme: { ...DEFAULT_THEME },
    });
    storage
      .removeItem(STORAGE_KEY)
      .catch((e) => console.error("[ThemeStore] clear error:", e));
  },

  hydrate: async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<ThemeTokens>;
        const userTheme = mergeTheme(DEFAULT_THEME, saved);
        const state = { userTheme, nodeThemeOverride: null, previewTheme: null };
        set({ userTheme, activeTheme: computeActive(state), hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch (e) {
      console.error("[ThemeStore] hydrate error:", e);
      set({ hydrated: true });
    }
  },
}));
