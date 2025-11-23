// src/screens/RegisterScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { register, checkUsername } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { COLORS } from "../constants/theme";

export const RegisterScreen: React.FC<{ onSuccessLogin: () => void; goToLogin: () => void }> = ({
  onSuccessLogin,
  goToLogin,
}) => {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });

  // Date state
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'username') {
      setUsernameAvailable(null);
    }
  };

  // Debounce username check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.username.length >= 3) {
        setCheckingUsername(true);
        try {
          const res = await checkUsername(formData.username);
          setUsernameAvailable(res.available);
        } catch {
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username]);

  const onSubmit = async () => {
    setError(null);

    // Validation
    if (!formData.email || !formData.password || !formData.username || !formData.firstName || !formData.lastName || !day || !month || !year) {
      setError("Please fill in all fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (usernameAvailable === false) {
      setError("Username is already taken");
      return;
    }

    // Construct Date
    const d = parseInt(day);
    const m = parseInt(month);
    const y = parseInt(year);

    if (isNaN(d) || isNaN(m) || isNaN(y) || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > new Date().getFullYear()) {
      setError("Please enter a valid date of birth");
      return;
    }

    const dobDate = new Date(y, m - 1, d);
    // Verify valid date (e.g. Feb 31)
    if (dobDate.getFullYear() !== y || dobDate.getMonth() !== m - 1 || dobDate.getDate() !== d) {
      setError("Invalid date");
      return;
    }

    setLoading(true);
    try {
      const data = await register(
        formData.email.trim(),
        formData.password,
        formData.username.trim(),
        formData.firstName.trim(),
        formData.lastName.trim(),
        dobDate.toISOString()
      );
      await setAuth(data);
      onSuccessLogin();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join Node Social today</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <TextInput
                placeholder="First Name"
                placeholderTextColor={COLORS.node.muted}
                value={formData.firstName}
                onChangeText={(t) => handleChange('firstName', t)}
                style={[styles.input, styles.halfInput]}
              />
              <TextInput
                placeholder="Last Name"
                placeholderTextColor={COLORS.node.muted}
                value={formData.lastName}
                onChangeText={(t) => handleChange('lastName', t)}
                style={[styles.input, styles.halfInput]}
              />
            </View>

            <View>
              <TextInput
                placeholder="Username"
                placeholderTextColor={COLORS.node.muted}
                autoCapitalize="none"
                value={formData.username}
                onChangeText={(t) => handleChange('username', t)}
                style={[
                  styles.input,
                  usernameAvailable === true && styles.inputSuccess,
                  usernameAvailable === false && styles.inputError
                ]}
              />
              {checkingUsername && <ActivityIndicator size="small" color={COLORS.node.muted} style={styles.inputIcon} />}
              {usernameAvailable === false && <Text style={styles.fieldError}>Username taken</Text>}
            </View>

            <TextInput
              placeholder="Email"
              placeholderTextColor={COLORS.node.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={formData.email}
              onChangeText={(t) => handleChange('email', t)}
              style={styles.input}
            />

            <View>
              <Text style={styles.label}>Date of Birth</Text>
              <View style={styles.row}>
                <TextInput
                  placeholder="DD"
                  placeholderTextColor={COLORS.node.muted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={day}
                  onChangeText={setDay}
                  style={[styles.input, { flex: 1 }]}
                />
                <TextInput
                  placeholder="MM"
                  placeholderTextColor={COLORS.node.muted}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={month}
                  onChangeText={setMonth}
                  style={[styles.input, { flex: 1 }]}
                />
                <TextInput
                  placeholder="YYYY"
                  placeholderTextColor={COLORS.node.muted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={year}
                  onChangeText={setYear}
                  style={[styles.input, { flex: 2 }]}
                />
              </View>
            </View>

            <TextInput
              placeholder="Password (min. 8 characters)"
              placeholderTextColor={COLORS.node.muted}
              secureTextEntry
              value={formData.password}
              onChangeText={(t) => handleChange('password', t)}
              style={styles.input}
            />

            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor={COLORS.node.muted}
              secureTextEntry
              value={formData.confirmPassword}
              onChangeText={(t) => handleChange('confirmPassword', t)}
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
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={goToLogin}>
                <Text style={styles.linkText}>Sign in</Text>
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
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
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
  },
  form: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    color: COLORS.node.muted,
    fontSize: 12,
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: '600',
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
  inputSuccess: {
    borderColor: '#10B981',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    color: '#EF4444',
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
    shadowColor: COLORS.node.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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