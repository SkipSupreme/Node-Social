import { create } from 'zustand';
import { getLinkedAccounts, type LinkedAccountInfo } from '../lib/api';

type LinkedAccountsState = {
  accounts: LinkedAccountInfo[];
  loading: boolean;
  fetchAccounts: () => Promise<void>;
  hasLinkedAccount: (platform: 'bluesky' | 'mastodon') => boolean;
  getAccount: (platform: 'bluesky' | 'mastodon') => LinkedAccountInfo | undefined;
  clear: () => void;
};

export const useLinkedAccountsStore = create<LinkedAccountsState>((set, get) => ({
  accounts: [],
  loading: false,

  fetchAccounts: async () => {
    set({ loading: true });
    try {
      const result = await getLinkedAccounts();
      set({ accounts: result.accounts, loading: false });
    } catch {
      set({ accounts: [], loading: false });
    }
  },

  hasLinkedAccount: (platform) => {
    return get().accounts.some(a => a.platform === platform && a.active);
  },

  getAccount: (platform) => {
    return get().accounts.find(a => a.platform === platform && a.active);
  },

  clear: () => set({ accounts: [], loading: false }),
}));
