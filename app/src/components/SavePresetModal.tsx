import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { api } from '../lib/api';

interface SavePresetModalProps {
    visible: boolean;
    onClose: () => void;
    currentConfig: any;
}

export const SavePresetModal: React.FC<SavePresetModalProps> = ({ visible, onClose, currentConfig }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a name');
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
            Alert.alert('Success', 'Preset saved!');
            onClose();
            setName('');
            setDescription('');
            setIsPublic(false);
        } catch (error) {
            console.error('Failed to save preset:', error);
            Alert.alert('Error', 'Failed to save preset');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Save Preset</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={COLORS.node.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Joy Mode"
                            placeholderTextColor={COLORS.node.muted}
                        />

                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="What does this algorithm do?"
                            placeholderTextColor={COLORS.node.muted}
                            multiline
                        />

                        <View style={styles.switchRow}>
                            <Text style={styles.label}>Public (Share to Marketplace)</Text>
                            <Switch
                                value={isPublic}
                                onValueChange={setIsPublic}
                                trackColor={{ false: COLORS.node.border, true: COLORS.node.accent }}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.saveButton}
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
        backgroundColor: COLORS.node.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
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
        color: COLORS.node.text,
    },
    form: {
        gap: 16,
    },
    label: {
        color: COLORS.node.text,
        fontWeight: '600',
        marginBottom: 4,
    },
    input: {
        backgroundColor: COLORS.node.panel,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        borderRadius: 8,
        padding: 12,
        color: COLORS.node.text,
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
        backgroundColor: COLORS.node.accent,
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
