import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { showAlert } from '../lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useTheme';
import { api } from '../lib/api';
import type { VibeValidatorSettings } from './ui/VibeValidator';

interface SavePresetModalProps {
    visible: boolean;
    onClose: () => void;
    currentConfig: VibeValidatorSettings;
}

export const SavePresetModal: React.FC<SavePresetModalProps> = ({ visible, onClose, currentConfig }) => {
    const theme = useAppTheme();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) {
            showAlert('Error', 'Please enter a name');
            return;
        }

        setSaving(true);
        try {
            await api.post('/presets', {
                name,
                description,
                isPublic,
                config: currentConfig,
            });
            showAlert('Success', 'Preset saved!');
            onClose();
            setName('');
            setDescription('');
            setIsPublic(false);
        } catch (error) {
            console.error('Failed to save preset:', error);
            showAlert('Error', 'Failed to save preset');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.text }]}>Save Preset</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        <Text style={[styles.label, { color: theme.text }]}>Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Joy Mode"
                            placeholderTextColor={theme.muted}
                        />

                        <Text style={[styles.label, { color: theme.text }]}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { backgroundColor: theme.panel, borderColor: theme.border, color: theme.text }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="What does this algorithm do?"
                            placeholderTextColor={theme.muted}
                            multiline
                        />

                        <View style={styles.switchRow}>
                            <Text style={[styles.label, { color: theme.text }]}>Public (Share to Marketplace)</Text>
                            <Switch
                                value={isPublic}
                                onValueChange={setIsPublic}
                                trackColor={{ false: theme.border, true: theme.accent }}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.accent }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveText}>Save Preset</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    form: {
        gap: 16,
    },
    label: {
        fontWeight: '600',
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 8,
    },
    saveButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    saveText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
