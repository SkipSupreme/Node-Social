import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Palette, Download, Star } from 'lucide-react-native';
import { COLORS } from '../constants/theme';

interface ThemesScreenProps {
    onBack: () => void;
}

const MOCK_THEMES = [
    { id: 'default', name: 'Node Social', author: 'Node Team', downloads: '12k', rating: 4.8, color: '#6366f1', description: 'The classic Node Social experience.' },
    { id: 'midnight', name: 'Midnight', author: 'NightOwl', downloads: '8.5k', rating: 4.9, color: '#0f172a', description: 'Deep dark mode for late night scrolling.' },
    { id: 'ocean', name: 'Oceanic', author: 'BlueWave', downloads: '5.2k', rating: 4.7, color: '#0ea5e9', description: 'Calming blue tones inspired by the sea.' },
    { id: 'forest', name: 'Forest', author: 'GreenThumb', downloads: '3.1k', rating: 4.6, color: '#10b981', description: 'Natural greens and earthy tones.' },
    { id: 'sunset', name: 'Sunset', author: 'SolarFlare', downloads: '2.8k', rating: 4.5, color: '#f59e0b', description: 'Warm gradients and vibrant accents.' },
    { id: 'cyber', name: 'Cyberpunk', author: 'NeonCity', downloads: '1.5k', rating: 4.8, color: '#d946ef', description: 'High contrast neon for the digital age.' },
];

export const ThemesScreen = ({ onBack }: ThemesScreenProps) => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft color={COLORS.node.text} size={24} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Theme Marketplace</Text>
                    <Text style={styles.headerSubtitle}>Earn, Don't Burn</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.banner}>
                    <Palette size={48} color="#fff" />
                    <View>
                        <Text style={styles.bannerTitle}>Create & Share Themes</Text>
                        <Text style={styles.bannerText}>Design your own CSS themes and earn Cred when others use them.</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Featured Themes</Text>
                <View style={styles.grid}>
                    {MOCK_THEMES.map(theme => (
                        <View key={theme.id} style={styles.card}>
                            <View style={[styles.preview, { backgroundColor: theme.color }]}>
                                <View style={styles.previewInner} />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={styles.themeName}>{theme.name}</Text>
                                <Text style={styles.author}>by @{theme.author}</Text>
                                <Text style={styles.description} numberOfLines={2}>{theme.description}</Text>

                                <View style={styles.statsRow}>
                                    <View style={styles.stat}>
                                        <Download size={14} color={COLORS.node.muted} />
                                        <Text style={styles.statText}>{theme.downloads}</Text>
                                    </View>
                                    <View style={styles.stat}>
                                        <Star size={14} color="#eab308" />
                                        <Text style={styles.statText}>{theme.rating}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.installButton}>
                                    <Text style={styles.installText}>Install</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
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
        backgroundColor: COLORS.node.panel,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: COLORS.node.bg,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.node.text,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 12,
        color: COLORS.node.muted,
        textAlign: 'center',
    },
    content: {
        padding: 24,
    },
    banner: {
        backgroundColor: COLORS.node.accent,
        borderRadius: 16,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
        marginBottom: 32,
    },
    bannerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    bannerText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        maxWidth: 300,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.node.text,
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    card: {
        // Web-only CSS calc value; not expressible in ViewStyle, so we cast through unknown
        width: (Platform.OS === 'web' ? 'calc(33.33% - 11px)' : '100%') as unknown as number | `${number}%`,
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    preview: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    previewInner: {
        width: '60%',
        height: '60%',
        backgroundColor: '#fff',
        borderRadius: 8,
        opacity: 0.2,
    },
    cardContent: {
        padding: 16,
    },
    themeName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.node.text,
        marginBottom: 4,
    },
    author: {
        fontSize: 12,
        color: COLORS.node.accent,
        marginBottom: 8,
    },
    description: {
        fontSize: 13,
        color: COLORS.node.muted,
        marginBottom: 16,
        height: 36,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    installButton: {
        backgroundColor: COLORS.node.bg,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    installText: {
        color: COLORS.node.text,
        fontWeight: '600',
        fontSize: 14,
    },
});
