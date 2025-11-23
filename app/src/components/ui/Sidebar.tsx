
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { Hexagon, Zap, Flame, Users, Search, Palette, X } from './Icons';
import { COLORS } from '../../constants/theme';

interface SidebarProps {
    nodes: any[];
    onClose?: () => void;
    isDesktop?: boolean;
}

export const Sidebar = ({ nodes, onClose, isDesktop = false }: SidebarProps) => {
    return (
        <SafeAreaView style={[styles.container, isDesktop && styles.containerDesktop]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoRow}>
                    <View style={styles.logoIcon}>
                        <Hexagon size={20} color="#fff" />
                    </View>
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
                    <NavItem icon={Flame} label="Your Flow" active />
                    <NavItem icon={Search} label="Discovery" />
                    <NavItem icon={Users} label="Following" />
                    <NavItem icon={Palette} label="Themes" />
                </View>

                <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Your Nodes</Text>
                </View>

                <View style={styles.nodeList}>
                    {nodes.map(node => (
                        <TouchableOpacity key={node.id} style={styles.nodeItem}>
                            <View style={[styles.nodeDot, { backgroundColor: node.color || '#2a2d35' }]} />
                            <Text style={styles.nodeName}>{node.name}</Text>
                            {node.vibeVelocity > 80 && <Zap size={12} color="#eab308" />}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* User Footer */}
            <View style={styles.footer}>
                <View style={styles.avatar} />
                <View>
                    <Text style={styles.footerUser}>dev_optimist</Text>
                    <Text style={styles.footerEra}>Main Character Era</Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

interface NavItemProps {
    icon: any;
    label: string;
    active?: boolean;
}

const NavItem = ({ icon: Icon, label, active }: NavItemProps) => (
    <TouchableOpacity style={[styles.navItem, active && styles.navItemActive]}>
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
    nodeDot: { width: 8, height: 8, borderRadius: 4 },
    nodeName: { fontSize: 14, fontWeight: '500', color: COLORS.node.text, flex: 1 },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.node.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#374151' },
    footerUser: { color: '#fff', fontWeight: 'bold' },
    footerEra: { color: COLORS.node.muted, fontSize: 12 }
});
