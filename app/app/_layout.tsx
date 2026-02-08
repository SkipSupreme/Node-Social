import React, { useState, useEffect } from 'react';
import { View, StatusBar, ActivityIndicator, Modal, Text, Pressable } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalProvider, PortalHost } from '@gorhom/portal';
import { useAuthStore } from '../src/store/auth';
import { useThemeStore, type ThemeTokens } from '../src/store/theme';
import { LoginScreen } from '../src/screens/LoginScreen';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { ForgotPasswordScreen } from '../src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../src/screens/ResetPasswordScreen';
import { VerifyEmailScreen } from '../src/screens/VerifyEmailScreen';
import * as Linking from 'expo-linking';
import { COLORS } from '../src/constants/theme';
import { useAppTheme } from '../src/hooks/useTheme';
import { SocketProvider } from '../src/context/SocketContext';
import { AuthPromptProvider } from '../src/context/AuthPromptContext';
import { ToastContainer } from '../src/components/ui/Toast';

// ── QueryClient ─────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

// ── ErrorBoundary ───────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.node.bg, padding: 20 }}>
          <Text style={{ color: COLORS.node.text, fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: COLORS.node.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Pressable
            style={{ backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// ── Root Layout ─────────────────────────────────────────────────
export default function RootLayout() {
  const theme = useAppTheme();
  const { user, loading, loadFromStorage, markEmailVerified, logout } = useAuthStore();
  const [authModal, setAuthModal] = useState<'login' | 'register' | 'forgot-password' | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const emailForVerification = user?.email ?? '';

  // Deep linking
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);
      const isValidToken = (t: unknown): t is string =>
        typeof t === 'string' && /^[a-f0-9]{64}$/.test(t);

      if (path === 'reset-password' && isValidToken(queryParams?.token)) {
        setResetToken(queryParams.token);
      } else if (path === 'verify-email' && isValidToken(queryParams?.token)) {
        setVerifyToken(queryParams.token);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  // Load auth from storage
  useEffect(() => { loadFromStorage(); }, []);

  // Hydrate theme store
  useEffect(() => { useThemeStore.getState().hydrate(); }, []);

  // Sync user's custom theme
  useEffect(() => {
    if (user?.customTheme && typeof user.customTheme === 'object') {
      useThemeStore.getState().setUserTheme(user.customTheme as Partial<ThemeTokens>);
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ErrorBoundary>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: theme.bg }}>
          <PortalProvider>
            <QueryClientProvider client={queryClient}>
              <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

              <AuthPromptProvider
                user={user}
                onLogin={() => setAuthModal('login')}
                onRegister={() => setAuthModal('register')}
              >
                <SocketProvider>
                  <Slot />
                </SocketProvider>
              </AuthPromptProvider>

              {/* Auth Modal */}
              <Modal visible={authModal !== null} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: theme.bg }}>
                  {authModal === 'login' ? (
                    <LoginScreen
                      onSuccessLogin={() => setAuthModal(null)}
                      goToRegister={() => setAuthModal('register')}
                      goToForgotPassword={() => setAuthModal('forgot-password')}
                      onClose={() => setAuthModal(null)}
                    />
                  ) : authModal === 'register' ? (
                    <RegisterScreen
                      onSuccessLogin={() => setAuthModal(null)}
                      goToLogin={() => setAuthModal('login')}
                      onClose={() => setAuthModal(null)}
                    />
                  ) : authModal === 'forgot-password' ? (
                    <ForgotPasswordScreen
                      goToLogin={() => setAuthModal('login')}
                      onClose={() => setAuthModal(null)}
                    />
                  ) : null}
                </View>
              </Modal>

              {/* Reset Password Modal - via deep link */}
              <Modal visible={resetToken !== null} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: theme.bg }}>
                  <ResetPasswordScreen
                    token={resetToken || ''}
                    onSuccess={() => setResetToken(null)}
                    onClose={() => setResetToken(null)}
                  />
                </View>
              </Modal>

              {/* Verify Email Modal - via deep link */}
              <Modal visible={verifyToken !== null} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: theme.bg }}>
                  <VerifyEmailScreen
                    pendingToken={verifyToken || ''}
                    email={emailForVerification}
                    onTokenConsumed={() => setVerifyToken(null)}
                    onVerified={async () => {
                      await markEmailVerified();
                      setVerifyToken(null);
                    }}
                    onLogout={async () => {
                      await logout();
                      setVerifyToken(null);
                    }}
                  />
                </View>
              </Modal>

              <PortalHost name="radialWheel" />
              <ToastContainer />
            </QueryClientProvider>
          </PortalProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </View>
  );
}
