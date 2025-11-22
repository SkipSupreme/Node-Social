// Phase 0.4 - Vibe Validator Component (Web)
// Feed algorithm controls panel - reuse mobile logic

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  getFeedPreferences,
  updateFeedPreferences,
  type FeedPreference,
  type FeedPreferenceUpdate,
} from '../../../lib/api';

type Preset = 'latest' | 'balanced' | 'popular' | 'expert' | 'personal' | 'custom';

export const VibeValidator: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<FeedPreference | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset>('balanced');
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
      setSelectedPreset((prefs.presetMode as Preset) || 'balanced');
      if (prefs.presetMode === 'custom') {
        setCustomWeights({
          quality: prefs.qualityWeight,
          recency: prefs.recencyWeight,
          engagement: prefs.engagementWeight,
          personalization: prefs.personalizationWeight,
        });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (preset: Preset) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      const presetWeights = {
        latest: { quality: 10, recency: 80, engagement: 5, personalization: 5 },
        balanced: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
        popular: { quality: 25, recency: 15, engagement: 50, personalization: 10 },
        expert: { quality: 60, recency: 5, engagement: 15, personalization: 20 },
        personal: { quality: 10, recency: 25, engagement: 5, personalization: 60 },
      };
      setCustomWeights(presetWeights[preset]);
      handleSave(preset, presetWeights[preset]);
    }
  };

  const handleSave = async (preset?: Preset, weights?: typeof customWeights) => {
    setSaving(true);
    try {
      const update: FeedPreferenceUpdate = {
        preset: preset || selectedPreset,
      };

      const weightsToUse = weights || customWeights;
      if ((preset || selectedPreset) === 'custom') {
        const total =
          weightsToUse.quality +
          weightsToUse.recency +
          weightsToUse.engagement +
          weightsToUse.personalization;

        if (Math.abs(total - 100) > 0.01) {
          console.error('Weights must sum to 100%');
          setSaving(false);
          return;
        }

        update.qualityWeight = weightsToUse.quality;
        update.recencyWeight = weightsToUse.recency;
        update.engagementWeight = weightsToUse.engagement;
        update.personalizationWeight = weightsToUse.personalization;
      }

      await updateFeedPreferences(update);
      await loadPreferences(); // Reload to get updated preferences
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2563EB" />
      </View>
    );
  }

  const totalWeight =
    customWeights.quality +
    customWeights.recency +
    customWeights.engagement +
    customWeights.personalization;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Quick Presets</Text>
      <View style={styles.presetContainer}>
        {(['latest', 'balanced', 'popular', 'expert', 'personal', 'custom'] as Preset[]).map(
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
                {preset === 'latest'
                  ? 'Latest First'
                  : preset === 'balanced'
                  ? 'Balanced (recommended)'
                  : preset === 'popular'
                  ? 'Most Popular'
                  : preset === 'expert'
                  ? 'Expert Voices'
                  : preset === 'personal'
                  ? 'Personal Network'
                  : 'Custom'}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {selectedPreset === 'custom' && (
        <View style={styles.customSection}>
          <Text style={styles.sectionTitle}>Custom Weights</Text>
          <Text style={styles.totalText}>
            Total: {totalWeight.toFixed(1)}%
            {Math.abs(totalWeight - 100) > 0.01 && (
              <Text style={styles.errorText}> (Must equal 100%)</Text>
            )}
          </Text>

          {/* Web sliders would go here - for now showing current values */}
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Quality: {customWeights.quality.toFixed(0)}%</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${customWeights.quality}%` }]} />
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Recency: {customWeights.recency.toFixed(0)}%</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${customWeights.recency}%` }]} />
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>
              Engagement: {customWeights.engagement.toFixed(0)}%
            </Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${customWeights.engagement}%` }]} />
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>
              Personalization: {customWeights.personalization.toFixed(0)}%
            </Text>
            <View style={styles.sliderTrack}>
              <View
                style={[styles.sliderFill, { width: `${customWeights.personalization}%` }]}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => handleSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  presetContainer: {
    marginBottom: 16,
  },
  presetButton: {
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetButtonSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  presetButtonText: {
    fontSize: 13,
    color: '#1E293B',
  },
  presetButtonTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  customSection: {
    marginTop: 8,
  },
  totalText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  errorText: {
    color: '#EF4444',
  },
  sliderContainer: {
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 4,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

