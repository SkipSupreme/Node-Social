import React from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { RadialWheel } from './RadialWheel';
import { COLORS } from '../constants/theme';
import { X } from './ui/Icons';
import { ScoreDebugger } from './ScoreDebugger';
import { Ionicons } from '@expo/vector-icons';

interface VibeCheckModalProps {
    visible: boolean;
    onClose: () => void;
    onComplete: (intensities: { [key: string]: number }) => void;
    initialIntensities?: { [key: string]: number };
    postId?: string;
}

export const VibeCheckModal: React.FC<VibeCheckModalProps> = ({
    visible,
    onClose,
    onComplete,
    initialIntensities,
    postId,
}) => {
    const screenWidth = Dimensions.get('window').width;
    const wheelSize = Math.min(screenWidth * 0.9, 350);
    const [showDebugger, setShowDebugger] = React.useState(false);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Vibe Check</Text>
                        <View style={styles.headerActions}>
                            {postId && (
                                <TouchableOpacity onPress={() => setShowDebugger(true)} style={styles.debugBtn}>
                                    <Ionicons name="bug-outline" size={24} color={COLORS.node.muted} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={24} color={COLORS.node.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.wheelContainer}>
                        <RadialWheel
                            size={wheelSize}
                            onComplete={(intensities) => {
                                onComplete(intensities);
                                onClose();
                            }}
                            onCancel={() => {
                                // Optional: don't close on cancel, or do?
                                // For now, let's keep it open if they just release without selecting
                            }}
                            initialIntensities={initialIntensities}
                        />
                    </View>

                    <Text style={styles.instruction}>
                        Drag to select vibe • Pull out for intensity
                    </Text>

                    <ScoreDebugger
                        visible={showDebugger}
                        postId={postId || null}
                        onClose={() => setShowDebugger(false)}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '100%',
        alignItems: 'center',
        padding: 20,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    closeBtn: {
        padding: 8,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    debugBtn: {
        padding: 8,
    },
    wheelContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    instruction: {
        color: COLORS.node.muted,
        fontSize: 14,
        textAlign: 'center',
    },
});
