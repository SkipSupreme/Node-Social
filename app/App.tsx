import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from "react-native";
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

import * as Linking from "expo-linking";

// Navigation state types
type Screen = 
  | "feed"
  | "createPost"
  | "postDetail"
  | "profile"; // Placeholder for future

export default function App() {
  const { user, loading, loadFromStorage, logout } = useAuthStore();
  
  // Auth flow state
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEnterToken, setShowEnterToken] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Auth Stack
  if (!user) {
    if (resetToken) {
      return (
        <ResetPasswordScreen
          token={resetToken}
          onSuccess={() => {
            setResetToken(null);
            setShowForgotPassword(false);
          }}
        />
      );
    }

    if (showForgotPassword) {
      return (
        <ForgotPasswordScreen
          goToLogin={() => setShowForgotPassword(false)}
          onEnterTokenManually={() => {
            setShowForgotPassword(false);
            setShowEnterToken(true);
          }}
        />
      );
    }

    if (showEnterToken) {
      return (
        <EnterResetTokenScreen
          onTokenEntered={(token) => {
            setResetToken(token);
            setShowEnterToken(false);
          }}
          goBack={() => setShowEnterToken(false)}
        />
      );
    }

    if (showRegister) {
      return (
        <RegisterScreen
          onSuccessLogin={() => {
            setShowRegister(false);
          }}
          goToLogin={() => setShowRegister(false)}
        />
      );
    }

    return (
      <LoginScreen
        onSuccessLogin={() => {}}
        goToRegister={() => setShowRegister(true)}
        goToForgotPassword={() => setShowForgotPassword(true)}
      />
    );
  }

  // Main App Stack
  if (currentScreen === "createPost") {
    return (
      <CreatePostScreen
        onSuccess={() => setCurrentScreen("feed")}
        onCancel={() => setCurrentScreen("feed")}
      />
    );
  }

  if (currentScreen === "postDetail" && selectedPostId) {
    return (
      <PostDetailScreen
        postId={selectedPostId}
        onBack={() => {
          setSelectedPostId(null);
          setCurrentScreen("feed");
        }}
      />
    );
  }

  return (
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
});
