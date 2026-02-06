import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity, Platform, Modal, Pressable } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText, Line } from 'react-native-svg';
import { Portal } from '@gorhom/portal';
import { Hexagon, Lightbulb, Smile, Flame, Heart, Zap, HelpCircle } from './ui/Icons';
import { COLORS } from '../constants/theme';
import { createPostReaction, createCommentReaction } from '../lib/api';
import { useAuthPrompt } from '../context/AuthPromptContext';

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
    /** ID of the content (post ID when contentType='post', comment ID when contentType='comment') */
    contentId: string;
    /** @deprecated Use contentId instead */
    postId?: string;
    nodeId?: string;
    initialReaction?: { [key: string]: number } | null;
    onComplete?: (intensities: Record<string, number>) => void;
    buttonLabel?: string;
    compact?: boolean;
    contentType?: 'post' | 'comment';
}

// Helper function moved outside component to avoid recreation on every render
const getIntensitiesFromReaction = (reaction: { [key: string]: number } | null | undefined) => {
    if (reaction) {
        // Convert from 0-1 (API) to 0-100 (display) if values are small
        const scale = (v: number) => v <= 1 ? v * 100 : v;
        return {
            Insightful: scale(reaction.insightful || 0),
            Joy: scale(reaction.joy || 0),
            Fire: scale(reaction.fire || 0),
            Support: scale(reaction.support || 0),
            Shock: scale(reaction.shock || 0),
            Questionable: scale(reaction.questionable || 0),
        };
    }
    return { Insightful: 0, Joy: 0, Fire: 0, Support: 0, Shock: 0, Questionable: 0 };
};

