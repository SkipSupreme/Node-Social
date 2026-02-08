import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    Animated,
    useWindowDimensions,
    Platform,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Hexagon, X, Check, Sparkles, Info } from 'lucide-react-native';
import { ERAS, TYPOGRAPHY, SPACING, RADIUS, BREAKPOINTS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';
import { updateProfile } from '../../lib/api';

interface EraSelectorProps {
    visible: boolean;
    currentEra: string;
    onClose: () => void;
    onEraChange: (newEra: string) => void;
}

// Selectable eras (not auto-calculated ones)
const SELECTABLE_ERAS = [
    { key: 'Lurker Era', description: 'Observing from the shadows', vibe: 'Low-key' },
    { key: 'Main Character Era', description: 'The world revolves around you', vibe: 'Protagonist energy' },
    { key: 'Villain Era', description: 'Setting boundaries, no apologies', vibe: 'Dark and powerful' },
    { key: 'Builder Era', description: 'Creating something meaningful', vibe: 'Constructive' },
    { key: 'Teacher Era', description: 'Sharing knowledge freely', vibe: 'Mentorship' },
    { key: 'Healing Era', description: 'Taking time for yourself', vibe: 'Self-care' },
    { key: 'Grindset Era', description: 'Locked in, no distractions', vibe: 'Hustle mode' },
    { key: 'Goblin Mode', description: 'Comfort over everything', vibe: 'Chaotic cozy' },
    { key: 'Monk Mode', description: 'Digital minimalism', vibe: 'Focused' },
    { key: 'Touch Grass Era', description: 'Logging off, going outside', vibe: 'Touching grass' },
    { key: 'Flop Era', description: 'Embracing the chaos', vibe: 'Self-deprecating' },
];

const EraCard: React.FC<{
    era: typeof SELECTABLE_ERAS[0];
    isSelected: boolean;
    onSelect: () => void;
    index: number;
}> = ({ era, isSelected, onSelect, index }) => {
    const theme = useAppTheme();
    const eraStyle = ERAS[era.key] || ERAS['Default'];
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                damping: 15,
                stiffness: 120,
                delay: index * 50,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 300,
                delay: index * 50,
                useNativeDriver: true,
            }),
        ]).start();
    }, [index]);

    return (
        <Animated.View
            style={[
                styles.eraCardWrapper,
                {
                    opacity: opacityAnim,
                    transform: [{ scale: scaleAnim }],
                },
            ]}
        >
            <TouchableOpacity
                style={[
                    styles.eraCard,
                    {
                        backgroundColor: eraStyle.bg,
                        borderColor: isSelected ? eraStyle.text : eraStyle.border,
                        borderWidth: isSelected ? 2 : 1,
                    },
                ]}
                onPress={onSelect}
                activeOpacity={0.8}
            >
                {/* Era glow when selected */}
                {isSelected && (
                    <View
                        style={[
                            styles.eraGlow,
                            { backgroundColor: eraStyle.glow },
                        ]}
                    />
                )}

                <View style={styles.eraCardContent}>
                    {/* Icon */}
                    <LinearGradient
                        colors={eraStyle.gradient as [string, string, ...string[]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.eraIconContainer}
                    >
                        <Hexagon size={20} color="#fff" fill="#fff" />
                    </LinearGradient>

                    {/* Text */}
                    <View style={styles.eraTextContainer}>
                        <Text style={[styles.eraName, { color: eraStyle.text }]}>
                            {era.key}
                        </Text>
                        <Text style={[styles.eraDescription, { color: theme.muted }]}>
                            {era.description}
                        </Text>
                    </View>

                    {/* Check mark */}
                    {isSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: eraStyle.text }]}>
                            <Check size={12} color="#fff" strokeWidth={3} />
                        </View>
                    )}
                </View>

                {/* Vibe tag */}
                <View style={[styles.vibeTag, { borderColor: eraStyle.border }]}>
                    <Sparkles size={10} color={eraStyle.text} />
                    <Text style={[styles.vibeText, { color: eraStyle.text }]}>
                        {era.vibe}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export const EraSelector: React.FC<EraSelectorProps> = ({
    visible,
    currentEra,
    onClose,
    onEraChange,
}) => {
    const theme = useAppTheme();
    const { width, height } = useWindowDimensions();
    const isDesktop = width >= BREAKPOINTS.desktop;

    const [selectedEra, setSelectedEra] = useState(currentEra);
    const [saving, setSaving] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (visible) {
            setSelectedEra(currentEra);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    damping: 20,
                    stiffness: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
        }
    }, [visible]);

    const handleSave = async () => {
        if (selectedEra === currentEra) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            await updateProfile({ era: selectedEra });
            onEraChange(selectedEra);
            onClose();
        } catch (error) {
            console.error('Failed to update era:', error);
        } finally {
            setSaving(false);
        }
    };

    const selectedEraStyle = ERAS[selectedEra] || ERAS['Default'];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                            maxWidth: isDesktop ? 480 : '100%',
                            maxHeight: height * 0.85,
                        },
                    ]}
                >
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        {/* Glass background */}
                        <View style={[styles.glassBackground, { backgroundColor: theme.panel, borderColor: theme.border }]} />

                        {/* Header */}
                        <View style={[styles.header, { borderBottomColor: theme.border }]}>
                            <View style={styles.headerTitle}>
                                <Hexagon size={24} color={selectedEraStyle.text} fill={selectedEraStyle.text} />
                                <Text style={[styles.title, { color: theme.text }]}>Choose Your Era</Text>
                            </View>
                            <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.bg }]} onPress={onClose}>
                                <X size={20} color={theme.muted} />
                            </TouchableOpacity>
                        </View>

                        {/* Description */}
                        <View style={[styles.descriptionBox, { backgroundColor: theme.bg }]}>
                            <Info size={14} color={theme.muted} />
                            <Text style={[styles.descriptionText, { color: theme.muted }]}>
                                Your Era reflects your current vibe. It changes your profile's look and feel.
                            </Text>
                        </View>

                        {/* Era Grid */}
                        <ScrollView
                            style={styles.scrollContainer}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {SELECTABLE_ERAS.map((era, index) => (
                                <EraCard
                                    key={era.key}
                                    era={era}
                                    isSelected={selectedEra === era.key}
                                    onSelect={() => setSelectedEra(era.key)}
                                    index={index}
                                />
                            ))}
                        </ScrollView>

                        {/* Footer */}
                        <View style={[styles.footer, { borderTopColor: theme.border }]}>
                            <TouchableOpacity
                                style={[styles.cancelButton, { backgroundColor: theme.bg }]}
                                onPress={onClose}
                                disabled={saving}
                            >
                                <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.saveButton,
                                    { backgroundColor: selectedEraStyle.text },
                                ]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Sparkles size={16} color="#fff" />
                                        <Text style={styles.saveText}>Set Era</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    modalContainer: {
        width: '100%',
        borderRadius: RADIUS.xl,
        overflow: 'hidden',
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderRadius: RADIUS.xl,
        ...Platform.select({
            web: {
                backdropFilter: 'blur(20px)',
            },
        }),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.xl,
        borderBottomWidth: 1,
    },
    headerTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    title: {
        fontSize: TYPOGRAPHY.sizes.h3,
        fontWeight: '700',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            web: { cursor: 'pointer' },
        }),
    },
    descriptionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginHorizontal: SPACING.xl,
        marginTop: SPACING.lg,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
    },
    descriptionText: {
        flex: 1,
        fontSize: TYPOGRAPHY.sizes.small,
        lineHeight: TYPOGRAPHY.sizes.small * TYPOGRAPHY.lineHeights.relaxed,
    },
    scrollContainer: {
        maxHeight: 400,
    },
    scrollContent: {
        padding: SPACING.xl,
        gap: SPACING.md,
    },
    eraCardWrapper: {},
    eraCard: {
        position: 'relative',
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        overflow: 'hidden',
        ...Platform.select({
            web: { cursor: 'pointer' },
        }),
    },
    eraGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.2,
    },
    eraCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    eraIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    eraTextContainer: {
        flex: 1,
    },
    eraName: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '700',
    },
    eraDescription: {
        fontSize: TYPOGRAPHY.sizes.small,
        marginTop: 2,
    },
    checkBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    vibeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
    },
    vibeText: {
        fontSize: TYPOGRAPHY.sizes.xs,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        padding: SPACING.xl,
        borderTopWidth: 1,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        ...Platform.select({
            web: { cursor: 'pointer' },
        }),
    },
    cancelText: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        ...Platform.select({
            web: { cursor: 'pointer' },
        }),
    },
    saveText: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '700',
        color: '#fff',
    },
});

export default EraSelector;
