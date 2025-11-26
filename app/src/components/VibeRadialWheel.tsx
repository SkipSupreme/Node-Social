import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity, Platform, Modal } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText, Line } from 'react-native-svg';
import { Hexagon, Lightbulb, Smile, Flame, Heart, Zap, HelpCircle } from './ui/Icons';
import { COLORS } from '../constants/theme';
import { createPostReaction } from '../lib/api';

// --- Config ---
const BUTTON_RADIUS = 30;
const MIN_RADIUS = 60;
const MAX_RADIUS = 140;

type VibeType = 'Insightful' | 'Joy' | 'Fire' | 'Support' | 'Shock' | 'Questionable';

const VIBES: { id: VibeType; icon: any; label: string; color: string }[] = [
    { id: 'Insightful', icon: Lightbulb, label: 'Insightful', color: '#3b82f6' },
    { id: 'Joy', icon: Smile, label: 'Joy', color: '#eab308' },
    { id: 'Fire', icon: Flame, label: 'Fire', color: '#f97316' },
    { id: 'Support', icon: Heart, label: 'Support', color: '#ec4899' },
    { id: 'Shock', icon: Zap, label: 'Shock', color: '#8b5cf6' },
    { id: 'Questionable', icon: HelpCircle, label: 'Questionable', color: '#64748b' },
];

const NUM_REACTIONS = VIBES.length;

// --- Math Helpers ---
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInRadians: number) {
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
    };
}

function describeWedge(x: number, y: number, startRadius: number, endRadius: number, startAngle: number, endAngle: number) {
    const innerStart = polarToCartesian(x, y, startRadius, startAngle);
    const innerEnd = polarToCartesian(x, y, startRadius, endAngle);
    const outerStart = polarToCartesian(x, y, endRadius, startAngle);
    const outerEnd = polarToCartesian(x, y, endRadius, endAngle);

    const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1';

    return [
        'M', outerStart.x, outerStart.y,
        'A', endRadius, endRadius, 0, largeArcFlag, 1, outerEnd.x, outerEnd.y,
        'L', innerEnd.x, innerEnd.y,
        'A', startRadius, startRadius, 0, largeArcFlag, 0, innerStart.x, innerStart.y,
        'Z',
    ].join(' ');
}

interface VibeRadialWheelProps {
    postId: string;
    nodeId?: string;
    initialReaction?: { [key: string]: number } | null;
    onComplete?: (intensities: Record<string, number>) => void;
    buttonLabel?: string;
    compact?: boolean;
}

