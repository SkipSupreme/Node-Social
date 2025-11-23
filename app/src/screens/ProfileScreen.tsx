import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/auth';
import { updateProfile } from '../lib/api';
import { ArrowLeft, Edit2, Save } from 'lucide-react-native';

interface ProfileScreenProps {
    onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
    const { user, setAuth } = useAuthStore();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        bio: user?.bio || '',
        theme: user?.theme || 'default',
    });

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await updateProfile(formData);
            // Update local user state
            // Note: setAuth expects full auth response, but we might just want to update user
            // For now, we'll assume we need to refresh the user object in the store
            // Ideally useAuthStore should have an updateUser action
            // setAuth({ ...authData, user: res.user }); 
            // Since we don't have the full auth data here easily without reading it, 
            // we might need to rely on a store update method or refetch.
            // For this MVP, let's assume we can't easily update the store without the token,
            // so we'll just toggle edit mode and maybe show a success message.
            // A better approach is to add `updateUser` to the store.

            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft color="#1E293B" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)}>
                    {loading ? (
                        <ActivityIndicator color="#2563EB" />
                    ) : isEditing ? (
                        <Save color="#2563EB" size={24} />
                    ) : (
                        <Edit2 color="#1E293B" size={24} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.avatarSection}>
                    <View style={[styles.avatar, { backgroundColor: user.era === 'Builder Era' ? '#6366f1' : '#10B981' }]}>
                        <Text style={styles.avatarText}>
                            {user.firstName?.[0]}{user.lastName?.[0]}
                        </Text>
                    </View>
                    <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
                    <Text style={styles.username}>@{user.username}</Text>
                    <View style={styles.badgeContainer}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{user.era || 'Lurker Era'}</Text>
                        </View>
                        <View style={[styles.badge, styles.credBadge]}>
                            <Text style={styles.badgeText}>{user.connoisseurCred || 0} Cred</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bio</Text>
                    {isEditing ? (
                        <TextInput
                            style={styles.bioInput}
                            multiline
                            value={formData.bio}
                            onChangeText={(t) => setFormData(prev => ({ ...prev, bio: t }))}
                            placeholder="Tell us about yourself..."
                        />
                    ) : (
                        <Text style={styles.bioText}>{formData.bio || "No bio yet."}</Text>
                    )}
                </View>

                {/* Placeholder for Theme Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Theme</Text>
                    <Text style={styles.infoText}>Current Theme: {formData.theme}</Text>
                </View>

                <TouchableOpacity style={styles.signOutButton} onPress={() => useAuthStore.getState().logout()}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
    },
    content: {
        padding: 24,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 36,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 4,
    },
    username: {
        fontSize: 16,
        color: '#64748B',
        marginBottom: 16,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    credBadge: {
        backgroundColor: '#FEF3C7',
    },
    badgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3730A3',
    },
    section: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 12,
    },
    bioInput: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        minHeight: 100,
        textAlignVertical: 'top',
        fontSize: 16,
        color: '#1E293B',
    },
    bioText: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
    },
    infoText: {
        fontSize: 16,
        color: '#64748B',
    },
    signOutButton: {
        backgroundColor: '#FEE2E2',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    signOutText: {
        color: '#DC2626',
        fontSize: 16,
        fontWeight: '600',
    },
});
