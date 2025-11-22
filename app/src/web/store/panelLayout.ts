// Phase 1.2 - Panel Layout State Management
// Zustand store for managing draggable/resizable panel layouts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelType =
  | 'left-sidebar'
  | 'feed-column'
  | 'right-sidebar-top'
  | 'right-sidebar-bottom'
  | 'comment-thread'
  | 'detached-feed';

export interface Panel {
  id: string;
  type: PanelType;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  order: number;
  zIndex: number;
}

export interface FeedConfig {
  id: string;
  nodeId?: string;
  postTypeFilter?: string[];
  sortBy?: 'new' | 'hot' | 'top' | 'cred' | 'algorithmic';
  vibeValidatorSettings?: {
    qualityWeight: number;
    recencyWeight: number;
    engagementWeight: number;
    personalizationWeight: number;
  };
}

export interface Column {
  id: string;
  width: number;
  feeds: FeedConfig[];
}

export interface PanelLayout {
  panels: Record<string, Panel>;
  columns: Record<string, Column>;
  lastSaved: string;
  version: string;
}

const DEFAULT_LAYOUT: PanelLayout = {
  panels: {
    'left-sidebar': {
      id: 'left-sidebar',
      type: 'left-sidebar',
      x: 0,
      y: 0,
      width: 240,
      height: 800,
      minimized: false,
      order: 0,
      zIndex: 10,
    },
    'right-sidebar-top': {
      id: 'right-sidebar-top',
      type: 'right-sidebar-top',
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      minimized: false,
      order: 1,
      zIndex: 10,
    },
    'right-sidebar-bottom': {
      id: 'right-sidebar-bottom',
      type: 'right-sidebar-bottom',
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      minimized: false,
      order: 2,
      zIndex: 10,
    },
  },
  columns: {
    'feed-column-1': {
      id: 'feed-column-1',
      width: 600,
      feeds: [
        {
          id: 'feed-1',
          sortBy: 'algorithmic',
        },
      ],
    },
  },
  lastSaved: new Date().toISOString(),
  version: '1.0.0',
};

interface PanelLayoutState extends PanelLayout {
  updatePanel: (id: string, updates: Partial<Panel>) => void;
  addPanel: (panel: Panel) => void;
  removePanel: (id: string) => void;
  updateColumn: (id: string, updates: Partial<Column>) => void;
  addColumn: (column: Column) => void;
  removeColumn: (id: string) => void;
  resetLayout: () => void;
}

export const usePanelLayout = create<PanelLayoutState>()(
  persist(
    (set) => ({
      ...DEFAULT_LAYOUT,
      updatePanel: (id, updates) =>
        set((state) => ({
          panels: {
            ...state.panels,
            [id]: {
              ...state.panels[id],
              ...updates,
            },
          },
          lastSaved: new Date().toISOString(),
        })),
      addPanel: (panel) =>
        set((state) => ({
          panels: {
            ...state.panels,
            [panel.id]: panel,
          },
          lastSaved: new Date().toISOString(),
        })),
      removePanel: (id) =>
        set((state) => {
          const { [id]: removed, ...rest } = state.panels;
          return {
            panels: rest,
            lastSaved: new Date().toISOString(),
          };
        }),
      updateColumn: (id, updates) =>
        set((state) => ({
          columns: {
            ...state.columns,
            [id]: {
              ...state.columns[id],
              ...updates,
            },
          },
          lastSaved: new Date().toISOString(),
        })),
      addColumn: (column) =>
        set((state) => ({
          columns: {
            ...state.columns,
            [column.id]: column,
          },
          lastSaved: new Date().toISOString(),
        })),
      removeColumn: (id) =>
        set((state) => {
          const { [id]: removed, ...rest } = state.columns;
          return {
            columns: rest,
            lastSaved: new Date().toISOString(),
          };
        }),
      resetLayout: () =>
        set({
          ...DEFAULT_LAYOUT,
          lastSaved: new Date().toISOString(),
        }),
    }),
    {
      name: 'node-social-panel-layout', // localStorage key
      version: 1,
    }
  )
);

