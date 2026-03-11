// src/store/columns.ts
import { create } from "zustand";
import { storage } from "../lib/storage";

// Column type definitions
export type ColumnType =
  | 'global'
  | 'node'
  | 'node-info'
  | 'discovery'
  | 'following'
  | 'profile'
  | 'notifications'
  | 'search'
  | 'trending'
  | 'bluesky'
  | 'mastodon'
  | 'external-combined';

// Vibe settings for feed algorithm (matches VibeValidator)
export interface ColumnVibeSettings {
  preset?: string;
  weights: {
    quality: number;
    recency: number;
    engagement: number;
    personalization: number;
  };
  mode?: 'simple' | 'intermediate' | 'advanced' | 'expert';
  intermediate?: {
    timeRange: '1h' | '6h' | '24h' | '7d' | 'all';
    discoveryRate: number;
    hideMutedWords: boolean;
    showSeenPosts: boolean;
    textOnly: boolean;
    mediaOnly: boolean;
    linksOnly: boolean;
    hasDiscussion: boolean;
    // Content Intelligence (Tier 2)
    textDensity: 'any' | 'micro' | 'short' | 'medium' | 'long';
    mediaType: 'any' | 'photo' | 'video' | 'gif';
  };
  // Advanced and expert settings are optional and stored as-is
  advanced?: Record<string, unknown>;
  expert?: Record<string, unknown>;
}

// External platform configuration
export interface ExternalFeedConfig {
  platform: 'bluesky' | 'mastodon';
  // Bluesky options
  blueskyFeed?: 'discover' | 'feed' | 'user';
  blueskyHandle?: string;  // For user feed
  blueskyFeedUri?: string; // For custom feed
  // Mastodon options
  mastodonInstance?: string;
  mastodonTimeline?: 'public' | 'local' | 'trending';
}

export interface FeedColumn {
  id: string;
  type: ColumnType;
  title: string;
  nodeId?: string;        // For node-type columns
  searchQuery?: string;   // For search-type columns
  userId?: string;        // For profile-type columns
  vibeSettings?: ColumnVibeSettings; // Per-column feed algorithm settings
  externalConfig?: ExternalFeedConfig; // For external platform columns (Tier 5)
}

// Generate unique ID for columns
const generateId = (): string => {
  return `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Default columns for new users - 4 columns to fill typical desktop
const getDefaultColumns = (): FeedColumn[] => [
  { id: generateId(), type: 'global', title: 'Global' },
  { id: generateId(), type: 'bluesky', title: 'Bluesky', externalConfig: { platform: 'bluesky', blueskyFeed: 'discover' } },
  { id: generateId(), type: 'mastodon', title: 'Mastodon', externalConfig: { platform: 'mastodon', mastodonTimeline: 'trending' } },
  { id: generateId(), type: 'trending', title: "What's Vibing" },
];

// Max columns based on screen width
export const getMaxColumns = (width: number): number => {
  if (width >= 1920) return 5;
  if (width >= 1440) return 4;
  if (width >= 1280) return 3;
  if (width >= 1024) return 2;
  return 1; // Mobile fallback
};

// Column width constants
export const COLUMN_MIN_WIDTH = 300;
export const COLUMN_GAP = 12;

type ColumnsState = {
  columns: FeedColumn[];
  isMultiColumnEnabled: boolean;
  isLoading: boolean;

  // Actions
  loadFromStorage: () => Promise<void>;
  addColumn: (column: Omit<FeedColumn, 'id'>) => Promise<void>;
  removeColumn: (id: string) => Promise<void>;
  updateColumn: (id: string, updates: Partial<Omit<FeedColumn, 'id'>>) => Promise<void>;
  reorderColumns: (fromIndex: number, toIndex: number) => Promise<void>;
  setMultiColumnEnabled: (enabled: boolean) => Promise<void>;
  resetToDefaults: () => Promise<void>;
};

const STORAGE_KEY = 'columnConfig';

export const useColumnsStore = create<ColumnsState>((set, get) => ({
  columns: [],
  isMultiColumnEnabled: true, // Default ON for desktop
  isLoading: true,

  loadFromStorage: async () => {
    try {
      const saved = await storage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        set({
          columns: parsed.columns || getDefaultColumns(),
          isMultiColumnEnabled: parsed.isMultiColumnEnabled ?? true,
          isLoading: false,
        });
      } else {
        // First time - use defaults
        const defaults = getDefaultColumns();
        set({
          columns: defaults,
          isMultiColumnEnabled: true,
          isLoading: false,
        });
        // Persist defaults
        await storage.setItem(STORAGE_KEY, JSON.stringify({
          columns: defaults,
          isMultiColumnEnabled: true,
        }));
      }
    } catch (error) {
      console.error('Error loading column config:', error);
      set({
        columns: getDefaultColumns(),
        isMultiColumnEnabled: true,
        isLoading: false,
      });
    }
  },

  addColumn: async (column) => {
    const newColumn: FeedColumn = {
      ...column,
      id: generateId(),
    };

    const newColumns = [...get().columns, newColumn];
    set({ columns: newColumns });

    await storage.setItem(STORAGE_KEY, JSON.stringify({
      columns: newColumns,
      isMultiColumnEnabled: get().isMultiColumnEnabled,
    }));
  },

  removeColumn: async (id) => {
    const state = get();
    // Don't allow removing the last column
    if (state.columns.length <= 1) return;

    const newColumns = state.columns.filter(col => col.id !== id);
    set({ columns: newColumns });

    await storage.setItem(STORAGE_KEY, JSON.stringify({
      columns: newColumns,
      isMultiColumnEnabled: state.isMultiColumnEnabled,
    }));
  },

  updateColumn: async (id, updates) => {
    const state = get();
    const newColumns = state.columns.map(col =>
      col.id === id ? { ...col, ...updates } : col
    );
    set({ columns: newColumns });

    await storage.setItem(STORAGE_KEY, JSON.stringify({
      columns: newColumns,
      isMultiColumnEnabled: state.isMultiColumnEnabled,
    }));
  },

  reorderColumns: async (fromIndex, toIndex) => {
    const state = get();
    const newColumns = [...state.columns];
    const [removed] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, removed);
    set({ columns: newColumns });

    await storage.setItem(STORAGE_KEY, JSON.stringify({
      columns: newColumns,
      isMultiColumnEnabled: state.isMultiColumnEnabled,
    }));
  },

  setMultiColumnEnabled: async (enabled) => {
    set({ isMultiColumnEnabled: enabled });

    await storage.setItem(STORAGE_KEY, JSON.stringify({
      columns: get().columns,
      isMultiColumnEnabled: enabled,
    }));
  },

  resetToDefaults: async () => {
    const defaults = getDefaultColumns();
    set({
      columns: defaults,
      isMultiColumnEnabled: true,
    });

    await storage.setItem(STORAGE_KEY, JSON.stringify({
      columns: defaults,
      isMultiColumnEnabled: true,
    }));
  },
}));
