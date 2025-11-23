
import React, { useRef, useState } from 'react';
import { View, PanResponder, Text, Modal, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Circle, G, Line } from 'react-native-svg';
import { Hexagon, Lightbulb, Smile, Skull, Sparkles } from './Icons';
import { COLORS } from '../../constants/theme';

const BUTTON_RADIUS = 30;
const INTENSITY_MIN_RADIUS = 60;
const INTENSITY_MAX_RADIUS = 140;

// --- Math Helpers ---
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInRadians: number) {
    const x = centerX + radius * Math.cos(angleInRadians);
    const y = centerY + radius * Math.sin(angleInRadians);
    return { x, y };
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

const VIBES = [
    { id: 'Funny', icon: Smile, label: 'Funny', color: COLORS.vibe.funny },
    { id: 'Insightful', icon: Lightbulb, label: 'Insightful', color: COLORS.vibe.insightful },
    { id: 'Cursed', icon: Skull, label: 'Cursed', color: COLORS.vibe.cursed },
    { id: 'Novel', icon: Sparkles, label: 'Novel', color: COLORS.vibe.novel },
];
const NUM_REACTIONS = VIBES.length;

export const RadialMenu = ({ onComplete }: { onComplete: (results: Record<string, number>) => void }) => {
    const [isActive, setIsActive] = useState(false);
    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [drag, setDrag] = useState({ x: 0, y: 0 });
    const [intensities, setIntensities] = useState<Record<string, number>>({
        Funny: 0, Insightful: 0, Cursed: 0, Novel: 0
    });

    const updateGesture = (pageX: number, pageY: number) => {
        setDrag({ x: pageX, y: pageY });
        const dx = pageX - center.x;
        const dy = pageY - center.y;
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
        if (distance > INTENSITY_MIN_RADIUS) {
            const raw = (distance - INTENSITY_MIN_RADIUS) / (INTENSITY_MAX_RADIUS - INTENSITY_MIN_RADIUS);
            newIntensity = Math.max(0, Math.min(raw * 100, 100));
        }

        setIntensities(prev => ({ ...prev, [activeVibeId]: newIntensity }));
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { pageX, pageY } = evt.nativeEvent;
                setCenter({ x: pageX, y: pageY });
                setDrag({ x: pageX, y: pageY });
                setIsActive(true);
                setIntensities({ Funny: 0, Insightful: 0, Cursed: 0, Novel: 0 });
            },
            onPanResponderMove: (evt) => updateGesture(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
            onPanResponderRelease: () => {
                setIsActive(false);
                onComplete(intensities);
            },
            onPanResponderTerminate: () => setIsActive(false),
        })
    ).current;

    return (
        <>
            <View
                {...panResponder.panHandlers}
                style={styles.triggerBtn}
            >
                <Hexagon size={20} color={COLORS.node.accent} />
                <Text style={styles.triggerText}>Vibe Check</Text>
            </View>

            <Modal visible={isActive} transparent animationType="none" statusBarTranslucent>
                <View style={styles.overlay}>
                    <Svg style={StyleSheet.absoluteFill}>
                        <Line
                            x1={center.x} y1={center.y}
                            x2={drag.x} y2={drag.y}
                            stroke={COLORS.node.accent} strokeWidth="2" strokeDasharray="4,4"
                        />
                        <G x={center.x} y={center.y}>
                            <Circle r={BUTTON_RADIUS} fill={COLORS.node.panel} stroke={COLORS.node.border} strokeWidth={2} />
                            {VIBES.map((vibe, index) => {
                                const sliceAngle = (2 * Math.PI) / NUM_REACTIONS;
                                const startOffset = -Math.PI / 2 - sliceAngle / 2;
                                const startAngle = index * sliceAngle + startOffset;
                                const endAngle = (index + 1) * sliceAngle + startOffset;

                                const intensity = intensities[vibe.id];
                                const outerRadius = INTENSITY_MIN_RADIUS + ((INTENSITY_MAX_RADIUS - INTENSITY_MIN_RADIUS) * (intensity / 100));

                                const trackPath = describeWedge(0, 0, INTENSITY_MIN_RADIUS, INTENSITY_MAX_RADIUS, startAngle, endAngle);
                                const activePath = describeWedge(0, 0, INTENSITY_MIN_RADIUS, outerRadius, startAngle, endAngle);

                                return (
                                    <G key={vibe.id}>
                                        <Path d={trackPath} fill="#1e2128" stroke="#2a2d35" strokeWidth={1} />
                                        {intensity > 0 && <Path d={activePath} fill={vibe.color} fillOpacity={0.9} />}
                                    </G>
                                );
                            })}
                        </G>
                    </Svg>

                    {/* Floating Icons Overlay - Uses Absolute Positioning for sharpness */}
                    {isActive && VIBES.map((vibe, index) => {
                        const sliceAngle = (2 * Math.PI) / NUM_REACTIONS;
                        const startOffset = -Math.PI / 2 - sliceAngle / 2;
                        const startAngle = index * sliceAngle + startOffset;
                        const midAngle = startAngle + sliceAngle / 2;

                        const intensity = intensities[vibe.id];
                        const currentIconRadius = 100 + (intensity * 0.2);
                        const pos = polarToCartesian(center.x, center.y, currentIconRadius, midAngle);
                        const Icon = vibe.icon;

                        return (
                            <View
                                key={vibe.id}
                                style={[
                                    styles.floatingIcon,
                                    { left: pos.x - 12, top: pos.y - 12 },
                                    intensity > 0 && { transform: [{ scale: 1.2 }] }
                                ]}
                            >
                                <Icon size={24} color={intensity > 0 ? '#fff' : '#6b7280'} />
                                {intensity > 0 && (
                                    <Text style={styles.intensityLabel}>{Math.round(intensity)}%</Text>
                                )}
                            </View>
                        )
                    })}
                </View>
            </Modal>
        </>
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
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    triggerText: {
        color: COLORS.node.muted,
        fontSize: 14,
        fontWeight: '500',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    floatingIcon: {
        position: 'absolute',
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99
    },
    intensityLabel: {
        position: 'absolute',
        top: 24,
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2
    }
});
