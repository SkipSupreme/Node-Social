import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
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

  return (
    <AuthPromptContext.Provider value={{ promptAuth, requireAuth }}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setVisible(false)}
            >
              <X size={20} color={COLORS.node.muted} />
            </TouchableOpacity>

            {/* Content */}
            <Text style={styles.title}>Join the conversation</Text>
            <Text style={styles.message}>{message}</Text>

            {/* Buttons */}
            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleRegister}>
              <Text style={styles.secondaryButtonText}>Create Account</Text>
            </TouchableOpacity>

            <Text style={styles.footnote}>
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
    backgroundColor: COLORS.node.panel,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.node.border,
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
    color: COLORS.node.text,
    marginBottom: 8,
    marginTop: 8,
  },
  message: {
    fontSize: 15,
    color: COLORS.node.muted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: COLORS.node.accent,
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
    borderColor: COLORS.node.border,
  },
  secondaryButtonText: {
    color: COLORS.node.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  footnote: {
    fontSize: 13,
    color: COLORS.node.muted,
    marginTop: 16,
  },
});
