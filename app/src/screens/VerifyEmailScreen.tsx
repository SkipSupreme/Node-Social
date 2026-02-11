import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
  const [code, setCode] = useState("");
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
    async (value: string) => {
      if (!value.trim()) {
        setStatus({ type: "error", message: "Verification code is required" });
        return;
      }

      setVerifying(true);
      setStatus(null);

      try {
        await verifyEmail(value.trim());
        setStatus({
          type: "success",
          message: "Email verified! You're all set.",
        });
        setCode("");
        await onVerified();
      } catch (error: unknown) {
        setStatus({
          type: "error",
          message: getErrorMessage(error, "Verification failed. Check the code and try again."),
        });
      } finally {
        setVerifying(false);
        onTokenConsumed?.();
      }
    },
    [onTokenConsumed, onVerified]
  );

  const handleCodeChange = useCallback((text: string) => {
    // Only allow digits
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // Auto-submit when 6 digits entered
    if (digits.length === 6) {
      handleVerify(digits);
    }
  }, [handleVerify]);

  const handleResend = useCallback(async () => {
    setResending(true);
    setStatus(null);
    try {
      await resendVerificationEmail(email);
      setCode("");
      setStatus({
        type: "info",
        message: "A new code has been sent to your email.",
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
          We sent a 6-digit code to{" "}
          <Text style={[styles.boldEmail, { color: theme.text }]}>{email}</Text>
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Enter verification code</Text>
        <Text style={[styles.cardSubtitle, { color: theme.muted }]}>
          The code expires in 15 minutes.
        </Text>
        <TextInput
          value={code}
          onChangeText={handleCodeChange}
          placeholder="000000"
          placeholderTextColor="#94A3B8"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textContentType="oneTimeCode"
          style={[styles.codeInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }]}
        />

        {status && statusStyles && (
          <View style={statusStyles.container}>
            <Text style={statusStyles.text}>{status.message}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, (verifying || code.length < 6) && styles.disabledButton, { backgroundColor: theme.accent }]}
          onPress={() => handleVerify(code)}
          disabled={verifying || code.length < 6}
        >
          {verifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Verify</Text>
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
            <Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Resend code</Text>
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
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 12,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
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

