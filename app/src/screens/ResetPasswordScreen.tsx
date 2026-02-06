// src/screens/ResetPasswordScreen.tsx
import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Lock, X } from "lucide-react-native";
import { resetPassword } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { COLORS } from "../constants/theme";
import { AuthLogo } from "../components/ui/AuthLogo";
import { NodeNetworkBackground } from "../components/ui/NodeNetworkBackground";

export const ResetPasswordScreen: React.FC<{
  token: string;
  onSuccess: () => void;
  onClose?: () => void;
}> = ({ token, onSuccess, onClose }) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      setError("Please enter both password fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      // Password reset successful, redirect to login
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <NodeNetworkBackground />
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color={COLORS.node.muted} />
        </TouchableOpacity>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <AuthLogo size={48} />
          </View>

          <View style={styles.header}>
            <Text style={styles.brandName}>NODE<Text style={{ fontWeight: '400', color: COLORS.node.muted }}>social</Text></Text>
            <View style={styles.iconWrapper}>
              <Lock size={28} color={COLORS.node.accent} />
            </View>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>Enter your new password</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              placeholder="New password (min. 8 characters)"
              placeholderTextColor={COLORS.node.muted}
              secureTextEntry
              autoComplete="password-new"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

            <TextInput
              placeholder="Confirm password"
              placeholderTextColor={COLORS.node.muted}
              secureTextEntry
              autoComplete="password-new"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
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
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.bg,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 100,
    padding: 8,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 32,
    fontWeight: "800",
    color: '#ffffff',
    letterSpacing: 6,
    marginBottom: 8,
    textAlign: 'center',
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${COLORS.node.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.node.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.node.muted,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: COLORS.node.panel,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.node.text,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    backgroundColor: COLORS.node.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    boxShadow: '0px 4px 8px rgba(99, 102, 241, 0.3)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
