// src/config.ts
import { Platform } from "react-native";
import Constants from "expo-constants";

// Default host per platform (Android emulators need 10.0.2.2 to reach host machine)
const DEFAULT_LOCAL_IP = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const LOCAL_DEV_IP = process.env.EXPO_PUBLIC_DEV_HOST || DEFAULT_LOCAL_IP;

// Detect if running on web and on production domain
const isWeb = Platform.OS === "web";
const isProductionDomain = 
  isWeb && 
  typeof window !== "undefined" && 
  (window.location.hostname === "node-social.com" || 
   window.location.hostname === "www.node-social.com");

type GoogleExtra = {
  googleAndroidClientId?: string;
  googleIosClientId?: string;
  googleWebClientId?: string;
  googleExpoClientId?: string;
};

const extra = Constants.expoConfig?.extra as (GoogleExtra & { eas?: GoogleExtra }) | undefined;

const getExtraValue = <K extends keyof GoogleExtra>(key: K) => {
  return extra?.[key] ?? extra?.eas?.[key];
};

// Use production API URL when on node-social.com domain, otherwise use env/config or default to localhost
export const API_URL =
  isProductionDomain
    ? "https://api.node-social.com"
    : process.env.EXPO_PUBLIC_API_URL ??
      (Constants.expoConfig?.extra as { apiUrl?: string })?.apiUrl ??
      `http://${LOCAL_DEV_IP}:3000`;

export const googleOAuthConfig = {
  expoClientId:
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ??
    getExtraValue("googleExpoClientId"),
  androidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    getExtraValue("googleAndroidClientId"),
  iosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
    getExtraValue("googleIosClientId"),
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    getExtraValue("googleWebClientId"),
};

export const isGoogleSignInEnabled = Boolean(
  googleOAuthConfig.expoClientId ||
    googleOAuthConfig.androidClientId ||
    googleOAuthConfig.iosClientId ||
    googleOAuthConfig.webClientId
);