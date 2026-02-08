// app/src/store/modal.ts
import { create } from 'zustand';
import type { ExternalPost } from '../lib/api';

// UIPost type matches the mapped post shape from App.tsx mapPost()
interface UIPost {
  id: string;
  title?: string | null;
  content: string | null;
  contentJson?: any;
  [key: string]: unknown;
}

interface ModalState {
  // Create post
  isCreatePostOpen: boolean;
  quotedExternalPost: ExternalPost | null;
  createPostInitialNodeId: string | null;
  openCreatePost: (opts?: { quotedExternalPost?: ExternalPost; nodeId?: string | null }) => void;
  closeCreatePost: () => void;

  // Edit post
  isEditPostOpen: boolean;
  editingPost: UIPost | null;
  openEditPost: (post: UIPost) => void;
  closeEditPost: () => void;

  // Vibe validator (mobile)
  isVibeValidatorOpen: boolean;
  openVibeValidator: () => void;
  closeVibeValidator: () => void;

  // Node info sheet
  nodeInfoNodeId: string | null;
  openNodeInfo: (nodeId: string) => void;
  closeNodeInfo: () => void;

  // Add column modal
  isAddColumnOpen: boolean;
  openAddColumn: () => void;
  closeAddColumn: () => void;

  // Mobile sidebar
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isCreatePostOpen: false,
  quotedExternalPost: null,
  createPostInitialNodeId: null,
  openCreatePost: (opts) => set({
    isCreatePostOpen: true,
    quotedExternalPost: opts?.quotedExternalPost ?? null,
    createPostInitialNodeId: opts?.nodeId ?? null,
  }),
  closeCreatePost: () => set({
    isCreatePostOpen: false,
    quotedExternalPost: null,
    createPostInitialNodeId: null,
  }),

  isEditPostOpen: false,
  editingPost: null,
  openEditPost: (post) => set({ isEditPostOpen: true, editingPost: post }),
  closeEditPost: () => set({ isEditPostOpen: false, editingPost: null }),

  isVibeValidatorOpen: false,
  openVibeValidator: () => set({ isVibeValidatorOpen: true }),
  closeVibeValidator: () => set({ isVibeValidatorOpen: false }),

  nodeInfoNodeId: null,
  openNodeInfo: (nodeId) => set({ nodeInfoNodeId: nodeId }),
  closeNodeInfo: () => set({ nodeInfoNodeId: null }),

  isAddColumnOpen: false,
  openAddColumn: () => set({ isAddColumnOpen: true }),
  closeAddColumn: () => set({ isAddColumnOpen: false }),

  isSidebarOpen: false,
  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
}));
