// src/screens/RegisterScreen.tsx
import React, { useState, useEffect, useRef } from "react";
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
  useWindowDimensions,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, Check } from "lucide-react-native";
import { register, checkUsername } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { COLORS } from "../constants/theme";
import { AuthLogo } from "../components/ui/AuthLogo";
import { NodeNetworkBackground } from "../components/ui/NodeNetworkBackground";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export const RegisterScreen: React.FC<{ onSuccessLogin: () => void; goToLogin: () => void }> = ({
  onSuccessLogin,
  goToLogin,
}) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const { width } = useWindowDimensions();
  const isMobile = width < 480;

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });

  // Date state - using number for month for picker
  const [day, setDay] = useState("");
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState("");
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for auto-focus
  const monthRef = useRef<any>(null);
  const yearRef = useRef<TextInput>(null);

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

  // Auto-advance from day to month picker
  const handleDayChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    setDay(cleaned);

    // Auto-advance when 2 digits entered
    if (cleaned.length === 2) {
      setShowMonthPicker(true);
    }
  };

  // Auto-advance from year when complete
  const handleYearChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setYear(cleaned);
  };

  const onSubmit = async () => {
    setError(null);

    // Validation
    if (!formData.email || !formData.password || !formData.username || !formData.firstName || !formData.lastName || !day || month === null || !year) {
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
    const m = month;
    const y = parseInt(year);

    if (isNaN(d) || isNaN(y) || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > new Date().getFullYear()) {
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
      {/* Animated node network background */}
      <NodeNetworkBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Animated Logo with glow */}
          <View style={styles.logoContainer}>
            <AuthLogo size={48} />
          </View>

          <View style={styles.header}>
            <Text style={styles.brandName}>NODE</Text>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Join the network of the future</Text>
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

            {/* Date of Birth - Mobile-friendly layout */}
            <View>
              <Text style={styles.label}>Date of Birth</Text>
              <View style={[styles.dateRow, isMobile && styles.dateRowMobile]}>
                <View style={styles.dateField}>
                  <TextInput
                    placeholder="Day"
                    placeholderTextColor={COLORS.node.muted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={day}
                    onChangeText={handleDayChange}
                    style={[styles.input, styles.dateInput]}
                    returnKeyType="next"
                  />
                </View>

                {/* Month Picker Button */}
                <TouchableOpacity
                  style={[styles.dateField, styles.monthPickerButton]}
                  onPress={() => setShowMonthPicker(true)}
                  ref={monthRef}
                >
                  <Text style={[
                    styles.monthPickerText,
                    month === null && styles.monthPickerPlaceholder
                  ]}>
                    {month !== null ? MONTHS[month - 1].label : "Month"}
                  </Text>
                  <ChevronDown size={18} color={COLORS.node.muted} />
                </TouchableOpacity>

                <View style={styles.dateField}>
                  <TextInput
                    ref={yearRef}
                    placeholder="Year"
                    placeholderTextColor={COLORS.node.muted}
                    keyboardType="number-pad"
                    maxLength={4}
                    value={year}
                    onChangeText={handleYearChange}
                    style={[styles.input, styles.dateInput]}
                  />
                </View>
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

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
            </View>
            <FlatList
              data={MONTHS}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.monthOption,
                    month === item.value && styles.monthOptionSelected
                  ]}
                  onPress={() => {
                    setMonth(item.value);
                    setShowMonthPicker(false);
                    // Focus year input after selecting month
                    setTimeout(() => yearRef.current?.focus(), 100);
                  }}
                >
                  <Text style={[
                    styles.monthOptionText,
                    month === item.value && styles.monthOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {month === item.value && (
                    <Check size={20} color={COLORS.node.accent} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.monthList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 32,
    fontWeight: "800",
    color: '#ffffff',
    letterSpacing: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: COLORS.node.muted,
    fontSize: 13,
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: '500',
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
  // Date picker styles
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateRowMobile: {
    gap: 8,
  },
  dateField: {
    flex: 1,
    minWidth: 0,
  },
  dateInput: {
    textAlign: 'center',
  },
  monthPickerButton: {
    backgroundColor: COLORS.node.panel,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1.5,
  },
  monthPickerText: {
    fontSize: 16,
    color: COLORS.node.text,
    flex: 1,
  },
  monthPickerPlaceholder: {
    color: COLORS.node.muted,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    maxHeight: 400,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.node.text,
    textAlign: 'center',
  },
  monthList: {
    maxHeight: 340,
  },
  monthOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  monthOptionSelected: {
    backgroundColor: `${COLORS.node.accent}15`,
  },
  monthOptionText: {
    fontSize: 16,
    color: COLORS.node.text,
  },
  monthOptionTextSelected: {
    color: COLORS.node.accent,
    fontWeight: '600',
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