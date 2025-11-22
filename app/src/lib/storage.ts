// src/lib/storage.ts
// Platform-aware storage: SecureStore for native, localStorage for web
import { Platform } from "react-native";

// Check if we're on web
const isWeb = Platform.OS === "web";

// Lazy load SecureStore only on native platforms to avoid web errors
let SecureStore: typeof import("expo-secure-store") | null = null;

if (!isWeb) {
  // Only import SecureStore on native platforms
  SecureStore = require("expo-secure-store");
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (isWeb) {
        // Use localStorage for web
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      } else {
        // Use SecureStore for native (iOS/Android)
        if (!SecureStore) {
          throw new Error("SecureStore not available");
        }
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isWeb) {
        // Use localStorage for web
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, value);
        } else {
          throw new Error("localStorage not available");
        }
      } else {
        // Use SecureStore for native (iOS/Android)
        if (!SecureStore) {
          throw new Error("SecureStore not available");
        }
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isWeb) {
        // Use localStorage for web
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } else {
        // Use SecureStore for native (iOS/Android)
        if (!SecureStore) {
          return; // Silently fail if SecureStore not available
        }
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
    }
  },
};

