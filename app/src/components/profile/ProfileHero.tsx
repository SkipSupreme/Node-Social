import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Animated,
    useWindowDimensions,
    Platform,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Camera,
    MoreHorizontal,
    MessageCircle,
    UserPlus,
    UserCheck,
    MapPin,
    Link as LinkIcon,
    Calendar,
    BadgeCheck,
    Shield,
    Crown,
    Pencil,
    Check,
    X,
} from 'lucide-react-native';
import { ERAS, TYPOGRAPHY, SPACING, RADIUS, BREAKPOINTS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';

interface ProfileHeroProps {
    user: {
        id: string;
        username?: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
        bannerColor?: string;
        bannerImage?: string;
        bio?: string;
        location?: string;
        website?: string;
        createdAt: string;
        cred?: number;
        era?: string;
        isFollowing?: boolean;
        isVouched?: boolean;
        role?: 'user' | 'admin' | 'moderator';
        followingCount?: number;
        followersCount?: number;
        vouchesReceived?: number;
        totalVouchStake?: number;
    };
    era: string;
    canEdit: boolean;
    isOwnProfile?: boolean;
    onBack: () => void;
    onEditAvatar: () => void;
    onEditBanner: () => void;
    onFollow?: () => void;
    onMessage?: () => void;
    onMore?: () => void;
    onSaveBio?: (bio: string) => void;
    onSaveMeta?: (location: string, website: string) => void;
    isFollowLoading?: boolean;
    showBannerEditor: boolean;
    onToggleBannerEditor: () => void;
    bannerEditorContent?: React.ReactNode;
}

// Calculate Era based on account age
export const calculateEra = (createdAt: string): string => {
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

// Format join date
const formatJoinDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

// Format large numbers
const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
};

export const ProfileHero: React.FC<ProfileHeroProps> = ({
    user,
    era,
    canEdit,
    isOwnProfile,
    onBack,
    onEditAvatar,
    onEditBanner,
    onFollow,
    onMessage,
    onMore,
    onSaveBio,
    onSaveMeta,
    isFollowLoading,
    showBannerEditor,
    onToggleBannerEditor,
    bannerEditorContent,
}) => {
    const theme = useAppTheme();
    const { width } = useWindowDimensions();
    const isTablet = width >= BREAKPOINTS.tablet;
    const isDesktop = width >= BREAKPOINTS.desktop;

    const eraStyle = ERAS[era] || ERAS['Default'];
    const profileAccent = theme.profileAccent || theme.accent;
    const bannerColor = user.bannerColor || profileAccent;

    // Edit states
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [editBio, setEditBio] = useState(user.bio || '');
    const [isEditingMeta, setIsEditingMeta] = useState(false);
    const [editLocation, setEditLocation] = useState(user.location || '');
    const [editWebsite, setEditWebsite] = useState(user.website || '');

    const displayName = user.firstName || user.username || 'Anonymous';
    const bannerHeight = isDesktop ? 200 : isTablet ? 180 : 150;
    const avatarSize = isDesktop ? 120 : isTablet ? 100 : 85;

    const handleSaveBio = () => {
        onSaveBio?.(editBio);
        setIsEditingBio(false);
    };

    const handleSaveMeta = () => {
        onSaveMeta?.(editLocation, editWebsite);
        setIsEditingMeta(false);
    };

    // Get verification badge
    const renderBadge = () => {
        if (user.role === 'admin') {
            return (
                <View style={[styles.badge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Crown size={14} color="#ef4444" />
                </View>
            );
        }
        if (user.role === 'moderator') {
            return (
                <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                    <Shield size={14} color="#3b82f6" />
                </View>
            );
        }
        if (user.isVouched) {
            return (
                <View style={[styles.badge, { backgroundColor: 'rgba(34, 211, 238, 0.15)' }]}>
                    <BadgeCheck size={14} color="#22d3ee" />
                </View>
            );
        }
        return null;
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.profileBg || theme.bg }]}>
            {/* Banner with fade */}
            <View style={[styles.bannerContainer, { height: bannerHeight }]}>
                {/* Profile background image layer (from custom theme) */}
                {theme.profileBgImage ? (
                    <Image
                        source={{ uri: theme.profileBgImage }}
                        style={styles.bannerImage}
                    />
                ) : null}

                {/* User's banner image or solid color (on top of profile bg image) */}
                {user.bannerImage ? (
                    <Image
                        source={{ uri: user.bannerImage, cache: 'reload' }}
                        style={styles.bannerImage}
                    />
                ) : !theme.profileBgImage ? (
                    <View style={[styles.bannerSolid, { backgroundColor: bannerColor }]} />
                ) : null}

                {/* Fade gradient at bottom */}
                <LinearGradient
                    colors={['transparent', theme.profileBg || theme.bg]}
                    style={styles.bannerFade}
                />

                {/* Back button */}
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft color="#fff" size={22} />
                </TouchableOpacity>

                {/* Edit banner button */}
                {canEdit && (
                    <TouchableOpacity
                        style={styles.editBannerButton}
                        onPress={onToggleBannerEditor}
                    >
                        <Camera size={16} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Banner editor floating panel */}
            {showBannerEditor && canEdit && (
                <View style={styles.bannerEditorFloat}>
                    {bannerEditorContent}
                </View>
            )}

            {/* Profile info section */}
            <View style={styles.profileSection}>
                {/* Top row: Avatar + Action buttons */}
                <View style={styles.topRow}>
                    {/* Avatar - overlaps banner */}
                    <TouchableOpacity
                        onPress={canEdit ? onEditAvatar : undefined}
                        activeOpacity={canEdit ? 0.8 : 1}
                        style={[
                            styles.avatarContainer,
                            {
                                width: avatarSize + 8,
                                height: avatarSize + 8,
                                marginTop: -(avatarSize / 2),
                                borderColor: eraStyle.text,
                                backgroundColor: theme.bg,
                            },
                        ]}
                    >
                        {user.avatar ? (
                            <Image
                                source={{ uri: user.avatar, cache: 'reload' }}
                                style={[styles.avatarImage, { width: avatarSize, height: avatarSize }]}
                            />
                        ) : (
                            <LinearGradient
                                colors={eraStyle.gradient as [string, string, ...string[]]}
                                style={[styles.avatarPlaceholder, { width: avatarSize, height: avatarSize }]}
                            >
                                <Text style={[styles.avatarInitial, { fontSize: avatarSize * 0.35 }]}>
                                    {displayName[0]?.toUpperCase()}
                                </Text>
                            </LinearGradient>
                        )}
                        {canEdit && (
                            <View style={[styles.avatarEditBadge, { backgroundColor: eraStyle.text, borderColor: theme.bg }]}>
                                <Camera size={12} color={theme.bg} />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Action buttons - right aligned */}
                    <View style={styles.actionButtons}>
                        {onMore && (
                            <TouchableOpacity style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.panel }]} onPress={onMore}>
                                <MoreHorizontal size={20} color={theme.text} />
                            </TouchableOpacity>
                        )}
                        {onMessage && !isOwnProfile && (
                            <TouchableOpacity style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.panel }]} onPress={onMessage}>
                                <MessageCircle size={20} color={theme.text} />
                            </TouchableOpacity>
                        )}
                        {!isOwnProfile && onFollow && (
                            <TouchableOpacity
                                style={[
                                    styles.followButton,
                                    { backgroundColor: profileAccent },
                                    user.isFollowing && [styles.followButtonFollowing, { borderColor: theme.border }],
                                ]}
                                onPress={onFollow}
                                disabled={isFollowLoading}
                            >
                                {isFollowLoading ? (
                                    <ActivityIndicator size="small" color={user.isFollowing ? theme.text : '#fff'} />
                                ) : (
                                    <>
                                        {user.isFollowing ? (
                                            <UserCheck size={16} color={theme.text} />
                                        ) : (
                                            <UserPlus size={16} color="#fff" />
                                        )}
                                        <Text style={[
                                            styles.followButtonText,
                                            user.isFollowing && { color: theme.text },
                                        ]}>
                                            {user.isFollowing ? 'Following' : 'Follow'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Name row with badge */}
                <View style={styles.nameRow}>
                    <Text style={[styles.displayName, { color: theme.text }]}>{displayName}</Text>
                    {renderBadge()}
                </View>

                {/* Username */}
                <Text style={[styles.username, { color: theme.muted }]}>@{user.username}</Text>

                {/* Era badge */}
                <View style={[styles.eraBadge, { borderColor: eraStyle.text }]}>
                    <View style={[styles.eraDot, { backgroundColor: eraStyle.text }]} />
                    <Text style={[styles.eraText, { color: eraStyle.text }]}>
                        {era.toUpperCase().replace(' ERA', ' ARC')}
                    </Text>
                </View>

                {/* Bio section */}
                <View style={styles.bioSection}>
                    {isEditingBio ? (
                        <View style={styles.editContainer}>
                            <TextInput
                                style={[styles.bioInput, { color: theme.text, borderColor: theme.border }]}
                                value={editBio}
                                onChangeText={setEditBio}
                                placeholder="Write something about yourself..."
                                placeholderTextColor={theme.muted}
                                multiline
                                maxLength={500}
                                autoFocus
                            />
                            <View style={styles.editActions}>
                                <TouchableOpacity onPress={() => setIsEditingBio(false)} style={[styles.editButton, { backgroundColor: theme.border }]}>
                                    <X size={16} color={theme.muted} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSaveBio} style={[styles.editButton, { backgroundColor: profileAccent }]}>
                                    <Check size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.bioDisplay}>
                            <Text style={[styles.bioText, { color: theme.text }]}>
                                {user.bio || (canEdit ? 'Add a bio...' : '')}
                            </Text>
                            {canEdit && (
                                <TouchableOpacity onPress={() => setIsEditingBio(true)} style={styles.editIcon}>
                                    <Pencil size={14} color={theme.muted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* Meta row - location, website, join date */}
                <View style={styles.metaRow}>
                    {isEditingMeta ? (
                        <View style={styles.editContainer}>
                            <View style={[styles.metaInputRow, { borderColor: theme.border }]}>
                                <MapPin size={14} color={theme.muted} />
                                <TextInput
                                    style={[styles.metaInput, { color: theme.text }]}
                                    value={editLocation}
                                    onChangeText={setEditLocation}
                                    placeholder="Location"
                                    placeholderTextColor={theme.muted}
                                />
                            </View>
                            <View style={[styles.metaInputRow, { borderColor: theme.border }]}>
                                <LinkIcon size={14} color={theme.muted} />
                                <TextInput
                                    style={[styles.metaInput, { color: theme.text }]}
                                    value={editWebsite}
                                    onChangeText={setEditWebsite}
                                    placeholder="website.com"
                                    placeholderTextColor={theme.muted}
                                    autoCapitalize="none"
                                />
                            </View>
                            <View style={styles.editActions}>
                                <TouchableOpacity onPress={() => setIsEditingMeta(false)} style={[styles.editButton, { backgroundColor: theme.border }]}>
                                    <X size={16} color={theme.muted} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSaveMeta} style={[styles.editButton, { backgroundColor: profileAccent }]}>
                                    <Check size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.metaDisplay}>
                            {(user.location || canEdit) && (
                                <View style={styles.metaItem}>
                                    <MapPin size={14} color={theme.muted} />
                                    <Text style={[styles.metaText, { color: theme.muted }]}>{user.location || 'Add location'}</Text>
                                </View>
                            )}
                            {(user.website || canEdit) && (
                                <TouchableOpacity style={styles.metaItem}>
                                    <LinkIcon size={14} color={profileAccent} />
                                    <Text style={[styles.metaText, { color: profileAccent }]}>
                                        {user.website || 'Add website'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <View style={styles.metaItem}>
                                <Calendar size={14} color={theme.muted} />
                                <Text style={[styles.metaText, { color: theme.muted }]}>Joined {formatJoinDate(user.createdAt)}</Text>
                            </View>
                            {canEdit && (
                                <TouchableOpacity onPress={() => setIsEditingMeta(true)} style={styles.editIcon}>
                                    <Pencil size={14} color={theme.muted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* Stats row */}
                <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
                    <TouchableOpacity style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: theme.text }]}>{formatNumber(user.followingCount || 0)}</Text>
                        <Text style={[styles.statLabel, { color: theme.muted }]}>Following</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: theme.text }]}>{formatNumber(user.followersCount || 0)}</Text>
                        <Text style={[styles.statLabel, { color: theme.muted }]}>Followers</Text>
                    </TouchableOpacity>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: theme.text }, styles.credNumber]}>{formatNumber(user.cred || 0)}</Text>
                        <Text style={[styles.statLabel, { color: theme.muted }]}>Cred</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: theme.text }, styles.vouchNumber]}>{formatNumber(user.vouchesReceived || 0)}</Text>
                        <Text style={[styles.statLabel, { color: theme.muted }]}>Vouches</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: theme.text }, styles.stakeNumber]}>{formatNumber(user.totalVouchStake || 0)}</Text>
                        <Text style={[styles.statLabel, { color: theme.muted }]}>Stake</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {},
    bannerContainer: {
        position: 'relative',
        overflow: 'hidden',
    },
    bannerImage: {
        ...StyleSheet.absoluteFillObject,
        resizeMode: 'cover',
    },
    bannerSolid: {
        ...StyleSheet.absoluteFillObject,
    },
    bannerFade: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
    },
    backButton: {
        position: 'absolute',
        top: SPACING.lg,
        left: SPACING.lg,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    editBannerButton: {
        position: 'absolute',
        top: SPACING.lg,
        right: SPACING.lg,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerEditorFloat: {
        position: 'absolute',
        top: 70,
        right: SPACING.lg,
        zIndex: 9999,
        maxWidth: 320,
        minWidth: 280,
        elevation: 999,
    },
    profileSection: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.lg,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    avatarContainer: {
        borderRadius: RADIUS.md,
        borderWidth: 4,
        overflow: 'hidden',
    },
    avatarImage: {
        borderRadius: RADIUS.sm,
    },
    avatarPlaceholder: {
        borderRadius: RADIUS.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        color: '#fff',
        fontWeight: '700',
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    followButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ef4444',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: 20,
    },
    followButtonFollowing: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    followButtonText: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '700',
        color: '#fff',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: SPACING.md,
    },
    displayName: {
        fontSize: TYPOGRAPHY.sizes.h3,
        fontWeight: '800',
    },
    badge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    username: {
        fontSize: TYPOGRAPHY.sizes.body,
        marginTop: 2,
    },
    eraBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        alignSelf: 'flex-start',
        marginTop: SPACING.sm,
    },
    eraDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    eraText: {
        fontSize: TYPOGRAPHY.sizes.xs,
        fontWeight: '700',
        letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    },
    bioSection: {
        marginTop: SPACING.md,
    },
    bioDisplay: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    bioText: {
        flex: 1,
        fontSize: TYPOGRAPHY.sizes.body,
        lineHeight: TYPOGRAPHY.sizes.body * 1.5,
    },
    editContainer: {
        gap: SPACING.sm,
    },
    bioInput: {
        fontSize: TYPOGRAPHY.sizes.body,
        borderWidth: 1,
        borderRadius: RADIUS.md,
        padding: SPACING.sm,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: SPACING.sm,
    },
    editButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editIcon: {
        padding: SPACING.xs,
        marginLeft: SPACING.sm,
    },
    metaRow: {
        marginTop: SPACING.md,
    },
    metaDisplay: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: SPACING.md,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: TYPOGRAPHY.sizes.small,
    },
    metaInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        borderWidth: 1,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
    },
    metaInput: {
        flex: 1,
        fontSize: TYPOGRAPHY.sizes.small,
        padding: 0,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.lg,
        marginTop: SPACING.lg,
        paddingTop: SPACING.lg,
        borderTopWidth: 1,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statNumber: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '700',
    },
    credNumber: {
        color: '#fbbf24',
    },
    vouchNumber: {
        color: '#22c55e',
    },
    stakeNumber: {
        color: '#8b5cf6',
    },
    statLabel: {
        fontSize: TYPOGRAPHY.sizes.body,
    },
});

export default ProfileHero;
