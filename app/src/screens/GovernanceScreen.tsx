import React, { useState, useMemo, useCallback, type ComponentType } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Crown, Globe, Scale, Ban } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useTheme';

// ── Types ──────────────────────────────────────────────────────

type TabId = 'moderation' | 'council' | 'trust' | 'appeals' | 'blocked';

interface GovernanceScreenProps {
    onBack: () => void;
    initialTab?: TabId;
    nodeId?: string;
    nodeName?: string;
    userId?: string;
    onUserClick?: (userId: string) => void;
}

interface TabDef {
    id: TabId;
    label: string;
    Icon: ComponentType<{ size?: number; color?: string }>;
}

// ── Constants ──────────────────────────────────────────────────

const TABS: TabDef[] = [
    { id: 'moderation', label: 'Moderation', Icon: Shield },
    { id: 'council', label: 'Council', Icon: Crown },
    { id: 'trust', label: 'Trust', Icon: Globe },
    { id: 'appeals', label: 'Appeals', Icon: Scale },
    { id: 'blocked', label: 'Blocked', Icon: Ban },
];

// ── Static styles (non-themed) ─────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: {
        padding: 8,
        width: 40,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSpacer: {
        width: 40,
    },
    tabBar: {
        borderBottomWidth: 1,
    },
    tabBarContent: {
        flexDirection: 'row',
        paddingHorizontal: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    placeholderText: {
        fontSize: 16,
    },
});

// ── Component ──────────────────────────────────────────────────

export const GovernanceScreen = ({
    onBack,
    initialTab = 'moderation',
    nodeId: _nodeId,
    nodeName: _nodeName,
    userId: _userId,
    onUserClick: _onUserClick,
}: GovernanceScreenProps) => {
    const theme = useAppTheme();
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

    // Memoized themed style overrides
    const ts = useMemo(() => StyleSheet.create({
        container: { backgroundColor: theme.bg },
        header: { borderBottomColor: theme.border },
        title: { color: theme.text },
        tabBar: { backgroundColor: theme.panel, borderBottomColor: theme.border },
        activeTabBorder: { borderBottomColor: theme.accent },
        activeTabLabel: { color: theme.accent },
        inactiveTabLabel: { color: theme.muted },
        placeholderText: { color: theme.muted },
    }), [theme]);

    const handleTabPress = useCallback((tabId: TabId) => {
        setActiveTab(tabId);
    }, []);

    const activeTabDef = TABS.find(t => t.id === activeTab);

    return (
        <SafeAreaView style={[styles.container, ts.container]}>
            {/* Header */}
            <View style={[styles.header, ts.header]}>
                <Pressable onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </Pressable>
                <Text style={[styles.title, ts.title]}>Command Center</Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, ts.tabBar]}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabBarContent}
                >
                    {TABS.map((tab) => {
                        const isActive = tab.id === activeTab;
                        const iconColor = isActive ? theme.accent : theme.muted;

                        return (
                            <Pressable
                                key={tab.id}
                                style={[
                                    styles.tab,
                                    isActive && ts.activeTabBorder,
                                ]}
                                onPress={() => handleTabPress(tab.id)}
                            >
                                <tab.Icon size={18} color={iconColor} />
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        isActive ? ts.activeTabLabel : ts.inactiveTabLabel,
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Tab Content */}
            <View style={styles.content}>
                <Text style={[styles.placeholderText, ts.placeholderText]}>
                    {activeTabDef ? `${activeTabDef.label} tab placeholder` : ''}
                </Text>
            </View>
        </SafeAreaView>
    );
};
