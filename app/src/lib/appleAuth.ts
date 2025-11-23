// src/lib/appleAuth.ts
// Apple Sign-In credential state checking and re-authentication handling
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

/**
 * Check if Apple Sign-In credentials are still valid
 * 
 * Apple can revoke credentials at any time for security reasons.
 * This function checks the credential state and returns whether the user
 * needs to re-authenticate.
 * 
 * ⚠️ IMPORTANT: This method requires real device testing.
 * It will throw an error on simulators.
 * 
 * @param appleUserId - The Apple user ID (from credential.user)
 * @returns Object with state and whether re-authentication is needed
 */
export async function checkAppleCredentialState(
  appleUserId: string
): Promise<{
  isValid: boolean;
  needsReauth: boolean;
  state: AppleAuthentication.AppleAuthenticationCredentialState | null;
  error?: string;
}> {
  // Skip on simulators (getCredentialStateAsync requires real device)
  if (Platform.OS === "ios" && __DEV__) {
    // In development, we can't reliably test this on simulators
    // Return valid state to avoid breaking development flow
    // In production, this will always run on real devices
    try {
      const state = await AppleAuthentication.getCredentialStateAsync(appleUserId);
      return {
        isValid: state === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED,
        needsReauth: state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED,
        state,
      };
    } catch (error: any) {
      // Simulator error: "This method must be tested on a real device"
      if (error?.message?.includes("real device")) {
        console.warn("⚠️ Apple credential state check skipped (simulator)");
        // In dev, assume valid (will work on real devices)
        return {
          isValid: true,
          needsReauth: false,
          state: null,
          error: "simulator_skip",
        };
      }
      throw error;
    }
  }

  try {
    const state = await AppleAuthentication.getCredentialStateAsync(appleUserId);

    const isValid = state === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED;
    const needsReauth =
      state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED ||
      state === AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND;

    return {
      isValid,
      needsReauth,
      state,
    };
  } catch (error: any) {
    console.error("Error checking Apple credential state:", error);
    return {
      isValid: false,
      needsReauth: true,
      state: null,
      error: error?.message || "Unknown error",
    };
  }
}

/**
 * Get a human-readable message for credential state
 */
export function getCredentialStateMessage(
  state: AppleAuthentication.AppleAuthenticationCredentialState | null
): string {
  if (!state) return "Unknown state";

  switch (state) {
    case AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED:
      return "Credentials are valid";
    case AppleAuthentication.AppleAuthenticationCredentialState.REVOKED as any:
      return "Apple Sign-In has been revoked. Please sign in again.";
    case AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND:
      return "Apple Sign-In credentials not found. Please sign in again.";
    case AppleAuthentication.AppleAuthenticationCredentialState.TRANSFERRED:
      return "Apple Sign-In was transferred to another device. Please sign in again.";
    default:
      return "Unknown credential state";
  }
}

