import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useAppTheme } from '../hooks/useTheme';
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
    const theme = useAppTheme();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            Linking.openURL(metadata.url);
        }
    };

    return (
        <TouchableOpacity style={[styles.container, { backgroundColor: theme.panel, borderColor: theme.border }]} onPress={handlePress} activeOpacity={0.9}>
            {metadata.image ? (
                <Image source={{ uri: metadata.image }} style={[styles.image, { backgroundColor: theme.bg }]} resizeMode="cover" />
            ) : null}
            <View style={styles.content}>
                <View style={styles.domainRow}>
                    <ExternalLink size={12} color={theme.muted} />
                    <Text style={[styles.domain, { color: theme.muted }]}>{metadata.domain || new URL(metadata.url).hostname}</Text>
                </View>
                {metadata.title ? (
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{metadata.title}</Text>
                ) : null}
                {metadata.description ? (
                    <Text style={[styles.description, { color: theme.muted }]} numberOfLines={2}>{metadata.description}</Text>
                ) : null}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        marginTop: 8,
    },
    image: {
        width: '100%',
        height: 160,
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
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
    },
});
