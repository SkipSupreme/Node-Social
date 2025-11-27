
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Platform, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hexagon, Zap, Flame, Users, Search, Palette, X, Shield, Bookmark } from './Icons';
import { COLORS } from '../../constants/theme';

interface SidebarProps {
    nodes: any[];
    onClose?: () => void;
    isDesktop?: boolean;
    user?: any;
    onProfileClick?: () => void;
    selectedNodeId?: string | null;
    onNodeSelect?: (nodeId: string | null) => void;
    feedMode?: 'global' | 'discovery' | 'following';
    onFeedModeSelect?: (mode: 'global' | 'discovery' | 'following') => void;
    onThemesClick?: () => void;
    onSavedClick?: () => void;
    onBetaClick?: () => void;
    onNewPostClick?: () => void;
    onModerationClick?: () => void;
    currentView?: string;
}

// Animated Logo Component
const PulsingLogo = () => {
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
        <View style={styles.logoIcon}>
            {/* Glow effect layer - just for the icon */}
            <Animated.View
                style={[
                    styles.logoGlow,
                    {
                        opacity: glowAnim,
                        transform: [{ scale: pulseAnim }],
                    },
                ]}
            >
                <Hexagon size={20} color={COLORS.node.accent} />
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
    feedMode = 'global',
    onFeedModeSelect,
    onThemesClick,
    onSavedClick,
    onBetaClick,
    onNewPostClick,
    onModerationClick,
    currentView
}: SidebarProps) => {

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

    return (
        <SafeAreaView style={[styles.container, isDesktop && styles.containerDesktop]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoRow}>
                    <PulsingLogo />
                    <Text style={styles.logoText}>Node<Text style={{ color: COLORS.node.accent }}>Social</Text></Text>
                </View>

                {/* Only show Close button if not in Desktop mode */}
                {!isDesktop && onClose && (
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={20} color={COLORS.node.muted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Search - Only show on Mobile/Tablet (not Desktop) */}
            {!isDesktop && (
                <View style={styles.searchContainer}>
                    <Search size={16} color={COLORS.node.muted} style={{ position: 'absolute', left: 12, top: 10 }} />
                    <TextInput
                        style={styles.input}
                        placeholder="Search..."
                        placeholderTextColor={COLORS.node.muted}
                    />
                </View>
            )}

            <ScrollView style={{ flex: 1 }}>
                <View style={styles.navSection}>
                    {/* New Post Button (Desktop) */}
                    {isDesktop && (
                        <TouchableOpacity
                            style={[styles.navItem, { backgroundColor: COLORS.node.accent, marginBottom: 16, justifyContent: 'center' }]}
                            onPress={onNewPostClick}
                        >
                            <Text style={[styles.navText, { color: '#fff', fontWeight: 'bold' }]}>+ New Post</Text>
                        </TouchableOpacity>
                    )}

                    <NavItem
                        icon={Flame}
                        label="Your Flow"
                        active={feedMode === 'global' && selectedNodeId === null}
                        onPress={() => handleModeClick('global')}
                    />
                    <NavItem
                        icon={Search}
                        label="Discovery"
                        active={feedMode === 'discovery'}
                        onPress={() => handleModeClick('discovery')}
                    />
                    <NavItem
                        icon={Users}
                        label="Following"
                        active={feedMode === 'following'}
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
                        label="Moderation"
                        active={currentView === 'moderation'}
                        onPress={() => {
                            if (onClose && !isDesktop) onClose();
                            if (onModerationClick) onModerationClick();
                        }}
                    />
                    <NavItem
                        icon={Zap}
                        label="Beta Features"
                        active={currentView === 'beta'}
                        onPress={() => {
                            if (onClose && !isDesktop) onClose();
                            if (onBetaClick) onBetaClick();
                        }}
                    />
                </View>

                <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Your Nodes</Text>
                </View>

                <View style={styles.nodeList}>
                    {nodes.map(node => (
                        <TouchableOpacity
                            key={node.id}
                            style={[styles.nodeItem, selectedNodeId === node.id && styles.nodeItemActive]}
                            onPress={() => handleNodeClick(node.id)}
                        >
                            <View style={[styles.nodeDot, { backgroundColor: node.color || '#6366f1' }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.nodeName, selectedNodeId === node.id && styles.nodeNameActive]}>{node.name}</Text>
                                {node.subscriberCount !== undefined && (
                                    <Text style={styles.nodeSubscribers}>{node.subscriberCount} {node.subscriberCount === 1 ? 'member' : 'members'}</Text>
                                )}
                            </View>
                            {node.isSubscribed && <Users size={12} color={COLORS.node.accent} />}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* User Footer */}
            <TouchableOpacity style={styles.footer} onPress={onProfileClick}>
                <View style={[styles.avatar, { backgroundColor: user?.era === 'Builder Era' ? '#6366f1' : '#10B981', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}>
                    {user?.avatar ? (
                        <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                            {user?.firstName?.[0] || 'U'}{user?.lastName?.[0]}
                        </Text>
                    )}
                </View>
                <View>
                    <Text style={styles.footerUser}>@{user?.username || 'user'}</Text>
                    <Text style={styles.footerEra}>{user?.era || 'Lurker Era'}</Text>
                </View>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

interface NavItemProps {
    icon: any;
    label: string;
    active?: boolean;
    onPress?: () => void;
}

const NavItem = ({ icon: Icon, label, active, onPress }: NavItemProps) => (
    <TouchableOpacity
        style={[styles.navItem, active && styles.navItemActive]}
        onPress={onPress}
    >
        <Icon size={20} color={active ? COLORS.node.accent : COLORS.node.muted} />
        <Text style={[styles.navText, active && { color: COLORS.node.accent }]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.node.panel },
    containerDesktop: { borderRightWidth: 1, borderRightColor: COLORS.node.border },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoIcon: { width: 32, height: 32, backgroundColor: COLORS.node.accent, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    logoGlow: {
        position: 'absolute',
        shadowColor: COLORS.node.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 10,
    },
    logoIconInner: {
        position: 'absolute',
    },
    logoText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    closeBtn: { padding: 8 },
    searchContainer: { marginHorizontal: 16, marginBottom: 24, position: 'relative' },
    input: {
        backgroundColor: COLORS.node.bg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.node.border,
        paddingVertical: 8, paddingLeft: 36, paddingRight: 12, color: '#fff'
    },
    navSection: { paddingHorizontal: 8, marginBottom: 24 },
    navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
    navItemActive: { backgroundColor: 'rgba(99, 102, 241, 0.1)' },
    navText: { fontSize: 16, fontWeight: '500', color: COLORS.node.muted },
    sectionTitleRow: { paddingHorizontal: 20, marginBottom: 8 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.node.muted, textTransform: 'uppercase' },
    nodeList: { paddingHorizontal: 8 },
    nodeItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
    nodeItemActive: { backgroundColor: 'rgba(99, 102, 241, 0.1)' },
    nodeDot: { width: 8, height: 8, borderRadius: 4 },
    nodeName: { fontSize: 14, fontWeight: '500', color: COLORS.node.text },
    nodeNameActive: { color: COLORS.node.accent, fontWeight: '700' },
    nodeSubscribers: { fontSize: 11, color: COLORS.node.muted, marginTop: 2 },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.node.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#374151' },
    footerUser: { color: '#fff', fontWeight: 'bold' },
    footerEra: { color: COLORS.node.muted, fontSize: 12 }
});
