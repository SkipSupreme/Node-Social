import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getFeedPreferences,
  updateFeedPreferences,
  type FeedPreference,
  type FeedPreferenceUpdate,
} from "../lib/api";

type FeedPreferencesScreenProps = {
  onBack: () => void;
};

type Preset = "latest" | "balanced" | "popular" | "expert" | "personal" | "custom";

export const FeedPreferencesScreen = ({ onBack }: FeedPreferencesScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<FeedPreference | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset>("balanced");
  const [customWeights, setCustomWeights] = useState({
    quality: 35,
    recency: 30,
    engagement: 20,
    personalization: 15,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getFeedPreferences();
      setPreferences(prefs);
      setSelectedPreset((prefs.presetMode as Preset) || "balanced");
      if (prefs.presetMode === "custom") {
        setCustomWeights({
          quality: prefs.qualityWeight,
          recency: prefs.recencyWeight,
          engagement: prefs.engagementWeight,
          personalization: prefs.personalizationWeight,
        });
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
      Alert.alert("Error", "Failed to load feed preferences");
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (preset: Preset) => {
    setSelectedPreset(preset);
    if (preset !== "custom") {
      // Update weights based on preset
      const presetWeights = {
        latest: { quality: 10, recency: 80, engagement: 5, personalization: 5 },
        balanced: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
        popular: { quality: 25, recency: 15, engagement: 50, personalization: 10 },
        expert: { quality: 60, recency: 5, engagement: 15, personalization: 20 },
        personal: { quality: 10, recency: 25, engagement: 5, personalization: 60 },
      };
      setCustomWeights(presetWeights[preset]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const update: FeedPreferenceUpdate = {
        preset: selectedPreset,
      };

      if (selectedPreset === "custom") {
        // Validate weights sum to 100
        const total =
          customWeights.quality +
          customWeights.recency +
          customWeights.engagement +
          customWeights.personalization;

        if (Math.abs(total - 100) > 0.01) {
          Alert.alert("Error", "Weights must sum to 100%");
          setSaving(false);
          return;
        }

        update.qualityWeight = customWeights.quality;
        update.recencyWeight = customWeights.recency;
        update.engagementWeight = customWeights.engagement;
        update.personalizationWeight = customWeights.personalization;
      }

      await updateFeedPreferences(update);
      Alert.alert("Success", "Feed preferences updated");
      onBack();
    } catch (error) {
      console.error("Failed to save preferences:", error);
      Alert.alert("Error", "Failed to save feed preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  const totalWeight =
    customWeights.quality +
    customWeights.recency +
    customWeights.engagement +
    customWeights.personalization;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feed Preferences</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Quick Presets</Text>
        <View style={styles.presetContainer}>
          {(["latest", "balanced", "popular", "expert", "personal", "custom"] as Preset[]).map(
            (preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetButton,
                  selectedPreset === preset && styles.presetButtonSelected,
                ]}
                onPress={() => handlePresetSelect(preset)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    selectedPreset === preset && styles.presetButtonTextSelected,
                  ]}
                >
                  {preset === "latest"
                    ? "Latest First"
                    : preset === "balanced"
                    ? "Balanced (recommended)"
                    : preset === "popular"
                    ? "Most Popular"
                    : preset === "expert"
                    ? "Expert Voices"
                    : preset === "personal"
                    ? "Personal Network"
                    : "Custom"}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {selectedPreset === "custom" && (
          <View style={styles.customSection}>
            <Text style={styles.sectionTitle}>Custom Weights</Text>
            <Text style={styles.totalText}>
              Total: {totalWeight.toFixed(1)}%{" "}
              {Math.abs(totalWeight - 100) > 0.01 && (
                <Text style={styles.errorText}>(Must equal 100%)</Text>
              )}
            </Text>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                Quality: {customWeights.quality.toFixed(0)}%
              </Text>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${customWeights.quality}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                Recency: {customWeights.recency.toFixed(0)}%
              </Text>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${customWeights.recency}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                Engagement: {customWeights.engagement.toFixed(0)}%
              </Text>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${customWeights.engagement}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                Personalization: {customWeights.personalization.toFixed(0)}%
              </Text>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${customWeights.personalization}%` },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.hintText}>
              Note: For full slider functionality, use the web interface. This shows current values.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centerLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  backButton: {
    width: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: "#2563EB",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 12,
    marginTop: 8,
  },
  presetContainer: {
    marginBottom: 24,
  },
  presetButton: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  presetButtonSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  presetButtonText: {
    fontSize: 16,
    color: "#1E293B",
  },
  presetButtonTextSelected: {
    color: "#2563EB",
    fontWeight: "600",
  },
  customSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  totalText: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1E293B",
    marginBottom: 8,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  sliderFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 4,
  },
  hintText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 8,
    fontStyle: "italic",
  },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

