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
import { getErrorMessage } from "../lib/errors";
import { useAppTheme } from '../hooks/useTheme';

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
  const theme = useAppTheme();
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
      } catch (error: unknown) {
        setStatus({
          type: "error",
          message: getErrorMessage(error, "Verification failed. Double-check the token."),
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
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message: getErrorMessage(error, "Couldn't resend the email. Try again shortly."),
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Verify your email</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          We sent a verification link to{" "}
          <Text style={[styles.boldEmail, { color: theme.text }]}>{email}</Text>. Confirm your email to unlock
          the full experience.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Enter verification token</Text>
        <Text style={[styles.cardSubtitle, { color: theme.muted }]}>
          Tap the link in your inbox or paste the code from the email.
        </Text>
        <TextInput
          value={manualToken}
          onChangeText={setManualToken}
          placeholder="Paste token"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }]}
        />

        {status && statusStyles && (
          <View style={statusStyles.container}>
            <Text style={statusStyles.text}>{status.message}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, verifying && styles.disabledButton, { backgroundColor: theme.accent }]}
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
          style={[styles.secondaryButton, resending && styles.disabledButton, { borderColor: theme.accent }]}
          onPress={handleResend}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator color="#2563EB" />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Resend email</Text>
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
    padding: 24,
    gap: 24,
  },
  header: {
    marginTop: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  boldEmail: {
    fontWeight: "600",
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    gap: 16,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  cardSubtitle: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  primaryButton: {
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
  },
  secondaryButtonText: {
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
  },
  infoText: {
    fontSize: 14,
    textAlign: "center",
  },
});

