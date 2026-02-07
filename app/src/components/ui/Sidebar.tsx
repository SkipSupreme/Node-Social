
import React, { ComponentType, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Platform, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hexagon, Zap, Flame, Users, Search, Palette, X, Shield, Bookmark, Bell, MessageSquare, Plus, HelpCircle } from './Icons';
import { ERAS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';
import type { Node } from '../../lib/api';
import type { AuthResponse } from '../../lib/api';

type User = AuthResponse['user'];

interface SidebarProps {
    nodes: Node[];
    onClose?: () => void;
    isDesktop?: boolean;
    user?: User;
    onProfileClick?: () => void;
    selectedNodeId?: string | null;
    onNodeSelect?: (nodeId: string | null) => void;
    onNodeInfo?: (nodeId: string) => void;
    feedMode?: 'global' | 'discovery' | 'following';
    onFeedModeSelect?: (mode: 'global' | 'discovery' | 'following') => void;
    onThemesClick?: () => void;
    onSavedClick?: () => void;
    onNewPostClick?: () => void;
    onGovernanceClick?: () => void;
    onNotificationsClick?: () => void;
    onMessagesClick?: () => void;
    onAddColumnClick?: () => void;
    unreadNotifications?: number;
    unreadMessages?: number;
    isMultiColumnEnabled?: boolean;
    currentView?: string;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    onSearch?: (query: string) => void;
}

// Animated Logo Component
const PulsingLogo = () => {
    const theme = useAppTheme();
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        // Pulse animation (scale up and down)
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );

        // Glow animation (opacity pulse)
        const glowLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 0.8,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.4,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );

        pulseLoop.start();
        glowLoop.start();

        return () => {
            pulseLoop.stop();
            glowLoop.stop();
        };
    }, []);

    return (
        <View style={[styles.logoIcon, { backgroundColor: theme.accent }]}>
            {/* Glow effect layer - just for the icon */}
            <Animated.View
                style={[
                    styles.logoGlow,
                    {
                        opacity: glowAnim,
                        transform: [{ scale: pulseAnim }],
                        boxShadow: `0px 0px 8px ${theme.accent}`,
                    },
                ]}
            >
                <Hexagon size={20} color={theme.accent} />
            </Animated.View>
            {/* Main icon */}
            <Animated.View
                style={[
                    styles.logoIconInner,
                    {
                        transform: [{ scale: pulseAnim }],
                    },
                ]}
            >
                <Hexagon size={20} color="#fff" />
            </Animated.View>
        </View>
    );
};