export const VibeRadialWheel = ({
    postId,
    nodeId = 'global',
    initialReaction,
    onComplete,
    buttonLabel = 'Vibe Check',
    compact = false
}: VibeRadialWheelProps) => {
    const [isActive, setIsActive] = useState(false);
    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [drag, setDrag] = useState({ x: 0, y: 0 });
    const [intensities, setIntensities] = useState<Record<string, number>>(() => {
        if (initialReaction) {
            return {
                Insightful: initialReaction.insightful || 0,
                Joy: initialReaction.joy || 0,
                Fire: initialReaction.fire || 0,
                Support: initialReaction.support || 0,
                Shock: initialReaction.shock || 0,
                Questionable: initialReaction.questionable || 0,
            };
        }
        return { Insightful: 0, Joy: 0, Fire: 0, Support: 0, Shock: 0, Questionable: 0 };
    });
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef<View>(null);
    const centerRef = useRef({ x: 0, y: 0 });

    // Check if any reaction was applied
    const hasReaction = Object.values(intensities).some(v => v > 0);
    const primaryVibe = hasReaction
        ? VIBES.find(v => intensities[v.id] === Math.max(...Object.values(intensities)))
        : null;

    const updateOffset = () => {
        if (Platform.OS === 'web' && containerRef.current) {
            // @ts-ignore
            const rect = containerRef.current.getBoundingClientRect?.();
            if (rect) setOffset({ x: rect.left, y: rect.top });
        } else if (containerRef.current) {
            containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                setOffset({ x: pageX, y: pageY });
            });
        }
    };

    useEffect(() => {
        updateOffset();
        if (Platform.OS === 'web') {
            window.addEventListener('resize', updateOffset);
            return () => window.removeEventListener('resize', updateOffset);
        }
    }, []);

    const handleSubmit = async (finalIntensities: Record<string, number>) => {
        // Only submit if there's at least one reaction
        const hasAnyReaction = Object.values(finalIntensities).some(v => v > 0);
        if (!hasAnyReaction) return;

        try {
            await createPostReaction(postId, {
                nodeId: nodeId,
                intensities: {
                    insightful: finalIntensities.Insightful,
                    joy: finalIntensities.Joy,
                    fire: finalIntensities.Fire,
                    support: finalIntensities.Support,
                    shock: finalIntensities.Shock,
                    questionable: finalIntensities.Questionable,
                }
            });
            onComplete?.(finalIntensities);
        } catch (error) {
            console.error('Failed to submit reaction:', error);
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { pageX, pageY } = evt.nativeEvent;

                let localX = pageX;
                let localY = pageY;

                if (Platform.OS !== 'web') {
                    localX = pageX - offset.x;
                    localY = pageY - offset.y;
                }

                centerRef.current = { x: localX, y: localY };
                setCenter({ x: localX, y: localY });
                setDrag({ x: localX, y: localY });
                setIsActive(true);
                // Don't reset intensities - keep previous reactions
            },
            onPanResponderMove: (evt) => {
                const { pageX, pageY } = evt.nativeEvent;

                let localX = pageX;
                let localY = pageY;

                if (Platform.OS !== 'web') {
                    localX = pageX - offset.x;
                    localY = pageY - offset.y;
                }

                setDrag({ x: localX, y: localY });

                const dx = localX - centerRef.current.x;
                const dy = localY - centerRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                let angle = Math.atan2(dy, dx);
                if (angle < 0) angle += 2 * Math.PI;

                const sliceAngle = (2 * Math.PI) / NUM_REACTIONS;
                const startOffset = -Math.PI / 2 - sliceAngle / 2;

                let relativeAngle = angle - startOffset;
                if (relativeAngle < 0) relativeAngle += 2 * Math.PI;

                const activeIndex = Math.floor(relativeAngle / sliceAngle) % NUM_REACTIONS;
                const activeVibeId = VIBES[activeIndex].id;

                let newIntensity = 0;
                if (distance > MIN_RADIUS) {
                    const rawIntensity = (distance - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
                    newIntensity = Math.max(0, Math.min(rawIntensity * 100, 100));
                }

                setIntensities(prev => ({
                    ...prev,
                    [activeVibeId]: newIntensity
                }));
            },
            onPanResponderRelease: () => {
                setIsActive(false);
                handleSubmit(intensities);
            },
            onPanResponderTerminate: () => {
                setIsActive(false);
            },
        })
    ).current;

    return (
        <View
            ref={containerRef}
            onLayout={updateOffset}
            collapsable={false}
        >
            {/* Trigger Button */}
            <View {...panResponder.panHandlers}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                        styles.triggerBtn,
                        hasReaction && { borderColor: primaryVibe?.color, backgroundColor: `${primaryVibe?.color}20` }
                    ]}
                >
                    {hasReaction && primaryVibe ? (
                        <>
                            <primaryVibe.icon size={compact ? 16 : 20} color={primaryVibe.color} />
                            {!compact && <Text style={[styles.triggerText, { color: primaryVibe.color }]}>{Math.round(intensities[primaryVibe.id])}%</Text>}
                        </>
                    ) : (
                        <>
                            <Zap size={compact ? 16 : 20} color={COLORS.node.muted} />
                            {!compact && <Text style={styles.triggerText}>{buttonLabel}</Text>}
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Radial Wheel Overlay */}
            {isActive && (
                <Modal transparent visible={isActive} animationType="none">
                    <View style={styles.overlay} pointerEvents="box-none">
                        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                            {/* Background Dimmer */}
                            <Circle cx={center.x} cy={center.y} r={MAX_RADIUS + 40} fill="black" fillOpacity={0.5} />

                            {/* Connection Line */}
                            <Line
                                x1={center.x}
                                y1={center.y}
                                x2={drag.x}
                                y2={drag.y}
                                stroke="#6366f1"
                                strokeWidth="2"
                                strokeDasharray="4, 4"
                                opacity="0.5"
                            />

                            {/* Wedges */}
                            {VIBES.map((vibe, index) => {
                                const sliceAngle = (2 * Math.PI) / NUM_REACTIONS;
                                const startOffsetAngle = -Math.PI / 2 - sliceAngle / 2;
                                const startAngle = index * sliceAngle + startOffsetAngle;
                                const endAngle = startAngle + sliceAngle;

                                const intensity = intensities[vibe.id];
                                const isActiveWedge = intensity > 0;
                                const currentOuterRadius = MIN_RADIUS + ((MAX_RADIUS - MIN_RADIUS) * (intensity / 100));

                                const trackPath = describeWedge(center.x, center.y, MIN_RADIUS, MAX_RADIUS, startAngle, endAngle);
                                const activePath = describeWedge(center.x, center.y, MIN_RADIUS, currentOuterRadius, startAngle, endAngle);

                                return (
                                    <G key={vibe.id}>
                                        <Path d={trackPath} fill="#1e2128" stroke="#2a2d35" strokeWidth="1" />
                                        <Path d={activePath} fill={vibe.color} fillOpacity={0.9} stroke={vibe.color} strokeWidth={isActiveWedge ? 2 : 0} />
                                    </G>
                                );
                            })}

                            {/* Center Hub */}
                            <Circle cx={center.x} cy={center.y} r={BUTTON_RADIUS} fill="#181a20" stroke="#2a2d35" strokeWidth="2" />

                            {/* Percentage Text */}
                            {VIBES.map((vibe, index) => {
                                const sliceAngle = (2 * Math.PI) / NUM_REACTIONS;
                                const startOffsetAngle = -Math.PI / 2 - sliceAngle / 2;
                                const startAngle = index * sliceAngle + startOffsetAngle;
                                const midAngle = startAngle + sliceAngle / 2;
                                const intensity = intensities[vibe.id];
                                const isActiveWedge = intensity > 0;
                                const currentOuterRadius = MIN_RADIUS + ((MAX_RADIUS - MIN_RADIUS) * (intensity / 100));
                                const textPos = polarToCartesian(center.x, center.y, currentOuterRadius + 20, midAngle);

                                if (!isActiveWedge) return null;

                                return (
                                    <SvgText
                                        key={`text-${vibe.id}`}
                                        x={textPos.x}
                                        y={textPos.y}
                                        fill="white"
                                        fontSize="12"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        alignmentBaseline="middle"
                                    >
                                        {Math.round(intensity)}%
                                    </SvgText>
                                );
                            })}
                        </Svg>

                        {/* Icons Layer */}
                        {VIBES.map((vibe, index) => {
                            const sliceAngle = (2 * Math.PI) / NUM_REACTIONS;
                            const startOffsetAngle = -Math.PI / 2 - sliceAngle / 2;
                            const startAngle = index * sliceAngle + startOffsetAngle;
                            const midAngle = startAngle + sliceAngle / 2;

                            const intensity = intensities[vibe.id];
                            const currentIconRadius = (MIN_RADIUS + MAX_RADIUS) / 2;
                            const iconPos = polarToCartesian(center.x, center.y, currentIconRadius, midAngle);
                            const IconComponent = vibe.icon;

                            return (
                                <View
                                    key={`icon-${vibe.id}`}
                                    style={{
                                        position: 'absolute',
                                        left: iconPos.x - 12,
                                        top: iconPos.y - 12,
                                        width: 24,
                                        height: 24,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        transform: [{ scale: intensity > 0 ? 1.2 : 1 }],
                                        pointerEvents: 'none',
                                    }}
                                >
                                    <IconComponent size={24} color={intensity > 0 ? '#fff' : 'rgba(255,255,255,0.5)'} />
                                </View>
                            );
                        })}

                        {/* Helper Text */}
                        <View style={styles.helperTextContainer}>
                            <Text style={styles.helperText}>Drag outward to intensify</Text>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    triggerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: COLORS.node.panel,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        borderRadius: 999,
    },
    triggerText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.node.muted,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
    },
    helperTextContainer: {
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    helperText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        overflow: 'hidden',
    }
});
