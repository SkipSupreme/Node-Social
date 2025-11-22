// src/store/auth.ts
import { create } from "zustand";
import type { AuthResponse } from "../lib/api";
import { logout as apiLogout, getMe } from "../lib/api";
import { storage } from "../lib/storage";
import { checkAppleCredentialState } from "../lib/appleAuth";
import { Platform } from "react-native";

type User = AuthResponse["user"];

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  appleUserId: string | null; // Store Apple user ID for credential state checks
  setAuth: (data: AuthResponse, appleUserId?: string | null) => Promise<void>;
  loadFromStorage: () => Promise<void>;
  logout: () => Promise<void>;
  markEmailVerified: () => Promise<void>;
  checkAppleCredentials: () => Promise<boolean>; // Returns true if valid, false if needs reauth
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: true,
  appleUserId: null,

  setAuth: async (data, appleUserId = null) => {
    await storage.setItem("token", data.token);
    await storage.setItem("refreshToken", data.refreshToken);
    await storage.setItem("user", JSON.stringify(data.user));
    if (appleUserId) {
      await storage.setItem("appleUserId", appleUserId);
    }
    set({ 
      user: data.user, 
      token: data.token, 
      loading: false,
      appleUserId: appleUserId || null,
    });
  },

  loadFromStorage: async () => {
    try {
      const [token, userJson, appleUserId] = await Promise.all([
        storage.getItem("token"),
        storage.getItem("user"),
        storage.getItem("appleUserId"),
      ]);
      if (token && userJson) {
        const cachedUser = JSON.parse(userJson) as User;
        set({ 
          token, 
          user: cachedUser, 
          loading: false,
          appleUserId: appleUserId || null,
        });

        // Check Apple credential state if user signed in with Apple
        if (appleUserId && Platform.OS === "ios") {
          const credentialCheck = await checkAppleCredentialState(appleUserId);
          if (credentialCheck.needsReauth) {
            console.warn("🍎 Apple credentials revoked, logging out");
            // Credentials revoked - log user out
            set({ user: null, token: null, appleUserId: null });
            await storage.removeItem("token");
            await storage.removeItem("refreshToken");
            await storage.removeItem("user");
            await storage.removeItem("appleUserId");
            return;
          }
        }

        try {
          const me = await getMe();
          console.log('getMe() returned:', { emailVerified: me.user.emailVerified });
          set({ user: me.user });
          await storage.setItem("user", JSON.stringify(me.user));
        } catch (refreshError) {
          console.warn("Failed to refresh user profile:", refreshError);
        }
      } else {
        set({ token: null, user: null, loading: false, appleUserId: null });
      }
    } catch (error) {
      console.error("Error loading from storage:", error);
      set({ token: null, user: null, loading: false, appleUserId: null });
    }
  },

  checkAppleCredentials: async () => {
    const state = get();
    if (!state.appleUserId || Platform.OS !== "ios") {
      return true; // Not using Apple Sign-In or not iOS
    }

    try {
      const credentialCheck = await checkAppleCredentialState(state.appleUserId);
      if (credentialCheck.needsReauth) {
        // Credentials revoked - log user out
        await state.logout();
        await storage.removeItem("appleUserId");
        set({ appleUserId: null });
        return false;
      }
      return credentialCheck.isValid;
    } catch (error) {
      console.error("Error checking Apple credentials:", error);
      // On error, assume valid (don't log out on transient errors)
      return true;
    }
  },

  logout: async () => {
    const refreshToken = await storage.getItem("refreshToken");
    await apiLogout(refreshToken || undefined);
    await storage.removeItem("appleUserId");
    set({ user: null, token: null, appleUserId: null });
  },

  markEmailVerified: async () => {
    let updatedUser: User | null = null;

    set((state) => {
      if (!state.user) {
        return state;
      }
      updatedUser = { ...state.user, emailVerified: true };
      return { user: updatedUser };
    });

    if (updatedUser) {
      await storage.setItem("user", JSON.stringify(updatedUser));
    }
  },
}));