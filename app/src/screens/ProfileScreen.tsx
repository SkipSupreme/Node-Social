import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/auth';
import { updateProfile } from '../lib/api';
import { ArrowLeft, Edit2, Save, Check } from 'lucide-react-native';
import { ERAS, COLORS } from '../constants/theme';

const THEMES = [
    { id: 'default', name: 'Node Social', color: '#6366f1' },
    { id: 'dark', name: 'Midnight', color: '#0f172a' },
    { id: 'light', name: 'Daylight', color: '#f8fafc' },
    { id: 'ocean', name: 'Oceanic', color: '#0ea5e9' },
];

interface ProfileScreenProps {
    onBack: () => void;
    user?: any; // Optional user prop for viewing other profiles
    isEditable?: boolean; // Whether the profile can be edited
    onCredClick?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, user: propUser, isEditable = false, onCredClick }) => {
    const { user: authUser, updateUser } = useAuthStore();

    // If propUser is provided, view that user. Otherwise view authUser.
    const user = propUser || authUser;
    const canEdit = isEditable || (authUser && user && authUser.id === user.id);

    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        bio: user?.bio || '',
        theme: user?.theme || 'default',
        era: user?.era || 'Lurker Era',
        avatar: user?.avatar || '',
        customCss: user?.customCss || '',
    });

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await updateProfile(formData);
            if (res.user) {
                await updateUser(res.user);
            }
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
                    <ArrowLeft color={COLORS.node.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                {canEdit && (
                    <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)}>
                        {loading ? (
                            <ActivityIndicator color={COLORS.node.accent} />
                        ) : isEditing ? (
                            <Save color={COLORS.node.accent} size={24} />
                        ) : (
                            <Edit2 color={COLORS.node.text} size={24} />
                        )}
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.avatarSection}>
                    {/* Avatar Display/Edit */}
                    {isEditing ? (
                        <View style={{ alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <TouchableOpacity
                                onPress={() => setFormData(prev => ({ ...prev, avatar: `https://picsum.photos/seed/${Math.random()}/200` }))}
                            >
                                {formData.avatar ? (
                                    <Image source={{ uri: formData.avatar }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, { backgroundColor: user.era === 'Builder Era' ? '#6366f1' : '#10B981' }]}>
                                        <Text style={styles.avatarText}>
                                            {user.firstName?.[0]}{user.lastName?.[0]}
                                        </Text>
                                    </View>
                                )}
                                <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563EB', padding: 8, borderRadius: 20 }}>
                                    <Edit2 size={16} color="#fff" />
                                </View>
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.bioInput, { minHeight: 40, height: 40, width: '100%' }]}
                                placeholder="Avatar URL"
                                value={formData.avatar}
                                onChangeText={(t) => setFormData(prev => ({ ...prev, avatar: t }))}
                            />
                        </View>
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: user.era === 'Builder Era' ? '#6366f1' : '#10B981', overflow: 'hidden' }]}>
                            {user.avatar ? (
                                <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {user.firstName?.[0]}{user.lastName?.[0]}
                                </Text>
                            )}
                        </View>
                    )}

                    <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
                    <Text style={styles.username}>@{user.username}</Text>
                    <View style={styles.badgeContainer}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{user.era || 'Lurker Era'}</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.badge, styles.credBadge]}
                            onPress={onCredClick}
                            disabled={!onCredClick}
                        >
                            <Text style={styles.badgeText}>{user.connoisseurCred || 0} Cred</Text>
                        </TouchableOpacity>
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

                {/* Custom CSS Section */}
                {canEdit && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Custom CSS</Text>
                        {isEditing ? (
                            <TextInput
                                style={[styles.bioInput, { fontFamily: 'monospace', fontSize: 12, minHeight: 150 }]}
                                multiline
                                value={formData.customCss}
                                onChangeText={(t) => setFormData(prev => ({ ...prev, customCss: t }))}
                                placeholder=".profile-card { background: pink; }"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        ) : (
                            <View style={{ backgroundColor: '#1e293b', padding: 12, borderRadius: 8 }}>
                                <Text style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12 }}>
                                    {formData.customCss || "/* No custom CSS */"}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Era Selection */}
                {canEdit && isEditing && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Current Era</Text>
                        <View style={styles.themeGrid}>
                            {Object.keys(ERAS).filter(e => e !== 'Default').map(era => {
                                const style = ERAS[era];
                                return (
                                    <TouchableOpacity
                                        key={era}
                                        style={[
                                            styles.themeOption,
                                            formData.era === era && styles.themeOptionSelected,
                                            { backgroundColor: style.bg, borderColor: style.border }
                                        ]}
                                        onPress={() => setFormData(prev => ({ ...prev, era }))}
                                    >
                                        <Text style={[styles.themeName, { color: style.text }]}>{era}</Text>
                                        {formData.era === era && (
                                            <View style={styles.checkIcon}>
                                                <Check size={16} color={style.text} />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Theme Selection */}
                {canEdit && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Theme</Text>
                        {isEditing ? (
                            <View style={styles.themeGrid}>
                                {THEMES.map(theme => (
                                    <TouchableOpacity
                                        key={theme.id}
                                        style={[
                                            styles.themeOption,
                                            formData.theme === theme.id && styles.themeOptionSelected
                                        ]}
                                        onPress={() => setFormData(prev => ({ ...prev, theme: theme.id }))}
                                    >
                                        <View style={[styles.themePreview, { backgroundColor: theme.color }]} />
                                        <Text style={styles.themeName}>{theme.name}</Text>
                                        {formData.theme === theme.id && (
                                            <View style={styles.checkIcon}>
                                                <Check size={16} color="#2563EB" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.themeDisplay}>
                                <View style={[styles.themePreview, { backgroundColor: THEMES.find(t => t.id === (user.theme || 'default'))?.color || '#6366f1' }]} />
                                <Text style={styles.themeName}>{THEMES.find(t => t.id === (user.theme || 'default'))?.name || 'Node Social'}</Text>
                            </View>
                        )}
                    </View>
                )}

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
        backgroundColor: COLORS.node.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
        backgroundColor: COLORS.node.bg,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.node.text,
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
        borderWidth: 2,
        borderColor: COLORS.node.border,
    },
    avatarText: {
        fontSize: 36,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.node.text,
        marginBottom: 4,
    },
    username: {
        fontSize: 16,
        color: COLORS.node.muted,
        marginBottom: 16,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        backgroundColor: COLORS.node.panel,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    credBadge: {
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderColor: 'rgba(251, 191, 36, 0.2)',
    },
    badgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    section: {
        backgroundColor: COLORS.node.panel,
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
        marginBottom: 12,
    },
    bioInput: {
        borderWidth: 1,
        borderColor: COLORS.node.border,
        borderRadius: 8,
        padding: 12,
        minHeight: 100,
        textAlignVertical: 'top',
        fontSize: 16,
        color: COLORS.node.text,
        backgroundColor: COLORS.node.bg,
    },
    bioText: {
        fontSize: 16,
        color: COLORS.node.muted,
        lineHeight: 24,
    },
    infoText: {
        fontSize: 16,
        color: COLORS.node.muted,
    },
    signOutButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    signOutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
    themeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    themeOption: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        gap: 12,
        position: 'relative',
        backgroundColor: COLORS.node.bg,
    },
    themeOptionSelected: {
        borderColor: COLORS.node.accent,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    themePreview: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    themeName: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.node.text,
    },
    checkIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    themeDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        backgroundColor: COLORS.node.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
});
