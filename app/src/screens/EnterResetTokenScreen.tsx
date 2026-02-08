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
import { useAppTheme } from '../hooks/useTheme';
import { AuthLogo } from "../components/ui/AuthLogo";
import { NodeNetworkBackground } from "../components/ui/NodeNetworkBackground";

export const EnterResetTokenScreen: React.FC<{
  onTokenEntered: (token: string) => void;
  goBack: () => void;
}> = ({ onTokenEntered, goBack }) => {
  const theme = useAppTheme();
  const [token, setToken] = useState("");

  const onSubmit = () => {
    if (token.trim()) {
      onTokenEntered(token.trim());
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
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
            <ArrowLeft size={24} color={theme.muted} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <AuthLogo size={48} />
          </View>

          <View style={styles.header}>
            <Text style={styles.brandName}>NODE<Text style={{ fontWeight: '400', color: theme.muted }}>social</Text></Text>
            <View style={[styles.iconWrapper, { backgroundColor: `${theme.accent}15` }]}>
              <Key size={28} color={theme.accent} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Enter reset token</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              Paste the token from your email
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              placeholder="Reset token"
              placeholderTextColor={theme.muted}
              value={token}
              onChangeText={setToken}
              style={[styles.input, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.button, !token.trim() && styles.buttonDisabled, { backgroundColor: theme.accent }]}
              onPress={onSubmit}
              disabled={!token.trim()}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.muted }]}>Changed your mind? </Text>
              <TouchableOpacity onPress={goBack}>
                <Text style={[styles.linkText, { color: theme.accent }]}>Go back</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 100,
  },
  button: {
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
    fontSize: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
