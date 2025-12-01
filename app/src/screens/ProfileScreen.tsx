import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Image, Share, Dimensions, Platform, useWindowDimensions } from 'react-native';
import { showAlert } from '../lib/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/auth';
import { updateProfile, getUserCredHistory, getUserPosts, api, uploadBanner } from '../lib/api';
import { ArrowLeft, Edit2, Share2, ChevronRight, Hexagon, Award, Users, TrendingUp, Clock, MessageSquare, Heart, Camera, ImageIcon, Upload, X } from 'lucide-react-native';
import { ERAS, COLORS } from '../constants/theme';
import { VouchSection } from '../components/ui/VouchSection';
import { EditProfileModal } from '../components/ui/EditProfileModal';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Calculate Era based on account age
const calculateEra = (createdAt: string): string => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 7) return 'Newborn Era';
    if (diffDays < 30) return 'Explorer Era';
    if (diffDays < 90) return 'Settler Era';
    if (diffDays < 180) return 'Citizen Era';
    if (diffDays < 365) return 'Veteran Era';
    if (diffDays < 730) return 'Elder Era';
    return 'Legend Era';
};

// Banner color presets
const BANNER_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#1e293b', // Slate dark
];

interface CredBreakdown {
    nodeId: string;
    nodeName: string;
    nodeSlug: string;
    cred: number;
}

interface RecentActivity {
    id: string;
    type: 'post' | 'comment' | 'reaction';
    title: string;
    timestamp: string;
    node?: string;
}

