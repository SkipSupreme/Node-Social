import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useTheme';
import { X } from 'lucide-react-native';
import type { AuthResponse } from '../lib/api';

type User = AuthResponse["user"];

interface AuthPromptContextType {
  // Show the auth prompt modal with a custom message
  promptAuth: (message?: string) => void;
  // Check if user is authenticated, if not show prompt and return false
  requireAuth: (message?: string) => boolean;
}

const AuthPromptContext = createContext<AuthPromptContextType | null>(null);

export const useAuthPrompt = () => {
  const context = useContext(AuthPromptContext);
  if (!context) {
    throw new Error('useAuthPrompt must be used within AuthPromptProvider');
  }
  return context;
};

interface AuthPromptProviderProps {
  children: React.ReactNode;
  user: User | null;
  onLogin: () => void;
  onRegister: () => void;
}

export const AuthPromptProvider: React.FC<AuthPromptProviderProps> = ({
  children,
  user,
  onLogin,
  onRegister,
}) => {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('Sign in to continue');

  const promptAuth = useCallback((msg?: string) => {
    setMessage(msg || 'Sign in to continue');
    setVisible(true);
  }, []);

  const requireAuth = useCallback((msg?: string): boolean => {
    if (user) return true;
    promptAuth(msg);
    return false;
  }, [user, promptAuth]);

  const handleLogin = () => {
    setVisible(false);
    onLogin();
  };

  const handleRegister = () => {
    setVisible(false);
    onRegister();
  };

  // Memoize context value so consumers (PostCardInner) don't re-render
  // when this provider re-renders for unrelated reasons (modal state, theme, etc.)
  const contextValue = useMemo(() => ({ promptAuth, requireAuth }), [promptAuth, requireAuth]);

  return (
    <AuthPromptContext.Provider value={contextValue}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setVisible(false)}
            >
              <X size={20} color={theme.muted} />
            </TouchableOpacity>

            {/* Content */}
            <Text style={[styles.title, { color: theme.text }]}>Join the conversation</Text>
            <Text style={[styles.message, { color: theme.muted }]}>{message}</Text>

            {/* Buttons */}
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={handleRegister}>
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Create Account</Text>
            </TouchableOpacity>

            <Text style={[styles.footnote, { color: theme.muted }]}>
              Browse freely without an account
            </Text>
          </View>
        </View>
      </Modal>
    </AuthPromptContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  footnote: {
    fontSize: 13,
    marginTop: 16,
  },
});