export const Sidebar = ({
    nodes,
    onClose,
    isDesktop = false,
    user,
    onProfileClick,
    selectedNodeId,
    onNodeSelect,
    onNodeInfo,
    feedMode = 'global',
    onFeedModeSelect,
    onThemesClick,
    onSavedClick,
    onNewPostClick,
    onGovernanceClick,
    onNotificationsClick,
    onMessagesClick,
    onAddColumnClick,
    unreadNotifications = 0,
    unreadMessages = 0,
    isMultiColumnEnabled = false,
    currentView,
    collapsed = false,
    onToggleCollapse,
    onSearch
}: SidebarProps) => {
    const theme = useAppTheme();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchSubmit = () => {
        const trimmed = searchQuery.trim();
        if (trimmed && onSearch) {
            onSearch(trimmed);
            setSearchQuery('');
            if (onClose && !isDesktop) {
                onClose();
            }
        }
    };

    const handleNodeClick = (nodeId: string | null) => {
        if (onNodeSelect) {
            onNodeSelect(nodeId);
        }
        if (onClose && !isDesktop) {
            onClose();
        }
    };

    const handleModeClick = (mode: 'global' | 'discovery' | 'following') => {
        if (onFeedModeSelect) {
            onFeedModeSelect(mode);
        }
        // Note: Don't call onNodeSelect here - it's handled by handleFeedModeSelect
        // and would override the currentView setting
        if (onClose && !isDesktop) {
            onClose();
        }
    };

    // Collapsed sidebar view - icons only
    if (collapsed && isDesktop) {
        return (
            <SafeAreaView style={[styles.collapsedContainer, { backgroundColor: theme.panel, borderRightColor: theme.border }]}>
                {/* Expand button */}
                <TouchableOpacity
                    style={styles.collapseButton}
                    onPress={onToggleCollapse}
                    activeOpacity={0.7}
                >
                    <Hexagon size={24} color={theme.muted} />
                </TouchableOpacity>

                {/* Icon-only nav items */}
                <View style={styles.collapsedNav}>
                    <CollapsedNavItem
                        icon={Flame}
                        active={feedMode === 'global' && selectedNodeId === null && currentView === 'feed'}
                        onPress={() => handleModeClick('global')}
                    />
                    <CollapsedNavItem
                        icon={Search}
                        active={feedMode === 'discovery' && currentView === 'discovery'}
                        onPress={() => handleModeClick('discovery')}
                    />
                    <CollapsedNavItem
                        icon={Users}
                        active={feedMode === 'following' && currentView === 'following'}
                        onPress={() => handleModeClick('following')}
                    />
                    <CollapsedNavItem
                        icon={Palette}
                        active={currentView === 'themes'}
                        onPress={onThemesClick}
                    />
                    <CollapsedNavItem
                        icon={Bookmark}
                        active={currentView === 'saved'}
                        onPress={onSavedClick}
                    />
                    <CollapsedNavItem
                        icon={Shield}
                        active={currentView === 'governance' || currentView === 'moderation' || currentView === 'appeals' || currentView === 'council' || currentView === 'vouches' || currentView === 'trust-graph' || currentView === 'blocked-muted'}
                        onPress={onGovernanceClick}
                    />
                    {/* Node avatars - right after nav items */}
                    {nodes.length > 0 && (
                        <View style={styles.collapsedNodes}>
                            <View style={styles.collapsedDivider} />
                            {nodes.slice(0, 5).map(node => (
                                <TouchableOpacity
                                    key={node.id}
                                    style={[
                                        styles.collapsedNodeItem,
                                        selectedNodeId === node.id && styles.collapsedNodeItemActive
                                    ]}
                                    onPress={() => handleNodeClick(node.id)}
                                >
                                    <View style={[styles.collapsedNodeAvatar, { backgroundColor: node.color || '#6366f1' }]}>
                                        {node.avatar ? (
                                            <Image source={{ uri: node.avatar }} style={styles.collapsedNodeAvatarImage} />
                                        ) : (
                                            <Text style={styles.collapsedNodeAvatarText}>
                                                {node.name?.charAt(0).toUpperCase() || 'N'}
                                            </Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* User avatar at bottom */}
                <TouchableOpacity style={[styles.collapsedFooter, { borderTopColor: theme.border }]} onPress={onProfileClick}>
                    <View style={[styles.collapsedAvatar, { backgroundColor: theme.border }]}>
                        {user?.avatar ? (
                            <Image key={user.avatar} source={{ uri: user.avatar, cache: 'reload' }} style={styles.collapsedAvatarImage} />
                        ) : (
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                                {user?.username?.[0]?.toUpperCase() || user?.firstName?.[0] || 'U'}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.panel }, isDesktop && styles.containerDesktop, isDesktop && { borderRightColor: theme.border }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoRow}>
                    <PulsingLogo />
                    <Text style={styles.logoText}>NODE<Text style={{ fontWeight: '400', color: theme.muted }}>social</Text></Text>
                </View>

                {/* Desktop: Collapse button */}
                {isDesktop && onToggleCollapse && (
                    <TouchableOpacity onPress={onToggleCollapse} style={styles.collapseButton} activeOpacity={0.7}>
                        <Text style={styles.collapseIcon}>←</Text>
                    </TouchableOpacity>
                )}

                {/* Mobile: Close button */}
                {!isDesktop && onClose && (
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={20} color={theme.muted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Search - Only show on Mobile/Tablet (not Desktop) */}
            {!isDesktop && (
                <View style={styles.searchContainer}>
                    <Search size={16} color={theme.muted} style={{ position: 'absolute', left: 12, top: 10 }} />
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border }]}
                        placeholder="Search posts, users, nodes..."
                        placeholderTextColor={theme.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearchSubmit}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            style={{ position: 'absolute', right: 12, top: 8 }}
                        >
                            <X size={16} color={theme.muted} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <ScrollView style={{ flex: 1 }}>
                <View style={styles.navSection}>
                    {/* New Post Button (Desktop) */}
                    {isDesktop && (
                        <TouchableOpacity
                            style={[styles.navItem, { backgroundColor: theme.accent, marginBottom: 8, justifyContent: 'center' }]}
                            onPress={onNewPostClick}
                        >
                            <Text style={[styles.navText, { color: '#fff', fontWeight: 'bold' }]}>+ New Post</Text>
                        </TouchableOpacity>
                    )}

                    {/* Add Column Button (Desktop, Multi-Column mode only) */}
                    {isDesktop && isMultiColumnEnabled && (
                        <TouchableOpacity
                            style={[styles.navItem, styles.addColumnButton, { marginBottom: 16, justifyContent: 'center', borderColor: theme.accent }]}
                            onPress={onAddColumnClick}
                        >
                            <Plus size={16} color={theme.accent} />
                            <Text style={[styles.navText, { color: theme.accent }]}>Add Column</Text>
                        </TouchableOpacity>
                    )}

                    <NavItem
                        icon={Flame}
                        label="Your Feed"
                        active={feedMode === 'global' && selectedNodeId === null && currentView === 'feed'}
                        onPress={() => handleModeClick('global')}
                    />
                    <NavItem
                        icon={Search}
                        label="Discovery"
                        active={feedMode === 'discovery' && currentView === 'discovery'}
                        onPress={() => handleModeClick('discovery')}
                    />
                    <NavItem
                        icon={Users}
                        label="Following"
                        active={feedMode === 'following' && currentView === 'following'}
                        onPress={() => handleModeClick('following')}
                    />
                    <NavItem
                        icon={Palette}
                        label="Themes"
                        active={currentView === 'themes'}
                        onPress={onThemesClick}
                    />
                    <NavItem
                        icon={Bookmark}
                        label="Saved Posts"
                        active={currentView === 'saved'}
                        onPress={onSavedClick}
                    />
                    <NavItem
                        icon={Shield}
                        label="Governance"
                        active={currentView === 'governance' || currentView === 'moderation' || currentView === 'appeals' || currentView === 'council' || currentView === 'vouches' || currentView === 'trust-graph' || currentView === 'blocked-muted'}
                        onPress={() => {
                            if (onClose && !isDesktop) onClose();
                            if (onGovernanceClick) onGovernanceClick();
                        }}
                    />
                </View>

                <View style={styles.sectionTitleRow}>
                    <Text style={[styles.sectionTitle, { color: theme.muted }]}>Your Nodes</Text>
                </View>

                <View style={styles.nodeList}>
                    {nodes.map(node => (
                        <TouchableOpacity
                            key={node.id}
                            style={[styles.nodeItem, selectedNodeId === node.id && styles.nodeItemActive]}
                            onPress={() => handleNodeClick(node.id)}
                        >
                            <View style={[styles.nodeAvatar, { backgroundColor: node.color || '#6366f1' }]}>
                                {node.avatar ? (
                                    <Image source={{ uri: node.avatar }} style={styles.nodeAvatarImage} />
                                ) : (
                                    <Text style={styles.nodeAvatarText}>
                                        {node.name?.charAt(0).toUpperCase() || 'N'}
                                    </Text>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.nodeName, { color: theme.text }, selectedNodeId === node.id && { color: theme.accent, fontWeight: '700' }]}>{node.name}</Text>
                                {node.subscriberCount !== undefined && (
                                    <Text style={[styles.nodeSubscribers, { color: theme.muted }]}>{node.subscriberCount} {node.subscriberCount === 1 ? 'member' : 'members'}</Text>
                                )}
                            </View>
                            {/* Info button */}
                            {onNodeInfo && (
                                <TouchableOpacity
                                    style={styles.nodeInfoButton}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        onNodeInfo(node.id);
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <HelpCircle size={16} color={theme.muted} />
                                </TouchableOpacity>
                            )}
                            {node.isSubscribed && !onNodeInfo && <Users size={12} color={theme.accent} />}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* User Footer */}
            {(() => {
                const userEra = user?.era || 'Lurker Era';
                const eraStyle = ERAS[userEra] || ERAS['Default'];
                return (
                    <View style={[styles.footer, { borderTopColor: theme.border }]}>
                        {/* User Profile */}
                        <TouchableOpacity style={styles.footerProfile} onPress={onProfileClick}>
                            <View style={[styles.avatar, { borderColor: theme.accent, borderWidth: 2, backgroundColor: theme.border }]}>
                                {user?.avatar ? (
                                    <Image key={user.avatar} source={{ uri: user.avatar, cache: 'reload' }} style={styles.avatarImage} />
                                ) : (
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                                        {user?.username?.[0]?.toUpperCase() || user?.firstName?.[0] || 'U'}
                                    </Text>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.footerUser}>@{user?.username || 'user'}</Text>
                                <View style={[styles.footerEraBadge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border }]}>
                                    <Hexagon size={10} color={eraStyle.text} />
                                    <Text style={[styles.footerEraText, { color: eraStyle.text }]}>
                                        {userEra.replace(' Era', '')}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                        {/* Notification & Message Icons - Right side */}
                        <View style={styles.footerIcons}>
                            <TouchableOpacity style={[styles.footerIconButton, { backgroundColor: theme.bg }]} onPress={onNotificationsClick}>
                                <Bell size={18} color={theme.muted} />
                                {unreadNotifications > 0 && (
                                    <View style={styles.footerBadge}>
                                        <Text style={styles.footerBadgeText}>
                                            {unreadNotifications > 99 ? '99+' : unreadNotifications}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.footerIconButton, { backgroundColor: theme.bg }]} onPress={onMessagesClick}>
                                <MessageSquare size={18} color={theme.muted} />
                                {unreadMessages > 0 && (
                                    <View style={styles.footerBadge}>
                                        <Text style={styles.footerBadgeText}>
                                            {unreadMessages > 99 ? '99+' : unreadMessages}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            })()}
        </SafeAreaView>
    );
};

interface NavItemProps {
    icon: ComponentType<{ size?: number; color?: string }>;
    label: string;
    active?: boolean;
    onPress?: () => void;
}

const NavItem = ({ icon: Icon, label, active, onPress }: NavItemProps) => {
    const theme = useAppTheme();
    return (
        <TouchableOpacity
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={onPress}
        >
            <Icon size={20} color={active ? theme.accent : theme.muted} />
            <Text style={[styles.navText, { color: theme.muted }, active && { color: theme.accent }]}>{label}</Text>
        </TouchableOpacity>
    );
};

// Collapsed nav item - icon only
interface CollapsedNavItemProps {
    icon: ComponentType<{ size?: number; color?: string }>;
    active?: boolean;
    onPress?: () => void;
}

const CollapsedNavItem = ({ icon: Icon, active, onPress }: CollapsedNavItemProps) => {
    const theme = useAppTheme();
    return (
        <TouchableOpacity
            style={[styles.collapsedNavItem, active && styles.collapsedNavItemActive]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Icon size={20} color={active ? theme.accent : theme.muted} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    containerDesktop: { borderRightWidth: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    logoGlow: {
        position: 'absolute',
    },
    logoIconInner: {
        position: 'absolute',
    },
    logoText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    closeBtn: { padding: 8 },
    searchContainer: { marginHorizontal: 16, marginBottom: 24, position: 'relative' },
    input: {
        borderRadius: 8, borderWidth: 1,
        paddingVertical: 8, paddingLeft: 36, paddingRight: 12, color: '#fff'
    },
    navSection: { paddingHorizontal: 8, marginBottom: 24 },
    navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
    navItemActive: { backgroundColor: 'rgba(99, 102, 241, 0.1)' },
    navText: { fontSize: 16, fontWeight: '500' },
    sectionTitleRow: { paddingHorizontal: 20, marginBottom: 8 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    nodeList: { paddingHorizontal: 8 },
    nodeItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
    nodeItemActive: { backgroundColor: 'rgba(99, 102, 241, 0.1)' },
    nodeInfoButton: { padding: 4, marginLeft: 4 },
    nodeDot: { width: 8, height: 8, borderRadius: 4 },
    nodeAvatar: {
        width: 28,
        height: 28,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    nodeAvatarImage: {
        width: '100%',
        height: '100%',
    },
    nodeAvatarText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    nodeName: { fontSize: 14, fontWeight: '500' },
    nodeSubscribers: { fontSize: 11, marginTop: 2 },
    footer: { padding: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImage: { width: '100%', height: '100%', borderRadius: 8 },
    footerUser: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    footerEraBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, marginTop: 3, alignSelf: 'flex-start' },
    footerEraText: { fontSize: 10, fontWeight: '600' },
    // Add Column button style
    addColumnButton: {
        borderWidth: 1,
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
    },
    // Footer notification/message icons
    footerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginRight: 8,
    },
    footerIconButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    footerBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    footerBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff',
    },
    footerProfile: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    // Collapsed sidebar styles
    collapsedContainer: {
        width: 56,
        height: '100%',
        borderRightWidth: 1,
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
    },
    collapseButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        marginBottom: 8,
    },
    collapseIcon: {
        fontSize: 20,
    },
    collapsedNav: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 8,
        gap: 4,
    },
    collapsedNavItem: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    collapsedNavItemActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    collapsedNodes: {
        alignItems: 'center',
        paddingTop: 8,
    },
    collapsedDivider: {
        width: 24,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 8,
    },
    collapsedNodeItem: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    collapsedNodeItemActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
    },
    collapsedNodeAvatar: {
        width: 28,
        height: 28,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    collapsedNodeAvatarImage: {
        width: '100%',
        height: '100%',
    },
    collapsedNodeAvatarText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    collapsedFooter: {
        paddingTop: 12,
        borderTopWidth: 1,
        alignItems: 'center',
    },
    collapsedAvatar: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    collapsedAvatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
});