interface ProfileScreenProps {
    onBack: () => void;
    user?: any;
    userId?: string; // For viewing other users' profiles
    isEditable?: boolean;
    onCredClick?: () => void;
    onViewTrustGraph?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, user: propUser, userId, isEditable = false, onCredClick, onViewTrustGraph }) => {
    const { user: authUser, updateUser } = useAuthStore();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024; // Match App.tsx breakpoint
    // On mobile/tablet, App.tsx has a 64px header that covers the top of content
    const mobileHeaderOffset = isDesktop ? 0 : 64;
    const [fetchedUser, setFetchedUser] = useState<any>(null);
    const [loadingUser, setLoadingUser] = useState(!!userId);

    // Fetch user if userId is provided and different from auth user
    useEffect(() => {
        const fetchUser = async () => {
            if (userId && userId !== authUser?.id) {
                setLoadingUser(true);
                try {
                    const userData = await api.get<any>(`/users/${userId}`);
                    setFetchedUser(userData);
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

    const [loading, setLoading] = useState(false);
    const [credBreakdown, setCredBreakdown] = useState<CredBreakdown[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [showBannerEditor, setShowBannerEditor] = useState(false);
    const [savingBanner, setSavingBanner] = useState(false);

    // Fetch user's cred breakdown by node and recent activity
    useEffect(() => {
        const fetchProfileData = async () => {
            if (!user?.id) return;
            setLoadingData(true);
            try {
                // Fetch cred history to get breakdown by node
                const credHistory = await getUserCredHistory(user.id);

                // Aggregate cred by node
                const nodeCredMap = new Map<string, { nodeName: string; nodeSlug: string; cred: number }>();
                credHistory.forEach((entry: any) => {
                    if (entry.node) {
                        const existing = nodeCredMap.get(entry.node.id) || {
                            nodeName: entry.node.name,
                            nodeSlug: entry.node.slug,
                            cred: 0
                        };
                        existing.cred += entry.amount;
                        nodeCredMap.set(entry.node.id, existing);
                    }
                });

                const breakdown: CredBreakdown[] = Array.from(nodeCredMap.entries())
                    .map(([nodeId, data]) => ({
                        nodeId,
                        nodeName: data.nodeName,
                        nodeSlug: data.nodeSlug,
                        cred: data.cred
                    }))
                    .sort((a, b) => b.cred - a.cred)
                    .slice(0, 5); // Top 5 nodes

                setCredBreakdown(breakdown);

                // Fetch recent posts for activity
                const posts = await getUserPosts(user.id, 5);
                const activities: RecentActivity[] = posts.map((p: any) => ({
                    id: p.id,
                    type: 'post' as const,
                    title: p.title,
                    timestamp: p.createdAt,
                    node: p.node?.name
                }));
                setRecentActivity(activities);

            } catch (error) {
                console.error('Failed to fetch profile data:', error);
            } finally {
                setLoadingData(false);
            }
        };

        fetchProfileData();
    }, [user?.id]);

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

    const timeAgo = (date: string) => {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now.getTime() - past.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffDay > 7) return past.toLocaleDateString();
        if (diffDay > 0) return `${diffDay}d ago`;
        if (diffHour > 0) return `${diffHour}h ago`;
        if (diffMin > 0) return `${diffMin}m ago`;
        return 'Just now';
    };

    // Loading state for fetching other user's profile
    if (loadingUser) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right']}>
                <View style={[styles.loadingHeader, { marginTop: mobileHeaderOffset }]}>
                    <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: COLORS.node.border }]}>
                        <ArrowLeft color={COLORS.node.text} size={24} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: COLORS.node.text }]}>Profile</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={COLORS.node.accent} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    if (!user) return null;

    const totalCred = user.cred || 0;
    const maxNodeCred = credBreakdown.length > 0 ? Math.max(...credBreakdown.map(n => n.cred)) : 1;

    // Calculate Era from account age
    const userEra = calculateEra(user.createdAt);
    const eraStyle = ERAS[userEra] || ERAS['Default'];

    // Banner color (default to accent color)
    const bannerColor = user.bannerColor || COLORS.node.accent;
    const bannerImage = user.bannerImage;

    const handleBannerColorSelect = async (color: string) => {
        setSavingBanner(true);
        try {
            // Clear banner image when selecting a color
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
                aspect: [3, 1], // Wide banner aspect ratio
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setSavingBanner(true);
                try {
                    const uploadResult = await uploadBanner(result.assets[0].uri);
                    console.log('📸 Banner upload result:', { success: uploadResult.success, url: uploadResult.url });
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

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right']}>
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: mobileHeaderOffset }]}>
                {/* Profile Banner with overlaid header */}
                <View style={styles.bannerSection}>
                    {/* Banner Image/Color */}
                    {bannerImage ? (
                        <Image
                            key={bannerImage}
                            source={{ uri: bannerImage, cache: 'reload' }}
                            style={styles.bannerImage}
                        />
                    ) : (
                        <View style={[styles.banner, { backgroundColor: bannerColor }]} />
                    )}

                    {/* Transparent Header - overlaid on banner */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <ArrowLeft color="#fff" size={24} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Profile</Text>
                        {canEdit ? (
                            <TouchableOpacity
                                style={styles.editBannerButton}
                                onPress={() => setShowBannerEditor(!showBannerEditor)}
                            >
                                <ImageIcon size={18} color="#fff" />
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 36 }} />
                        )}
                    </View>
                </View>

                {/* Profile Card - flush with banner, square top corners */}
                <View style={styles.profileCard}>
                    {/* Avatar - Clickable to edit */}
                    <TouchableOpacity
                        style={styles.avatarWrapper}
                        onPress={canEdit ? () => setEditModalVisible(true) : undefined}
                        activeOpacity={canEdit ? 0.7 : 1}
                    >
                        <View style={[styles.avatar, { borderColor: COLORS.node.panel }]}>
                            {user.avatar ? (
                                <Image
                                    key={user.avatar}
                                    source={{ uri: user.avatar, cache: 'reload' }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {user.username?.[0]?.toUpperCase() || user.firstName?.[0] || '?'}
                                </Text>
                            )}
                        </View>
                        {canEdit && (
                            <View style={styles.avatarEditHint}>
                                <Camera size={14} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Name */}
                    <Text style={styles.displayName}>
                        {user.firstName || user.username}
                    </Text>

                    {/* Era Badge */}
                    <View style={[styles.eraBadge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border }]}>
                        <Hexagon size={10} color={eraStyle.text} fill={eraStyle.text} />
                        <Text style={[styles.eraBadgeText, { color: eraStyle.text }]}>{userEra}</Text>
                    </View>

                    {/* Username row with share button on right */}
                    <View style={styles.usernameRow}>
                        <View style={styles.usernameRowSpacer} />
                        <Text style={styles.username}>@{user.username}</Text>
                        <View style={styles.usernameRowSpacer}>
                            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                                <Share2 size={16} color={COLORS.node.muted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Cred Section */}
                <TouchableOpacity
                    style={styles.credSection}
                    onPress={onCredClick}
                    activeOpacity={onCredClick ? 0.7 : 1}
                >
                    <View style={styles.credHeader}>
                        <View style={styles.credTitleRow}>
                            <Award size={20} color="#fbbf24" />
                            <Text style={styles.credTitle}>Cred</Text>
                        </View>
                        <View style={styles.totalCredBadge}>
                            <Text style={styles.totalCredValue}>{totalCred}</Text>
                            <Text style={styles.totalCredLabel}>Total Cred</Text>
                        </View>
                    </View>

                    {/* Top Nodes Breakdown */}
                    {credBreakdown.length > 0 && (
                        <View style={styles.nodesBreakdown}>
                            <Text style={styles.sectionSubtitle}>Top Nodes</Text>
                            {credBreakdown.map((node, idx) => (
                                <View key={node.nodeId} style={styles.nodeRow}>
                                    <View style={styles.nodeInfo}>
                                        <View style={[styles.nodeRankBadge, idx === 0 && styles.nodeRankGold]}>
                                            <Text style={styles.nodeRankText}>{idx + 1}</Text>
                                        </View>
                                        <Text style={styles.nodeName}>n/{node.nodeSlug}</Text>
                                    </View>
                                    <View style={styles.nodeCredContainer}>
                                        <View style={styles.nodeCredBarBg}>
                                            <View
                                                style={[
                                                    styles.nodeCredBar,
                                                    { width: `${(node.cred / maxNodeCred) * 100}%` }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.nodeCredValue}>{node.cred}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {onCredClick && (
                        <View style={styles.viewMoreRow}>
                            <Text style={styles.viewMoreText}>View Full History</Text>
                            <ChevronRight size={16} color={COLORS.node.accent} />
                        </View>
                    )}
                </TouchableOpacity>

                {/* Web of Trust Section */}
                {user?.id && (
                    <VouchSection
                        userId={user.id}
                        username={user.username || 'user'}
                        currentUserCred={authUser?.cred || 0}
                        isOwnProfile={authUser?.id === user.id}
                        onViewTrustGraph={onViewTrustGraph}
                    />
                )}

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <TrendingUp size={20} color={COLORS.node.accent} />
                        <Text style={styles.statValue}>{user.multiplier || 100}%</Text>
                        <Text style={styles.statLabel}>Multiplier</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Heart size={20} color="#f87171" />
                        <Text style={styles.statValue}>{user.receivedReactions || 0}</Text>
                        <Text style={styles.statLabel}>Received</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Users size={20} color="#34d399" />
                        <Text style={styles.statValue}>{user.councilVotes || 0}</Text>
                        <Text style={styles.statLabel}>Council</Text>
                    </View>
                </View>

                {/* Recent Activity */}
                {recentActivity.length > 0 && (
                    <View style={styles.activitySection}>
                        <View style={styles.activityHeader}>
                            <Clock size={18} color={COLORS.node.muted} />
                            <Text style={styles.activityTitle}>Recent Activity</Text>
                        </View>
                        {recentActivity.map((activity) => (
                            <View key={activity.id} style={styles.activityItem}>
                                <View style={styles.activityIcon}>
                                    {activity.type === 'post' && <MessageSquare size={14} color={COLORS.node.accent} />}
                                    {activity.type === 'comment' && <MessageSquare size={14} color="#34d399" />}
                                    {activity.type === 'reaction' && <Heart size={14} color="#f87171" />}
                                </View>
                                <View style={styles.activityContent}>
                                    <Text style={styles.activityText} numberOfLines={1}>
                                        {activity.title}
                                    </Text>
                                    <View style={styles.activityMeta}>
                                        {activity.node && (
                                            <Text style={styles.activityNode}>{activity.node}</Text>
                                        )}
                                        <Text style={styles.activityTime}>{timeAgo(activity.timestamp)}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Sign Out */}
                <TouchableOpacity style={styles.signOutButton} onPress={() => useAuthStore.getState().logout()}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Banner Editor - Floating overlay outside ScrollView */}
            {showBannerEditor && canEdit && (
                <View style={[
                    styles.bannerEditorOverlay,
                    { top: mobileHeaderOffset + 56 }
                ]}>
                    <View style={styles.bannerEditor}>
                        <View style={styles.bannerActions}>
                            <TouchableOpacity
                                style={styles.bannerUploadButton}
                                onPress={handleBannerUpload}
                                disabled={savingBanner}
                            >
                                <Upload size={14} color={COLORS.node.accent} />
                                <Text style={styles.bannerUploadText}>Upload Image</Text>
                            </TouchableOpacity>
                            {bannerImage && (
                                <TouchableOpacity
                                    style={styles.bannerRemoveButton}
                                    onPress={handleRemoveBanner}
                                    disabled={savingBanner}
                                >
                                    <X size={14} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text style={styles.bannerEditorTitle}>Or choose a color</Text>
                        <View style={styles.colorGrid}>
                            {BANNER_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        !bannerImage && bannerColor === color && styles.colorOptionSelected,
                                    ]}
                                    onPress={() => handleBannerColorSelect(color)}
                                    disabled={savingBanner}
                                />
                            ))}
                        </View>
                        {savingBanner && <ActivityIndicator size="small" color={COLORS.node.accent} style={{ marginTop: 8 }} />}
                    </View>
                </View>
            )}

            {/* Edit Profile Modal */}
            <EditProfileModal
                visible={editModalVisible}
                onClose={() => setEditModalVisible(false)}
                onSuccess={(updatedUser) => {
                    console.log('📸 Profile update received:', { avatar: updatedUser?.avatar });
                    updateUser(updatedUser);
                    setEditModalVisible(false);
                }}
                currentAvatar={user.avatar}
                username={user.username || 'user'}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.node.bg,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        zIndex: 10,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    loadingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    content: {
        paddingBottom: 100,
        gap: 0, // Sections handle their own marginTop
    },
    // Banner Section
    bannerSection: {
        position: 'relative',
        height: 160,
    },
    banner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160,
    },
    bannerImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160,
        resizeMode: 'cover',
    },
    editBannerButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerEditorOverlay: {
        position: 'absolute',
        right: 16,
        zIndex: 1000,
    },
    bannerEditor: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    bannerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    bannerUploadButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: `${COLORS.node.accent}20`,
        borderWidth: 1,
        borderColor: COLORS.node.accent,
    },
    bannerUploadText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.node.accent,
    },
    bannerRemoveButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    bannerEditorTitle: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.node.muted,
        marginBottom: 8,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        maxWidth: 180,
    },
    colorOption: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorOptionSelected: {
        borderColor: '#fff',
        borderWidth: 3,
    },
    // Profile Card - square top corners, meets banner flush
    profileCard: {
        alignItems: 'center',
        backgroundColor: COLORS.node.panel,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        marginHorizontal: 16,
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 60,
        marginTop: 0, // Meet banner flush
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: COLORS.node.border,
    },
    avatarWrapper: {
        position: 'relative',
        marginTop: -108, // Pull avatar up so its CENTER is at the card top (where banner meets card)
        marginBottom: 12,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: COLORS.node.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: COLORS.node.panel, // Match card background for clean look
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 48,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
    },
    avatarEditHint: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.node.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.node.panel,
    },
    displayName: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.node.text,
        marginBottom: 6,
    },
    eraBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
    },
    eraBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    usernameRowSpacer: {
        flex: 1,
        alignItems: 'flex-end',
    },
    username: {
        fontSize: 14,
        color: COLORS.node.muted,
    },
    shareButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    // Cred Section
    credSection: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    credHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    credTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    credTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    totalCredBadge: {
        alignItems: 'flex-end',
    },
    totalCredValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fbbf24',
    },
    totalCredLabel: {
        fontSize: 11,
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    nodesBreakdown: {
        gap: 12,
    },
    sectionSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    nodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    nodeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    nodeRankBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.node.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nodeRankGold: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
    },
    nodeRankText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.node.text,
    },
    nodeName: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.node.text,
    },
    nodeCredContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        maxWidth: 150,
    },
    nodeCredBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.node.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    nodeCredBar: {
        height: '100%',
        backgroundColor: COLORS.node.accent,
        borderRadius: 3,
    },
    nodeCredValue: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.node.text,
        width: 40,
        textAlign: 'right',
    },
    viewMoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.node.border,
    },
    viewMoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.accent,
    },
    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginHorizontal: 16,
        marginTop: 16,
    },
    statBox: {
        flex: 1,
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.node.text,
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Activity Section
    activitySection: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    activityTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    activityIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.node.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityContent: {
        flex: 1,
    },
    activityText: {
        fontSize: 14,
        color: COLORS.node.text,
        marginBottom: 4,
    },
    activityMeta: {
        flexDirection: 'row',
        gap: 8,
    },
    activityNode: {
        fontSize: 12,
        color: COLORS.node.accent,
    },
    activityTime: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    // Sign Out
    signOutButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        marginHorizontal: 16,
        marginTop: 16,
    },
    signOutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
});
