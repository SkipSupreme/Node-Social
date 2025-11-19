// src/store/auth.ts
import { create } from "zustand";
import type { AuthResponse } from "../lib/api";
import { logout as apiLogout } from "../lib/api";
import { storage } from "../lib/storage";

type User = AuthResponse["user"];

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (data: AuthResponse) => Promise<void>;
  loadFromStorage: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,

  setAuth: async (data) => {
    await storage.setItem("token", data.token);
    await storage.setItem("refreshToken", data.refreshToken);
    await storage.setItem("user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token, loading: false });
  },

  loadFromStorage: async () => {
    try {
      const [token, userJson] = await Promise.all([
        storage.getItem("token"),
        storage.getItem("user"),
      ]);
      if (token && userJson) {
        set({ token, user: JSON.parse(userJson), loading: false });
      } else {
        set({ token: null, user: null, loading: false });
      }
    } catch (error) {
      console.error("Error loading from storage:", error);
      set({ token: null, user: null, loading: false });
    }
  },

  logout: async () => {
    const refreshToken = await storage.getItem("refreshToken");
    await apiLogout(refreshToken || undefined);
    set({ user: null, token: null });
  },
}));