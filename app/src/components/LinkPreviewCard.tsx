import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS } from '../constants/theme';
import { ExternalLink } from 'lucide-react-native';

interface LinkMetadata {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
}

interface LinkPreviewCardProps {
    metadata: LinkMetadata;
    onPress?: () => void;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ metadata, onPress }) => {
    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            Linking.openURL(metadata.url);
        }
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.9}>
            {metadata.image ? (
                <Image source={{ uri: metadata.image }} style={styles.image} resizeMode="cover" />
            ) : null}
            <View style={styles.content}>
                <View style={styles.domainRow}>
                    <ExternalLink size={12} color={COLORS.node.muted} />
                    <Text style={styles.domain}>{metadata.domain || new URL(metadata.url).hostname}</Text>
                </View>
                {metadata.title ? (
                    <Text style={styles.title} numberOfLines={2}>{metadata.title}</Text>
                ) : null}
                {metadata.description ? (
                    <Text style={styles.description} numberOfLines={2}>{metadata.description}</Text>
                ) : null}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.node.border,
        marginTop: 8,
    },
    image: {
        width: '100%',
        height: 160,
        backgroundColor: COLORS.node.bg,
    },
    content: {
        padding: 12,
        gap: 4,
    },
    domainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    domain: {
        fontSize: 12,
        color: COLORS.node.muted,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.node.text,
        lineHeight: 20,
    },
    description: {
        fontSize: 13,
        color: COLORS.node.muted,
        lineHeight: 18,
    },
});
