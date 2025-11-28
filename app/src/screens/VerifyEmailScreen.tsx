import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resendVerificationEmail, verifyEmail } from "../lib/api";
import { COLORS } from "../constants/theme";

type StatusType = "info" | "error" | "success";

type Props = {
  email: string;
  pendingToken?: string | null;
  onTokenConsumed?: () => void;
  onVerified: () => Promise<void> | void;
  onLogout: () => Promise<void> | void;
};

export const VerifyEmailScreen: React.FC<Props> = ({
  email,
  pendingToken,
  onTokenConsumed,
  onVerified,
  onLogout,
}) => {
  const [manualToken, setManualToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string } | null>(
    null
  );

  const statusStyles = useMemo(() => {
    switch (status?.type) {
      case "success":
        return { container: styles.successBanner, text: styles.successText };
      case "error":
        return { container: styles.errorBanner, text: styles.errorText };
      case "info":
        return { container: styles.infoBanner, text: styles.infoText };
      default:
        return null;
    }
  }, [status]);

  const handleVerify = useCallback(
    async (token: string) => {
      if (!token.trim()) {
        setStatus({ type: "error", message: "Verification token is required" });
        return;
      }

      setVerifying(true);
      setStatus(null);

      try {
        await verifyEmail(token.trim());
        setStatus({
          type: "success",
          message: "Email verified! You're all set to continue.",
        });
        setManualToken("");
        await onVerified();
      } catch (error: any) {
        setStatus({
          type: "error",
          message: error?.message || "Verification failed. Double-check the token.",
        });
      } finally {
        setVerifying(false);
        onTokenConsumed?.();
      }
    },
    [onTokenConsumed, onVerified]
  );

  const handleResend = useCallback(async () => {
    setResending(true);
    setStatus(null);
    try {
      await resendVerificationEmail(email);
      setStatus({
        type: "info",
        message: "If the account is unverified, we've sent a new email.",
      });
    } catch (error: any) {
      setStatus({
        type: "error",
        message: error?.message || "Couldn't resend the email. Try again shortly.",
      });
    } finally {
      setResending(false);
    }
  }, [email]);

  useEffect(() => {
    if (pendingToken) {
      handleVerify(pendingToken);
    }
  }, [handleVerify, pendingToken]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to{" "}
          <Text style={styles.boldEmail}>{email}</Text>. Confirm your email to unlock
          the full experience.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Enter verification token</Text>
        <Text style={styles.cardSubtitle}>
          Tap the link in your inbox or paste the code from the email.
        </Text>
        <TextInput
          value={manualToken}
          onChangeText={setManualToken}
          placeholder="Paste token"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        {status && statusStyles && (
          <View style={statusStyles.container}>
            <Text style={statusStyles.text}>{status.message}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, verifying && styles.disabledButton]}
          onPress={() => handleVerify(manualToken)}
          disabled={verifying}
        >
          {verifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Verify token</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, resending && styles.disabledButton]}
          onPress={handleResend}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator color="#2563EB" />
          ) : (
            <Text style={styles.secondaryButtonText}>Resend email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.bg,
    padding: 24,
    gap: 24,
  },
  header: {
    marginTop: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.node.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.node.muted,
    lineHeight: 22,
  },
  boldEmail: {
    fontWeight: "600",
    color: COLORS.node.text,
  },
  card: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.node.text,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.node.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.node.text,
    backgroundColor: COLORS.node.bg,
  },
  primaryButton: {
    backgroundColor: COLORS.node.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.node.accent,
  },
  secondaryButtonText: {
    color: COLORS.node.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  logoutButton: {
    alignItems: "center",
    marginTop: 8,
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "600",
  },
  successBanner: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  successText: {
    color: "#22C55E",
    fontSize: 14,
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
  },
  infoBanner: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.node.accent,
  },
  infoText: {
    color: COLORS.node.accent,
    fontSize: 14,
    textAlign: "center",
  },
});

