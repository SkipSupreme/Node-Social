import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Upload, X, Palette } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/theme';

// Banner color presets - curated palette
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

interface BannerEditorProps {
    currentColor?: string;
    hasBannerImage: boolean;
    saving: boolean;
    onSelectColor: (color: string) => void;
    onUploadImage: () => void;
    onRemoveImage: () => void;
    onClose: () => void;
}

export const BannerEditor: React.FC<BannerEditorProps> = ({
    currentColor,
    hasBannerImage,
    saving,
    onSelectColor,
    onUploadImage,
    onRemoveImage,
    onClose,
}) => {
    return (
        <View style={styles.container}>
            {/* Glass background */}
            <View style={styles.glassBackground} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Palette size={16} color={COLORS.node.text} />
                        <Text style={styles.title}>Customize Banner</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={16} color={COLORS.node.muted} />
                    </TouchableOpacity>
                </View>

                {/* Upload section */}
                <View style={styles.uploadSection}>
                    <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={onUploadImage}
                        disabled={saving}
                    >
                        <Upload size={16} color={COLORS.node.accent} />
                        <Text style={styles.uploadText}>Upload Image</Text>
                    </TouchableOpacity>

                    {hasBannerImage && (
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={onRemoveImage}
                            disabled={saving}
                        >
                            <X size={14} color={COLORS.error} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Divider */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or choose a color</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Color grid */}
                <View style={styles.colorGrid}>
                    {BANNER_COLORS.map((color) => (
                        <TouchableOpacity
                            key={color}
                            style={[
                                styles.colorOption,
                                { backgroundColor: color },
                                !hasBannerImage && currentColor === color && styles.colorOptionSelected,
                            ]}
                            onPress={() => onSelectColor(color)}
                            disabled={saving}
                        >
                            {!hasBannerImage && currentColor === color && (
                                <View style={styles.colorCheckmark} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Loading indicator */}
                {saving && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="small" color={COLORS.node.accent} />
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        minWidth: 280,
        borderRadius: RADIUS.lg,
        overflow: 'visible',
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.node.panel, // Solid background for visibility
        borderWidth: 2,
        borderColor: COLORS.node.accent,
        borderRadius: RADIUS.lg,
        boxShadow: '0px 12px 40px rgba(0, 0, 0, 0.6), 0px 0px 20px rgba(99, 102, 241, 0.3)',
        ...Platform.select({
            web: {
                backdropFilter: 'blur(20px)',
            },
        }),
    },
    content: {
        padding: SPACING.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    title: {
        fontSize: TYPOGRAPHY.sizes.small,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.node.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadSection: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    uploadButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.md,
        backgroundColor: `${COLORS.node.accent}15`,
        borderWidth: 1,
        borderColor: COLORS.node.accent,
    },
    uploadText: {
        fontSize: TYPOGRAPHY.sizes.small,
        fontWeight: '600',
        color: COLORS.node.accent,
    },
    removeButton: {
        width: 36,
        height: 36,
        borderRadius: RADIUS.md,
        backgroundColor: `${COLORS.error}10`,
        borderWidth: 1,
        borderColor: COLORS.error,
        alignItems: 'center',
        justifyContent: 'center',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.md,
        gap: SPACING.sm,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.node.border,
    },
    dividerText: {
        fontSize: TYPOGRAPHY.sizes.xs,
        color: COLORS.node.muted,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    colorOption: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorOptionSelected: {
        borderColor: '#fff',
        borderWidth: 3,
    },
    colorCheckmark: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS.lg,
    },
});

export default BannerEditor;
