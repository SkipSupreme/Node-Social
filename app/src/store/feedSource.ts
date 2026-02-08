// src/store/feedSource.ts
// Zustand store managing the user's selected feed source with persistence.
import { create } from "zustand";
import { storage } from "../lib/storage";

type FeedSource = "node" | "bluesky" | "mastodon" | "mixed";

interface FeedSourceState {
  feedSource: FeedSource;
  hydrated: boolean;
  setFeedSource: (source: FeedSource) => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "feedSource";

const VALID_SOURCES: FeedSource[] = ["node", "bluesky", "mastodon", "mixed"];

export const useFeedSourceStore = create<FeedSourceState>((set) => ({
  feedSource: "node",
  hydrated: false,

  setFeedSource: (source) => {
    set({ feedSource: source });
    storage.setItem(STORAGE_KEY, source).catch(console.error);
  },

  hydrate: async () => {
    try {
      const saved = await storage.getItem(STORAGE_KEY);
      if (saved && VALID_SOURCES.includes(saved as FeedSource)) {
        set({ feedSource: saved as FeedSource, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));

export type { FeedSource };
