import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Share,
    useWindowDimensions,
} from 'react-native';
import { showAlert } from '../lib/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/auth';
import { updateProfile, getUserStats, api, uploadBanner, followUser, type UserStats } from '../lib/api';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, ERAS, TYPOGRAPHY, SPACING, BREAKPOINTS } from '../constants/theme';
import { EditProfileModal } from '../components/ui/EditProfileModal';
import * as ImagePicker from 'expo-image-picker';

// Profile components
import {
    ProfileHero,
    calculateEra,
    BannerEditor,
    ProfileContent,
    EraSelector,
} from '../components/profile';

interface ProfileScreenProps {
    onBack: () => void;
    user?: any;
    userId?: string;
    isEditable?: boolean;
    onCredClick?: () => void;
    onViewTrustGraph?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
    onBack,
    user: propUser,
    userId,
    isEditable = false,
    onCredClick,
    onViewTrustGraph,
}) => {
    const { user: authUser, updateUser, logout } = useAuthStore();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    // Responsive breakpoints
    const isTablet = width >= BREAKPOINTS.tablet;
    const isDesktop = width >= BREAKPOINTS.desktop;
    const mobileHeaderOffset = isDesktop ? 0 : 64;

    // State
    const [fetchedUser, setFetchedUser] = useState<any>(null);
    const [loadingUser, setLoadingUser] = useState(!!userId);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [showBannerEditor, setShowBannerEditor] = useState(false);
    const [savingBanner, setSavingBanner] = useState(false);
    const [showEraSelector, setShowEraSelector] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    // Fetch user if userId is provided
    useEffect(() => {
        const fetchUser = async () => {
            if (userId && userId !== authUser?.id) {
                setLoadingUser(true);
                try {
                    const userData = await api.get<any>(`/users/${userId}`);
                    setFetchedUser(userData);
                    setIsFollowing(userData.isFollowing || false);
                } catch (error) {
                    console.error('Failed to fetch user:', error);
                } finally {
                    setLoadingUser(false);
                }
            } else {
                setLoadingUser(false);
            }
        };
        fetchUser();
    }, [userId, authUser?.id]);

    const user = propUser || fetchedUser || ((!userId || userId === authUser?.id) ? authUser : null);
    const canEdit = isEditable || (authUser && user && authUser.id === user.id);

    // Fetch user stats for hero
    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.id) return;
            try {
                const stats = await getUserStats(user.id);
                setUserStats(stats);
            } catch (error) {
                console.error('Failed to fetch user stats:', error);
            }
        };
        fetchStats();
    }, [user?.id]);

    // Handlers
    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out @${user?.username} on Node Social!`,
                url: `https://nodesocial.app/u/${user?.username}`,
            });
        } catch (error) {
            console.error('Share failed:', error);
        }
    };

    const handleBannerColorSelect = async (color: string) => {
        setSavingBanner(true);
        try {
            const result = await updateProfile({ bannerColor: color, bannerImage: '' });
            updateUser(result.user);
        } catch (err) {
            console.error('Failed to update banner:', err);
        } finally {
            setSavingBanner(false);
            setShowBannerEditor(false);
        }
    };

    const handleBannerUpload = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                showAlert('Permission Required', 'Please allow access to your photos to upload a banner.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setSavingBanner(true);
                try {
                    const uploadResult = await uploadBanner(result.assets[0].uri);
                    updateUser(uploadResult.user);
                    setShowBannerEditor(false);
                } catch (err: any) {
                    console.error('Banner upload failed:', err);
                    showAlert('Upload Failed', err.message || 'Failed to upload banner');
                } finally {
                    setSavingBanner(false);
                }
            }
        } catch (err) {
            console.error('Image picker error:', err);
        }
    };

    const handleRemoveBanner = async () => {
        setSavingBanner(true);
        try {
            const result = await updateProfile({ bannerImage: '' });
            updateUser(result.user);
            setShowBannerEditor(false);
        } catch (err) {
            console.error('Failed to remove banner:', err);
        } finally {
            setSavingBanner(false);
        }
    };

    const handleSignOut = () => {
        logout();
    };

    const handleFollow = async () => {
        if (!user?.id || followLoading) return;
        setFollowLoading(true);
        try {
            const result = await followUser(user.id);
            setIsFollowing(result.following);
        } catch (error) {
            console.error('Failed to toggle follow:', error);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleSaveBio = async (bio: string) => {
        try {
            const result = await updateProfile({ bio });
            updateUser(result.user);
        } catch (error) {
            console.error('Failed to update bio:', error);
        }
    };

    const handleSaveMeta = async (location: string, website: string) => {
        try {
            const result = await updateProfile({ location, website });
            updateUser(result.user);
        } catch (error) {
            console.error('Failed to update meta:', error);
        }
    };

    // Loading state
    if (loadingUser) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right']}>
                <View style={[styles.loadingContainer, { marginTop: mobileHeaderOffset }]}>
                    <View style={styles.loadingHeader}>
                        <TouchableOpacity onPress={onBack} style={styles.loadingBackButton}>
                            <ArrowLeft color={COLORS.node.text} size={24} />
                        </TouchableOpacity>
                        <Text style={styles.loadingTitle}>Profile</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.loadingContent}>
                        <ActivityIndicator color={COLORS.node.accent} size="large" />
                        <Text style={styles.loadingText}>Loading profile...</Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    if (!user) return null;

    // Use user's chosen era if set, otherwise calculate from account age
    const userEra = user.era || calculateEra(user.createdAt);
    const eraStyle = ERAS[userEra] || ERAS['Default'];

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right']}>
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: mobileHeaderOffset },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Hero - Banner + Identity */}
                <ProfileHero
                    user={{
                        ...user,
                        isFollowing,
                        followingCount: userStats?.followingCount || 0,
                        followersCount: userStats?.followersCount || 0,
                        vouchesReceived: userStats?.vouchesReceived || 0,
                        totalVouchStake: userStats?.totalVouchStake || 0,
                    }}
                    era={userEra}
                    canEdit={canEdit}
                    onBack={onBack}
                    onEditAvatar={() => setEditModalVisible(true)}
                    onEditBanner={() => setShowBannerEditor(!showBannerEditor)}
                    onFollow={authUser?.id !== user.id ? handleFollow : undefined}
                    onSaveBio={canEdit ? handleSaveBio : undefined}
                    onSaveMeta={canEdit ? handleSaveMeta : undefined}
                    isFollowLoading={followLoading}
                    isOwnProfile={authUser?.id === user.id}
                    showBannerEditor={showBannerEditor}
                    onToggleBannerEditor={() => setShowBannerEditor(!showBannerEditor)}
                    bannerEditorContent={
                        <BannerEditor
                            currentColor={user.bannerColor}
                            hasBannerImage={!!user.bannerImage}
                            saving={savingBanner}
                            onSelectColor={handleBannerColorSelect}
                            onUploadImage={handleBannerUpload}
                            onRemoveImage={handleRemoveBanner}
                            onClose={() => setShowBannerEditor(false)}
                        />
                    }
                />

                {/* Content Tabs */}
                <ProfileContent
                    userId={user.id}
                    eraStyle={eraStyle}
                />

                {/* Bottom spacing for mobile nav */}
                <View style={{ height: isDesktop ? SPACING.xxxl : 120 }} />
            </ScrollView>

            {/* Edit Profile Modal */}
            <EditProfileModal
                visible={editModalVisible}
                onClose={() => setEditModalVisible(false)}
                onSuccess={(updatedUser) => {
                    updateUser(updatedUser);
                    setEditModalVisible(false);
                }}
                currentAvatar={user.avatar}
                username={user.username || 'user'}
            />

            {/* Era Selector Modal */}
            <EraSelector
                visible={showEraSelector}
                currentEra={user.era || userEra}
                onClose={() => setShowEraSelector(false)}
                onEraChange={(newEra) => {
                    // Update local user state with new era
                    if (updateUser) {
                        updateUser({ ...user, era: newEra });
                    }
                    // Also update auth store if it's the current user
                    if (authUser?.id === user.id) {
                        useAuthStore.setState((state) => ({
                            user: state.user ? { ...state.user, era: newEra } : null
                        }));
                    }
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.node.bg,
    },
    scrollContent: {
        flexGrow: 1,
    },
    // Loading state
    loadingContainer: {
        flex: 1,
    },
    loadingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    loadingBackButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.node.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingTitle: {
        fontSize: TYPOGRAPHY.sizes.h4,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    loadingContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.md,
    },
    loadingText: {
        fontSize: TYPOGRAPHY.sizes.body,
        color: COLORS.node.muted,
    },
});

export default ProfileScreen;
