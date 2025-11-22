import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Dimensions } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "./src/store/auth";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { ResetPasswordScreen } from "./src/screens/ResetPasswordScreen";
import { EnterResetTokenScreen } from "./src/screens/EnterResetTokenScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { CreatePostScreen } from "./src/screens/CreatePostScreen";
import { PostDetailScreen } from "./src/screens/PostDetailScreen";
import { Post } from "./src/lib/api";
import { setupLoggingFilters } from "./src/lib/logging";
import { VerifyEmailScreen } from "./src/screens/VerifyEmailScreen";

// Phase 0-6 - Web Interface Components
import { WebLayout } from "./src/web/components/WebLayout";
import { useResponsive } from "./src/web/hooks/useResponsive";
import { RadialWheelProvider } from "./src/web/components/VibeVectors/RadialWheelProvider";

import * as Linking from "expo-linking";

// Setup logging filters to suppress harmless iOS Simulator warnings
setupLoggingFilters();

// Navigation state types
type Screen = 
  | "feed"
  | "createPost"
  | "postDetail"
  | "profile"; // Placeholder for future

// Main App Component - wrapped with RadialWheelProvider at root level for both web and mobile
function AppContent() {
  const { user, loading, loadFromStorage, logout, markEmailVerified } = useAuthStore();
  const { isMobile, isDesktop } = useResponsive();
  
  // Auth flow state
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEnterToken, setShowEnterToken] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // App flow state
  const [currentScreen, setCurrentScreen] = useState<Screen>("feed");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();

    // Handle deep links for password reset
    if (Linking && typeof Linking.getInitialURL === 'function') {
      const handleDeepLink = (event: { url: string }) => {
        try {
          const parsed = Linking.parse(event.url);
          const path = parsed.path;
          const token = parsed.queryParams?.token;
          if (path === "reset-password" && token) {
            setResetToken(token as string);
          } else if (path === "verify-email" && token) {
            setVerificationToken(token as string);
          }
        } catch (error) {
          console.error("Error parsing deep link:", error);
        }
      };

      Linking.getInitialURL()
        .then((url: string | null) => {
          if (url) {
            try {
              const parsed = Linking.parse(url);
              const path = parsed.path;
              const token = parsed.queryParams?.token;
              if (path === "reset-password" && token) {
                setResetToken(token as string);
              } else if (path === "verify-email" && token) {
                setVerificationToken(token as string);
              }
            } catch (error) {
              console.error("Error parsing initial URL:", error);
            }
          }
        })
        .catch((error: unknown) => {
          console.error("Error getting initial URL:", error);
        });

      const subscription = Linking.addEventListener("url", handleDeepLink);
      return () => {
        if (subscription) subscription.remove();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Auth Stack
  if (!user) {
    if (resetToken) {
      return (
        <SafeAreaProvider>
          <ResetPasswordScreen
            token={resetToken}
            onSuccess={() => {
              setResetToken(null);
              setShowForgotPassword(false);
            }}
          />
        </SafeAreaProvider>
      );
    }

    if (showForgotPassword) {
      return (
        <SafeAreaProvider>
          <ForgotPasswordScreen
            goToLogin={() => setShowForgotPassword(false)}
            onEnterTokenManually={() => {
              setShowForgotPassword(false);
              setShowEnterToken(true);
            }}
          />
        </SafeAreaProvider>
      );
    }

    if (showEnterToken) {
      return (
        <SafeAreaProvider>
          <EnterResetTokenScreen
            onTokenEntered={(token) => {
              setResetToken(token);
              setShowEnterToken(false);
            }}
            goBack={() => setShowEnterToken(false)}
          />
        </SafeAreaProvider>
      );
    }

    if (showRegister) {
      return (
        <SafeAreaProvider>
          <RegisterScreen
            onSuccessLogin={() => {
              setShowRegister(false);
            }}
            goToLogin={() => setShowRegister(false)}
          />
        </SafeAreaProvider>
      );
    }

    return (
      <SafeAreaProvider>
        <LoginScreen
          onSuccessLogin={() => {}}
          goToRegister={() => setShowRegister(true)}
          goToForgotPassword={() => setShowForgotPassword(true)}
        />
      </SafeAreaProvider>
    );
  }

  if (user && !user.emailVerified) {
    return (
      <SafeAreaProvider>
        <VerifyEmailScreen
          email={user.email}
          pendingToken={verificationToken}
          onTokenConsumed={() => setVerificationToken(null)}
          onVerified={async () => {
            await markEmailVerified();
            setVerificationToken(null);
          }}
          onLogout={async () => {
            await logout();
            setVerificationToken(null);
          }}
        />
      </SafeAreaProvider>
    );
  }

  // Phase 8 - Responsive: Switch between web/mobile layouts based on screen size
  // On web platform, use responsive hook; on native, always mobile
  const isWeb = Platform.OS === "web";
  const shouldUseWebLayout = isWeb && isDesktop; // Desktop web = web layout, mobile/native = mobile layout

  // Main App Stack
  if (currentScreen === "createPost") {
    return (
      <SafeAreaProvider>
        <CreatePostScreen
          onSuccess={() => setCurrentScreen("feed")}
          onCancel={() => setCurrentScreen("feed")}
        />
      </SafeAreaProvider>
    );
  }

  if (currentScreen === "postDetail" && selectedPostId) {
    return (
      <SafeAreaProvider>
        <PostDetailScreen
          postId={selectedPostId}
          onBack={() => {
            setSelectedPostId(null);
            setCurrentScreen("feed");
          }}
        />
      </SafeAreaProvider>
    );
  }

  // Render web layout on desktop web, mobile layout on small screens or native platforms
  if (shouldUseWebLayout) {
    return (
      <SafeAreaProvider>
        <View style={styles.webContainer}>
          {/* Web Header Bar */}
          <View style={styles.webHeader}>
            <Text style={styles.webHeaderTitle}>Node Social</Text>
            <View style={styles.webHeaderRight}>
              {user && (
                <>
                  <Text style={styles.webHeaderUser}>{user.email.split("@")[0]}</Text>
                  <TouchableOpacity style={styles.webHeaderButton} onPress={logout}>
                    <Text style={styles.webHeaderButtonText}>Sign Out</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Main Web Layout */}
          <WebLayout />
        </View>
      </SafeAreaProvider>
    );
  }

  // Mobile: Render existing mobile screens
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <FeedScreen
          onCreatePost={() => setCurrentScreen("createPost")}
          onPostPress={(post: Post) => {
            setSelectedPostId(post.id);
            setCurrentScreen("postDetail");
          }}
        />
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
  },
  logoutButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 8,
    zIndex: 10,
  },
  logoutText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "600",
  },
  // Phase 0-6 - Web Interface Styles
  webContainer: {
    width: "100%",
    height: "100vh",
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  webHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    height: 56,
  },
  webHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  webHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  webHeaderUser: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  webHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
  },
  webHeaderButtonText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "600",
  },
});

// Root App Component - wraps everything with RadialWheelProvider
export default function App() {
  return (
    <RadialWheelProvider>
      <AppContent />
    </RadialWheelProvider>
  );
}
