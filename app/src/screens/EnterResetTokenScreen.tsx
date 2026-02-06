// src/screens/EnterResetTokenScreen.tsx
import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Key, ArrowLeft } from "lucide-react-native";
import { COLORS } from "../constants/theme";
import { AuthLogo } from "../components/ui/AuthLogo";
import { NodeNetworkBackground } from "../components/ui/NodeNetworkBackground";

export const EnterResetTokenScreen: React.FC<{
  onTokenEntered: (token: string) => void;
  goBack: () => void;
}> = ({ onTokenEntered, goBack }) => {
  const [token, setToken] = useState("");

  const onSubmit = () => {
    if (token.trim()) {
      onTokenEntered(token.trim());
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <NodeNetworkBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <ArrowLeft size={24} color={COLORS.node.muted} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <AuthLogo size={48} />
          </View>

          <View style={styles.header}>
            <Text style={styles.brandName}>NODE<Text style={{ fontWeight: '400', color: COLORS.node.muted }}>social</Text></Text>
            <View style={styles.iconWrapper}>
              <Key size={28} color={COLORS.node.accent} />
            </View>
            <Text style={styles.title}>Enter reset token</Text>
            <Text style={styles.subtitle}>
              Paste the token from your email
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              placeholder="Reset token"
              placeholderTextColor={COLORS.node.muted}
              value={token}
              onChangeText={setToken}
              style={styles.input}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.button, !token.trim() && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={!token.trim()}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Changed your mind? </Text>
              <TouchableOpacity onPress={goBack}>
                <Text style={styles.linkText}>Go back</Text>
              </TouchableOpacity>
            </View>
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
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: 8,
    zIndex: 1,
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
    minHeight: 100,
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: COLORS.node.muted,
    fontSize: 14,
  },
  linkText: {
    color: COLORS.node.accent,
    fontSize: 14,
    fontWeight: "600",
  },
});
