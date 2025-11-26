import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';
import { api } from '../lib/api';

export default function VibeValidatorExpert({ nodeId }: { nodeId: string }) {
    const theme = {
        colors: {
            background: COLORS.node.bg,
            card: COLORS.node.panel,
            text: COLORS.node.text,
            textSecondary: COLORS.node.muted,
            border: COLORS.node.border,
            primary: COLORS.node.accent,
        }
    };

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [expertConfigJson, setExpertConfigJson] = useState('{}');
    const [suppressionRulesJson, setSuppressionRulesJson] = useState('[]');
    const [boostRulesJson, setBoostRulesJson] = useState('[]');

    useEffect(() => {
        fetchConfig();
    }, [nodeId]);

    const fetchConfig = async () => {
        try {
            const response = await api.get<{ expertConfig: any, suppressionRules: any[], boostRules: any[] }>(`/expert/config?nodeId=${nodeId}`);
            setExpertConfigJson(JSON.stringify(response.expertConfig || {}, null, 2));
            setSuppressionRulesJson(JSON.stringify(response.suppressionRules || [], null, 2));
            setBoostRulesJson(JSON.stringify(response.boostRules || [], null, 2));
        } catch (error) {
            console.error('Failed to fetch expert config:', error);
            Alert.alert('Error', 'Failed to fetch configuration');
        } finally {
            setLoading(false);
        }
    };

    const validateAndSave = async () => {
        setSaving(true);
        try {
            // 1. Validate JSON
            let expertConfig, suppressionRules, boostRules;
            try {
                expertConfig = JSON.parse(expertConfigJson);
                suppressionRules = JSON.parse(suppressionRulesJson);
                boostRules = JSON.parse(boostRulesJson);
            } catch (e) {
                Alert.alert('Validation Error', 'Invalid JSON format. Please check your syntax.');
                setSaving(false);
                return;
            }

            // 2. Save Config
            await api.put('/expert/config', {
                nodeId,
                expertConfig
            });

            // 3. Save Rules
            await api.put('/expert/rules', {
                nodeId,
                type: 'suppression',
                rules: suppressionRules
            });

            await api.put('/expert/rules', {
                nodeId,
                type: 'boost',
                rules: boostRules
            });

            Alert.alert('Success', 'Configuration saved successfully!');
        } catch (error) {
            console.error('Failed to save config:', error);
            Alert.alert('Error', 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <ActivityIndicator size="large" color={theme.colors.primary} />;
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Expert Mode</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    WARNING: Advanced configuration. Invalid values may break the feed.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Global Config (JSON)</Text>
                <TextInput
                    style={[styles.editor, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    multiline
                    value={expertConfigJson}
                    onChangeText={setExpertConfigJson}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Suppression Rules (JSON)</Text>
                <TextInput
                    style={[styles.editor, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    multiline
                    value={suppressionRulesJson}
                    onChangeText={setSuppressionRulesJson}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Boost Rules (JSON)</Text>
                <TextInput
                    style={[styles.editor, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    multiline
                    value={boostRulesJson}
                    onChangeText={setBoostRulesJson}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: saving ? 0.7 : 1 }]}
                onPress={validateAndSave}
                disabled={saving}
            >
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Configuration'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: 'red',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    editor: {
        fontFamily: 'monospace',
        fontSize: 14,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        minHeight: 150,
        textAlignVertical: 'top',
    },
    saveButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
