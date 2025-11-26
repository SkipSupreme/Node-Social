import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Hexagon } from './ui/Icons';
import { VECTORS, VECTOR_COLORS, VECTOR_ICONS, VibeVectorType, VECTOR_LABELS } from '../constants/vibes';
import { api } from '../lib/api';
import { COLORS } from '../constants/theme';

interface VibeReactionButtonProps {
    postId: string;
    nodeId: string;
    initialReaction?: { [key: string]: number } | null;
    onReactionUpdate?: (reaction: { [key: string]: number } | null) => void;
    onLongPress?: () => void;
}

export const VibeReactionButton: React.FC<VibeReactionButtonProps> = ({
    postId,
    nodeId,
    initialReaction,
    onReactionUpdate,
    onLongPress,
}) => {
    const [currentVector, setCurrentVector] = useState<VibeVectorType | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialReaction) {
            // Find the vector with > 0 intensity
            const vector = Object.keys(initialReaction).find(k => initialReaction[k] > 0) as VibeVectorType;
            setCurrentVector(vector || null);
        } else {
            setCurrentVector(null);
        }
    }, [initialReaction]);

    const handlePress = async () => {
        if (loading) return;
        setLoading(true);

        try {
            let nextVector: VibeVectorType | null = null;

            if (!currentVector) {
                nextVector = VECTORS[0]; // Start with first
            } else {
                const currentIndex = VECTORS.indexOf(currentVector);
                if (currentIndex === VECTORS.length - 1) {
                    nextVector = null; // Cycle back to none
                } else {
                    nextVector = VECTORS[currentIndex + 1];
                }
            }

            if (nextVector) {
                // Create/Update reaction
                // Simple mode: 100% intensity
                await api.post(`/reactions/posts/${postId}`, {
                    nodeId,
                    intensities: { [nextVector]: 1.0 }
                });

                setCurrentVector(nextVector);
                if (onReactionUpdate) {
                    onReactionUpdate({ [nextVector]: 1.0 });
                }
            } else {
                // Delete reaction
                await api.delete(`/reactions/posts/${postId}?nodeId=${nodeId}`);
                setCurrentVector(null);
                if (onReactionUpdate) {
                    onReactionUpdate(null);
                }
            }
        } catch (error) {
            console.error('Failed to update reaction:', error);
        } finally {
            setLoading(false);
        }
    };

    const color = currentVector ? VECTOR_COLORS[currentVector] : COLORS.node.accent;
    const icon = currentVector ? VECTOR_ICONS[currentVector] : null;
    const label = currentVector ? VECTOR_LABELS[currentVector] : 'Vibe Check';

    return (
        <TouchableOpacity
            style={[styles.pillBtn, currentVector ? { borderColor: color, backgroundColor: `${color}20` } : {}]}
            activeOpacity={0.7}
            onPress={handlePress}
            onLongPress={onLongPress}
            delayLongPress={500}
            disabled={loading}
        >
            {loading ? (
                <ActivityIndicator size="small" color={color} />
            ) : (
                <>
                    {icon ? <Text style={{ fontSize: 16 }}>{icon}</Text> : <Hexagon size={20} color={color} />}
                    <Text style={[styles.pillText, currentVector ? { color: color } : {}]}>{label}</Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    pillBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8,
        backgroundColor: COLORS.node.panel, borderWidth: 1, borderColor: COLORS.node.border, borderRadius: 999
    },
    pillText: { fontSize: 14, fontWeight: '500', color: COLORS.node.muted },
});