export const VibeRadialWheel = ({
    contentId,
    postId, // deprecated, use contentId
    nodeId = 'global',
    initialReaction,
    onComplete,
    buttonLabel = 'Vibe Check',
    compact = false,
    contentType = 'post'
}: VibeRadialWheelProps) => {
    const { requireAuth } = useAuthPrompt();
    // Support both contentId (new) and postId (deprecated) for backwards compatibility
    const targetId = contentId || postId;
    const [isActive, setIsActive] = useState(false);
    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [drag, setDrag] = useState({ x: 0, y: 0 });
    const [intensities, setIntensities] = useState<Record<string, number>>(() => getIntensitiesFromReaction(initialReaction));
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
        if (!hasAnyReaction) {
            return;
        }

        // Require auth to react
        if (!requireAuth('Sign in to react to posts')) return;

        // Validate targetId before making API call
        if (!targetId) {
            console.error('[VibeRadialWheel] Cannot submit reaction: no contentId or postId provided');
            return;
        }

        try {
            // Convert intensities from 0-100 to 0-1 range for API
            // Only include nodeId if it's a valid UUID (backend will default to global otherwise)
            const isValidUUID = nodeId && nodeId !== 'global' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nodeId);
            const intensityData: any = {
                intensities: {
                    insightful: finalIntensities.Insightful / 100,
                    joy: finalIntensities.Joy / 100,
                    fire: finalIntensities.Fire / 100,
                    support: finalIntensities.Support / 100,
                    shock: finalIntensities.Shock / 100,
                    questionable: finalIntensities.Questionable / 100,
                }
            };

            // Only include nodeId if valid, otherwise backend defaults to global
            if (isValidUUID) {
                intensityData.nodeId = nodeId;
            }

            let result;
            if (contentType === 'comment') {
                result = await createCommentReaction(targetId, intensityData);
            } else {
                result = await createPostReaction(targetId, intensityData);
            }
            onComplete?.(finalIntensities);
        } catch (error: any) {
            console.error(`[VibeRadialWheel] FAILED to submit ${contentType} reaction:`, error);
            // Show alert so user sees the error on mobile
            if (typeof alert !== 'undefined') {
                alert(`Failed to save reaction: ${error?.message || error}`);
            }
        }
    };

    // Shared logic for handling move events
    const handleMoveLogic = (pageX: number, pageY: number) => {
        setDrag({ x: pageX, y: pageY });

        const dx = pageX - centerRef.current.x;
        const dy = pageY - centerRef.current.y;
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
    };

    // Track if we're currently dragging (for web mouse events)
    const isDraggingRef = useRef(false);
    const latestIntensitiesRef = useRef(intensities);

    // Keep ref in sync with state
    useEffect(() => {
        latestIntensitiesRef.current = intensities;
    }, [intensities]);

    // Web-specific mouse event handlers
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            // Use clientX/clientY for viewport-relative coordinates (fixed overlay)
            handleMoveLogic(e.clientX, e.clientY);
        };

        const handleMouseUp = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            setIsActive(false);
            handleSubmit(latestIntensitiesRef.current);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleWebMouseDown = (e: any) => {
        if (Platform.OS !== 'web') return;
        e.preventDefault();
        // Use clientX/clientY for viewport-relative coordinates (fixed overlay)
        const clientX = e.nativeEvent?.clientX ?? e.clientX;
        const clientY = e.nativeEvent?.clientY ?? e.clientY;

        centerRef.current = { x: clientX, y: clientY };
        setCenter({ x: clientX, y: clientY });
        setDrag({ x: clientX, y: clientY });
        setIsActive(true);
        isDraggingRef.current = true;
    };

    const panResponder = useRef(
        PanResponder.create({
            // Capture phase - claim gesture before ScrollView can
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                // Skip if already dragging via mouse (desktop web)
                if (isDraggingRef.current) return;

                const { pageX, pageY } = evt.nativeEvent;

                // On native, adjust for container offset
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
            },
            onPanResponderMove: (evt) => {
                if (isDraggingRef.current) return;

                const { pageX, pageY } = evt.nativeEvent;

                let localX = pageX;
                let localY = pageY;
                if (Platform.OS !== 'web') {
                    localX = pageX - offset.x;
                    localY = pageY - offset.y;
                }

                handleMoveLogic(localX, localY);
            },
            onPanResponderRelease: () => {
                if (isDraggingRef.current) return;
                setIsActive(false);
                handleSubmit(latestIntensitiesRef.current);
            },
            onPanResponderTerminate: () => {
                setIsActive(false);
            },
            // Don't let ScrollView steal our gesture
            onPanResponderTerminationRequest: () => false,
        })
    ).current;

    return (
        <View
            ref={containerRef}
            onLayout={updateOffset}
            collapsable={false}
        >
            {/* Trigger Button */}
            <View
                {...panResponder.panHandlers}
                // @ts-ignore - web-specific prop
                onMouseDown={Platform.OS === 'web' ? handleWebMouseDown : undefined}
            >
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
                            <Hexagon size={compact ? 16 : 20} color={COLORS.node.muted} />
                            {!compact && <Text style={styles.triggerText}>{buttonLabel}</Text>}
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Radial Wheel Overlay - Portal renders at root level to escape parent z-index */}
            {isActive && (
                <Portal hostName="radialWheel">
                {Platform.OS === 'web' ? (
                    // Web: Use fixed positioning
                    <View style={styles.webOverlay}>
                        <Pressable style={styles.backdrop} onPress={() => setIsActive(false)} />
                        <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
                            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
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
                    </View>
                ) : (
                    // Native: Use Modal with gesture capture to prevent ScrollView interference
                    <Modal transparent visible={isActive} animationType="none" onRequestClose={() => setIsActive(false)}>
                        <View style={styles.overlay} {...panResponder.panHandlers}>
                            {/* Invisible backdrop - tap outside radial to dismiss */}
                            <Pressable style={styles.backdrop} onPress={() => setIsActive(false)} />
                            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
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
                </Portal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    triggerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: COLORS.node.panel,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        borderRadius: 8,
    },
    triggerText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.node.muted,
    },
    webOverlay: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
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
