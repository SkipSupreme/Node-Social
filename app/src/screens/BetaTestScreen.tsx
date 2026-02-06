import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions, TouchableOpacity, Platform } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText, Line } from 'react-native-svg';
import { Hexagon, Lightbulb, Smile, Skull, Sparkles, Flame, Heart, Zap, HelpCircle, X } from '../components/ui/Icons';
import { COLORS } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// --- Config ---
const BUTTON_RADIUS = 30;
const MIN_RADIUS = 60;
const MAX_RADIUS = 140;
const ICON_RADIUS = 100;

type VibeType = 'Insightful' | 'Joy' | 'Fire' | 'Support' | 'Shock' | 'Questionable';

const VIBES: { id: VibeType; icon: any; label: string; color: string }[] = [
    { id: 'Insightful', icon: Lightbulb, label: 'Insightful', color: '#3b82f6' }, // Blue (Top)
    { id: 'Joy', icon: Smile, label: 'Joy', color: '#eab308' },                   // Yellow (Top-Right)
    { id: 'Fire', icon: Flame, label: 'Fire', color: '#f97316' },                 // Orange (Bottom-Right)
    { id: 'Support', icon: Heart, label: 'Support', color: '#ec4899' },           // Pink (Bottom)
    { id: 'Shock', icon: Zap, label: 'Shock', color: '#8b5cf6' },                 // Violet (Bottom-Left)
    { id: 'Questionable', icon: HelpCircle, label: 'Questionable', color: '#64748b' }, // Slate (Top-Left)
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

interface BetaTestScreenProps {
    onBack?: () => void;
}

export const BetaTestScreen = ({ onBack }: BetaTestScreenProps) => {
    const [isActive, setIsActive] = useState(false);
    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [drag, setDrag] = useState({ x: 0, y: 0 });
    const [intensities, setIntensities] = useState<Record<string, number>>({
        Insightful: 0, Joy: 0, Fire: 0, Support: 0, Shock: 0, Questionable: 0
    });
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef<View>(null);

    // Update offset on layout/mount
    const updateOffset = () => {
        if (Platform.OS === 'web' && containerRef.current) {
            // @ts-ignore
            const rect = containerRef.current.getBoundingClientRect();
            setOffset({ x: rect.left, y: rect.top });
        } else if (containerRef.current) {
            containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                console.log('Measured Offset:', { pageX, pageY, width, height }); // DEBUG
                setOffset({ x: pageX, y: pageY });
            });
        }
    };

    // Update offset when screen dimensions change or on mount
    useEffect(() => {
        updateOffset();
        // Optional: Add resize listener for web
        if (Platform.OS === 'web') {
            window.addEventListener('resize', updateOffset);
            return () => window.removeEventListener('resize', updateOffset);
        }
    }, []);

    // Ref for center to avoid closure staleness in PanResponder
    const centerRef = useRef({ x: 0, y: 0 });

    const panResponderRobust = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { pageX, pageY } = evt.nativeEvent;

                let localX = pageX;
                let localY = pageY;

                // On Native, we need to account for the container offset because the overlay is absolute relative to the container.
                // On Web, we use position: fixed, so the overlay is relative to the viewport (0,0), matching pageX/Y.
                if (Platform.OS !== 'web') {
                    localX = pageX - offset.x;
                    localY = pageY - offset.y;
                }

                centerRef.current = { x: localX, y: localY };
                setCenter({ x: localX, y: localY });
                setDrag({ x: localX, y: localY });
                setIsActive(true);
                setIntensities({ Insightful: 0, Joy: 0, Fire: 0, Support: 0, Shock: 0, Questionable: 0 });
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
            },
            onPanResponderTerminate: () => {
                setIsActive(false);
            },
        })
    ).current;


    return (
        <View
            style={styles.container}
            ref={containerRef}
            onLayout={updateOffset} // Capture offset on layout
            collapsable={false} // Ensure view is not optimized away for measurement
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Beta Testing Lab</Text>
                    <TouchableOpacity onPress={() => onBack ? onBack() : Platform.OS === 'web' ? window.history.back() : null} style={styles.exitBtn}>
                        <X size={24} color={COLORS.node.muted} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.subtitle}>Pure React Native Radial Menu</Text>

                <View style={styles.playground}>
                    <View
                        style={styles.triggerWrapper}
                        {...panResponderRobust.panHandlers}
                    >
                        <TouchableOpacity activeOpacity={0.8} style={styles.triggerBtn}>
                            <Hexagon size={20} color={COLORS.node.accent} />
                            <Text style={styles.triggerText}>Vibe Check</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Live Log */}
                <View style={styles.logContainer}>
                    <Text style={styles.logTitle}>Live Intensity Log:</Text>
                    {Object.entries(intensities).map(([key, val]) => (
                        <View key={key} style={styles.logRow}>
                            <Text style={styles.logLabel}>{key}</Text>
                            <View style={styles.barBg}>
                                <View style={[styles.barFill, { width: `${val}%`, backgroundColor: VIBES.find(v => v.id === key)?.color }]} />
                            </View>
                            <Text style={styles.logValue}>{Math.round(val)}%</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* OVERLAY */}
            {isActive && (
                <View style={[styles.overlay, { pointerEvents: 'none' }]}>
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
                            const startOffset = -Math.PI / 2 - sliceAngle / 2;
                            const startAngle = index * sliceAngle + startOffset;
                            const endAngle = startAngle + sliceAngle;

                            const intensity = intensities[vibe.id];
                            const isActiveWedge = intensity > 0;

                            // Calculate radii
                            const currentOuterRadius = MIN_RADIUS + ((MAX_RADIUS - MIN_RADIUS) * (intensity / 100));

                            // Paths
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
                            const startOffset = -Math.PI / 2 - sliceAngle / 2;
                            const startAngle = index * sliceAngle + startOffset;
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

                    {/* Icons Layer (Absolute Views on top of SVG) */}
                    {VIBES.map((vibe, index) => {
                        const sliceAngle = (2 * Math.PI) / NUM_REACTIONS;
                        const startOffset = -Math.PI / 2 - sliceAngle / 2;
                        const startAngle = index * sliceAngle + startOffset;
                        const midAngle = startAngle + sliceAngle / 2;

                        const intensity = intensities[vibe.id];
                        // FIXED: Keep icon in the middle of the track
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
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.node.bg,
        paddingTop: 60,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        padding: 20,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    exitBtn: {
        padding: 8,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.node.muted,
        marginBottom: 40,
    },
    playground: {
        height: 300,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    triggerWrapper: {
        // We apply PanResponder here
    },
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
    logContainer: {
        width: '100%',
        backgroundColor: COLORS.node.panel,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    logTitle: {
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: 12,
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    logLabel: {
        width: 80,
        color: COLORS.node.muted,
        fontSize: 12,
    },
    barBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#1e2128',
        borderRadius: 3,
        marginRight: 12,
    },
    barFill: {
        height: '100%',
        borderRadius: 3,
    },
    logValue: {
        width: 40,
        color: '#fff',
        fontSize: 12,
        textAlign: 'right',
        fontFamily: 'monospace',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
        // @ts-ignore - 'fixed' is valid for React Native Web but not typed in standard RN
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
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
