// src/screens/LoginScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { login, loginWithApple, loginWithGoogle } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { googleOAuthConfig, isGoogleSignInEnabled } from "../config";

// CRITICAL: Must be called at top level (outside component) to dismiss auth popup
WebBrowser.maybeCompleteAuthSession();

export const LoginScreen: React.FC<{
  onSuccessLogin: () => void;
  goToRegister: () => void;
  goToForgotPassword: () => void;
}> = ({ onSuccessLogin, goToRegister, goToForgotPassword }) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Platform-specific redirect URI configuration
  // Web: Use the actual domain (node-social.com) via Cloudflare Tunnel
  // Native: Uses custom scheme (handled automatically by platform client IDs)
  const redirectUri = Platform.OS === "web"
    ? "https://node-social.com" // Use the actual domain from Cloudflare Tunnel
    : AuthSession.makeRedirectUri({
        scheme: "nodesocial",
        path: "oauth2redirect/google",
        useProxy: false,
      });

  // Log redirect URI for debugging - CRITICAL for web setup
  useEffect(() => {
    if (Platform.OS === "web") {
      // Always log on web - this is critical for setup
      console.log("🔴 WEB REDIRECT URI - COPY THIS EXACTLY:");
      console.log("═══════════════════════════════════════");
      console.log(redirectUri); // Should be https://node-social.com
      console.log("═══════════════════════════════════════");
      console.log("📋 Add this EXACT URI to Google Cloud Console:");
      console.log("   1. Go to: APIs & Services > Credentials");
      console.log("   2. Edit your Web Client ID");
      console.log("   3. Under 'Authorized redirect URIs', click + ADD URI");
      console.log("   4. Paste: https://node-social.com");
      console.log("   5. Click SAVE");
      console.log("   6. Wait 5-10 minutes and try again");
      console.log("");
    } else if (__DEV__) {
      console.log("🔗 Generated Redirect URI:", redirectUri);
      console.log("📱 Platform:", Platform.OS);
      console.log("ℹ️  For native apps, redirect URIs are handled automatically");
      if (Platform.OS === "ios" && googleOAuthConfig.iosClientId) {
        const clientIdPart = googleOAuthConfig.iosClientId.split(".")[0];
        const reverseClientId = `com.googleusercontent.apps.${clientIdPart}:/`;
        console.log("ℹ️  iOS reverse client ID format:", reverseClientId);
      }
    }
  }, [redirectUri]);

  // useIdTokenAuthRequest is correct - backend expects idToken, not accessToken
  // This uses PKCE by default and handles the OIDC flow properly
  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest(
    {
      // Three-client strategy: platform-specific IDs
      androidClientId: googleOAuthConfig.androidClientId,
      iosClientId: googleOAuthConfig.iosClientId,
      webClientId: googleOAuthConfig.webClientId,
      // Redirect URI: required for web, optional for native (handled automatically)
      redirectUri: Platform.OS === "web" ? redirectUri : undefined,
    },
    {
      // NO proxy - we're using development builds, not Expo Go
      useProxy: false,
    }
  );

  useEffect(() => {
    let mounted = true;
    // Apple Sign-In is only available on iOS
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then((available) => {
          if (mounted) setAppleAvailable(available);
        })
        .catch(() => {
          if (mounted) setAppleAvailable(false);
        });
    } else {
      // Not iOS, so Apple Sign-In is not available
      if (mounted) setAppleAvailable(false);
    }
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await login(email.trim(), password);
      await setAuth(data);
      onSuccessLogin();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setGoogleLoading(true);
      setError(null);
      try {
        const data = await loginWithGoogle(idToken);
        await setAuth(data);
        onSuccessLogin();
      } catch (e: any) {
        setError(e?.message ?? "Google sign-in failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    [onSuccessLogin, setAuth]
  );

  useEffect(() => {
    if (!googleResponse) {
      return;
    }

    // Debug logging to help diagnose issues
    console.log("Google OAuth Response:", {
      type: googleResponse.type,
      params: googleResponse.params,
      error: googleResponse.error,
    });

    if (googleResponse.type === "success") {
      // Try multiple possible locations for the id_token
      const params = googleResponse.params as Record<string, string> | undefined;
      const token =
        params?.id_token ||
        params?.idToken ||
        params?.token ||
        (googleResponse as any).authentication?.idToken;

      if (token) {
        console.log("Found Google id_token, proceeding with login");
        handleGoogleCredential(token);
      } else {
        console.error("Google token not found in response:", {
          params,
          fullResponse: googleResponse,
        });
        setGoogleLoading(false);
        setError("Missing Google token. Please try again.");
      }
    } else if (googleResponse.type === "error") {
      setGoogleLoading(false);
      const errorMsg =
        googleResponse.error?.message ??
        googleResponse.error?.error_description ??
        "Google sign-in was interrupted. Please try again.";
      console.error("Google OAuth error:", googleResponse.error);
      
      // Provide helpful error message for redirect URI mismatch
      if (errorMsg.includes("invalid_request") || errorMsg.includes("redirect_uri_mismatch")) {
        if (Platform.OS === "web") {
          const helpfulError = `Redirect URI Mismatch Error\n\nYour app is using: https://node-social.com\n\nAdd this to Google Cloud Console:\n\n1. Go to: APIs & Services > Credentials\n2. Edit your Web Client ID\n3. Under "Authorized redirect URIs", click + ADD URI\n4. Add: https://node-social.com\n5. Click SAVE\n6. Wait 5-10 minutes and try again\n\n⚠️  Must match exactly: https://node-social.com`;
          setError(helpfulError);
          console.error("🔴 WEB REDIRECT URI MISMATCH");
          console.error("📋 Add this to Google Cloud Console: https://node-social.com");
        } else {
          const helpfulError = `Google OAuth configuration error. For native apps, verify:\n\n1. OAuth consent screen is configured\n2. Your email is added to Test users (if app is in Testing mode)\n3. Platform client IDs are correctly configured\n\nDo NOT register custom URL schemes in Web Client's redirect URIs - that field only accepts HTTPS URLs.`;
          setError(helpfulError);
          console.error("🔴 Google OAuth Error:", errorMsg);
          console.error("ℹ️  For native apps, redirect URIs are handled automatically by platform client IDs");
        }
      } else {
        setError(errorMsg);
      }
    } else if (googleResponse.type === "dismiss" || googleResponse.type === "cancel") {
      setGoogleLoading(false);
      console.log("Google OAuth cancelled or dismissed");
    }
  }, [googleResponse, handleGoogleCredential]);

  const startGoogleLogin = useCallback(async () => {
    if (!isGoogleSignInEnabled) {
      setError("Google sign-in is not configured yet.");
      return;
    }

    if (!googleRequest) {
      setError("Google sign-in is still initializing. Please try again.");
      return;
    }

    // Debug logging with exact redirect URI for Google Cloud Console
    console.log("Starting Google login:", {
      redirectUri,
      hasAndroidClientId: !!googleOAuthConfig.androidClientId,
      hasIosClientId: !!googleOAuthConfig.iosClientId,
      hasWebClientId: !!googleOAuthConfig.webClientId,
      platform: Platform.OS,
      requestUrl: googleRequest.url,
    });
    
    // Log OAuth configuration info (only in dev mode)
    if (__DEV__) {
      if (Platform.OS === "web") {
        console.log("⚠️ For web: Register this redirect URI in Google Cloud Console:");
        console.log("   Redirect URI:", redirectUri);
        console.log("   Go to: Web Client > Authorized redirect URIs");
      } else {
        console.log("ℹ️  For native apps: Redirect URIs are handled automatically");
      }
    }

    setError(null);
    setGoogleLoading(true);
    try {
      const result = await promptGoogleSignIn();
      console.log("Google sign-in prompt result:", result);
      // Note: The actual response comes through googleResponse, not the prompt result
    } catch (err) {
      console.error("Error prompting Google sign-in:", err);
      setGoogleLoading(false);
      setError("Unable to open Google sign-in. Please try again.");
    }
  }, [googleRequest, promptGoogleSignIn, redirectUri]);

  const startAppleLogin = useCallback(async () => {
    if (!appleAvailable || appleLoading) {
      setError("Apple sign-in is not available on this device.");
      return;
    }

    setError(null);
    setAppleLoading(true);
    try {
      // CRITICAL: Generate nonce for replay protection per document Section 6.2
      const nonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce, // Replay protection
      });

      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }

      // CRITICAL: Apple only returns email and fullName on FIRST login
      // Subsequent logins return null for these fields
      // We MUST capture and send this data immediately - it cannot be retrieved again
      const isFirstLogin = !!(credential.email || credential.fullName);
      
      if (isFirstLogin) {
        console.log("🍎 Apple Sign-In - FIRST LOGIN detected");
        console.log("📧 Email:", credential.email);
        console.log("👤 Full Name:", credential.fullName);
        // Backend should handle storing this data
      } else {
        console.log("🍎 Apple Sign-In - Returning user (email/name not provided)");
      }

      // Send identityToken to backend for verification
      // CRITICAL: Also send email and fullName if available (first login only)
      // Backend will extract user ID from token and handle account creation/linking
      const data = await loginWithApple(
        credential.identityToken,
        credential.email,
        credential.fullName,
        nonce // Send nonce for replay protection
      );
      // Store Apple user ID for credential state checks
      // credential.user is the stable Apple user identifier
      await setAuth(data, credential.user);
      onSuccessLogin();
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") {
        setAppleLoading(false);
        return;
      }

      // Handle Error 1000 (missing entitlement) with helpful message
      if (err?.code === "1000" || err?.message?.includes("1000")) {
        console.error("❌ Apple Sign-In Error 1000: Missing entitlement in provisioning profile");
        setError("Apple Sign-In is not properly configured. Please contact support.");
      } else {
        setError(err?.message ?? "Apple sign-in failed. Please try again.");
      }
      setAppleLoading(false);
    }
  }, [appleAvailable, onSuccessLogin, setAuth]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={goToForgotPassword} style={styles.forgotPassword}>
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>

            {(isGoogleSignInEnabled || appleAvailable) && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                {isGoogleSignInEnabled && (
                  <TouchableOpacity
                    style={[
                      styles.googleButton,
                      (googleLoading || !googleRequest) && styles.buttonDisabled,
                    ]}
                    onPress={startGoogleLogin}
                    disabled={googleLoading || !googleRequest}
                  >
                    {googleLoading ? (
                      <ActivityIndicator color="#1E293B" />
                    ) : (
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    )}
                  </TouchableOpacity>
                )}
                {appleAvailable && Platform.OS === "ios" && (
                  <View style={styles.appleButtonWrapper}>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={12}
                      style={[styles.appleButton, appleLoading && styles.buttonDisabled]}
                      onPress={startAppleLogin}
                    />
                    {appleLoading && (
                      <View style={styles.appleLoadingOverlay}>
                        <ActivityIndicator color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={goToRegister}>
                <Text style={styles.linkText}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1E293B",
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotPassword: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  dividerText: {
    fontSize: 13,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  googleButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  googleButtonText: {
    color: "#1F2937",
    fontSize: 15,
    fontWeight: "600",
  },
  appleButtonWrapper: {
    marginTop: 12,
    position: "relative",
  },
  appleButton: {
    width: "100%",
    height: 48,
  },
  appleLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.2)",
    borderRadius: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#64748B",
    fontSize: 14,
  },
  linkText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
});