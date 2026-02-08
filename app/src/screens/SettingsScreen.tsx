import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    ChevronRight,
    Palette,
    PenTool,
    User,
    Link2,
    Sliders,
    ShoppingBag,
    VolumeX,
    ShieldOff,
    LogOut,
} from 'lucide-react-native';
import { useAppTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/auth';
import { LinkedAccountsModal } from '../components/ui/LinkedAccountsModal';
import { EditProfileModal } from '../components/ui/EditProfileModal';
import { MutedWordsManager } from '../components/ui/MutedWordsManager';
import { PresetMarketplaceModal } from '../components/PresetMarketplaceModal';
import type { AuthResponse } from '../lib/api';

type User = AuthResponse['user'];

interface SettingsScreenProps {
    onBack: () => void;
    onNavigate: (screen: string) => void;
    user?: User;
    onUserUpdate?: (user: User) => void;
}

// Section header
const SectionHeader = ({ title, color }: { title: string; color: string }) => (
    <Text style={[styles.sectionHeader, { color }]}>{title}</Text>
);

// Single settings row
interface SettingsRowProps {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    trailing?: React.ReactNode;
    danger?: boolean;
    textColor: string;
    chevronColor: string;
    borderColor: string;
    panelColor: string;
}

const SettingsRow = ({ icon, label, onPress, trailing, danger, textColor, chevronColor, borderColor, panelColor }: SettingsRowProps) => (
    <Pressable
        onPress={onPress}
        style={({ pressed }) => [
            styles.row,
            { borderBottomColor: borderColor, backgroundColor: pressed ? borderColor : panelColor },
        ]}
    >
        <View style={styles.rowLeft}>
            {icon}
            <Text style={[styles.rowLabel, { color: danger ? '#ef4444' : textColor }]}>{label}</Text>
        </View>
        {trailing || <ChevronRight size={18} color={chevronColor} />}
    </Pressable>
);

export const SettingsScreen = ({ onBack, onNavigate, user, onUserUpdate }: SettingsScreenProps) => {
    const theme = useAppTheme();
    const { logout } = useAuthStore();

    // Modal state
    const [linkedAccountsVisible, setLinkedAccountsVisible] = useState(false);
    const [editProfileVisible, setEditProfileVisible] = useState(false);
    const [mutedWordsVisible, setMutedWordsVisible] = useState(false);
    const [presetMarketVisible, setPresetMarketVisible] = useState(false);

    const handleSignOut = () => {
        const doLogout = async () => {
            await logout();
        };
        if (Platform.OS === 'web') {
            if (window.confirm?.('Are you sure you want to sign out?')) {
                doLogout();
            }
        } else {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: doLogout },
            ]);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.panel }]}>
                <Pressable onPress={onBack} style={[styles.backButton, { backgroundColor: theme.bg }]}>
                    <ArrowLeft color={theme.text} size={22} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* ── Customization ─────────────────────── */}
                <SectionHeader title="Customization" color={theme.muted} />
                <View style={[styles.sectionCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                    <SettingsRow
                        icon={<Palette size={20} color={theme.accent} />}
                        label="Theme Marketplace"
                        onPress={() => onNavigate('themes')}
                        textColor={theme.text}
                        chevronColor={theme.muted}
                        borderColor={theme.border}
                        panelColor={theme.panel}
                    />
                    <SettingsRow
                        icon={<PenTool size={20} color={theme.accent} />}
                        label="Theme Editor"
                        onPress={() => onNavigate('theme-editor')}
                        textColor={theme.text}
                        chevronColor={theme.muted}
                        borderColor={theme.border}
                        panelColor={theme.panel}
                    />
                    <SettingsRow
                        icon={<User size={20} color={theme.accent} />}
                        label="Edit Profile"
                        onPress={() => setEditProfileVisible(true)}
                        textColor={theme.text}
                        chevronColor={theme.muted}
                        borderColor={theme.border}
                        panelColor={theme.panel}
                    />
                </View>

                {/* ── Connected Accounts ────────────────── */}
                <SectionHeader title="Connected Accounts" color={theme.muted} />
                <View style={[styles.sectionCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                    <SettingsRow
                        icon={<Link2 size={20} color={theme.accent} />}
                        label="Bluesky & Mastodon"
                        onPress={() => setLinkedAccountsVisible(true)}
                        textColor={theme.text}
                        chevronColor={theme.muted}
                        borderColor={theme.border}
                        panelColor={theme.panel}
                    />
                </View>

                {/* ── Feed Profiles ─────────────────────── */}
                <SectionHeader title="Feed Profiles" color={theme.muted} />
                <View style={[styles.sectionCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                    <SettingsRow
                        icon={<Sliders size={20} color={theme.accent} />}
                        label="Vibe Validator Presets"
                        onPress={() => setPresetMarketVisible(true)}
                        textColor={theme.text}
                        chevronColor={theme.muted}
                        borderColor={theme.border}
                        panelColor={theme.panel}
                    />
                </View>

                {/* ── Content & Privacy ─────────────────── */}
                <SectionHeader title="Content & Privacy" color={theme.muted} />
                <View style={[styles.sectionCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                    <SettingsRow
                        icon={<VolumeX size={20} color={theme.accent} />}
                        label="Muted Words"
                        onPress={() => setMutedWordsVisible(true)}
                        textColor={theme.text}
                        chevronColor={theme.muted}
                        borderColor={theme.border}
                        panelColor={theme.panel}
                    />
                    <SettingsRow
                        icon={<ShieldOff size={20} color={theme.accent} />}
                        label="Blocked Users"
                        onPress={() => onNavigate('blocked-muted')}
                        textColor={theme.text}
                        chevronColor={theme.muted}
                        borderColor={theme.border}
                        panelColor={theme.panel}
                    />
                </View>

                {/* ── Account ──────────────────────────── */}
                <SectionHeader title="Account" color={theme.muted} />
                <View style={[styles.sectionCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                    <SettingsRow
                        icon={<LogOut size={20} color="#ef4444" />}
                        label="Sign Out"
                        onPress={handleSignOut}
                        danger
                        trailing={null}
                        textColor={theme.text}
                        chevronColor={theme.muted}
                        borderColor={theme.border}
                        panelColor={theme.panel}
                    />
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── Modals ──────────────────────────────── */}
            <LinkedAccountsModal
                visible={linkedAccountsVisible}
                onClose={() => setLinkedAccountsVisible(false)}
            />

            <EditProfileModal
                visible={editProfileVisible}
                onClose={() => setEditProfileVisible(false)}
                onSuccess={(updatedUser) => {
                    if (onUserUpdate) onUserUpdate(updatedUser);
                    setEditProfileVisible(false);
                }}
                currentAvatar={user?.avatar}
                username={user?.username || 'user'}
            />

            <MutedWordsManager
                visible={mutedWordsVisible}
                onClose={() => setMutedWordsVisible(false)}
            />

            <PresetMarketplaceModal
                visible={presetMarketVisible}
                onClose={() => setPresetMarketVisible(false)}
                onInstall={() => setPresetMarketVisible(false)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 8,
        paddingHorizontal: 4,
    },
    sectionCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    rowLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
});
