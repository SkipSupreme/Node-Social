import React, { useRef, useState, useMemo } from 'react';
import { View, StyleSheet, PanResponder, Dimensions, Text } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { VECTORS, VECTOR_COLORS, VECTOR_ICONS, VibeVectorType } from '../constants/vibes';

interface RadialWheelProps {
    size?: number;
    onComplete: (intensities: { [key: string]: number }) => void;
    onCancel: () => void;
    initialIntensities?: { [key: string]: number };
}

export const RadialWheel: React.FC<RadialWheelProps> = ({
    size = 300,
    onComplete,
    onCancel,
    initialIntensities = {},
}) => {
    const [activeVector, setActiveVector] = useState<VibeVectorType | null>(null);
    const [intensity, setIntensity] = useState(0);
    const [intensities, setIntensities] = useState<{ [key: string]: number }>(initialIntensities);

    const center = size / 2;
    const radius = size / 2;
    const innerRadius = 40;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt, gestureState) => {
                // Initial touch
                handleGesture(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
            },
            onPanResponderMove: (evt, gestureState) => {
                // Dragging
                handleGesture(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
            },
            onPanResponderRelease: () => {
                // Release - commit if active
                if (activeVector && intensity > 0) {
                    const newIntensities = { ...intensities, [activeVector]: intensity };
                    setIntensities(newIntensities);
                    onComplete(newIntensities);
                } else {
                    onCancel();
                }
                setActiveVector(null);
                setIntensity(0);
            },
        })
    ).current;

    const handleGesture = (x: number, y: number) => {
        const dx = x - center;
        const dy = y - center;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalize angle to 0-360, starting from top (active vector calculation)
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        angle = angle + 90; // Rotate so 0 is top
        if (angle < 0) angle += 360;

        // Determine vector
        const sliceAngle = 360 / VECTORS.length;
        const index = Math.floor(angle / sliceAngle) % VECTORS.length;
        const vector = VECTORS[index];

        // Determine intensity based on distance
        // 0 at innerRadius, 1 at radius
        let newIntensity = 0;
        if (distance > innerRadius) {
            newIntensity = Math.min(1, (distance - innerRadius) / (radius - innerRadius));
        }

        setActiveVector(vector);
        setIntensity(newIntensity);
    };

    const createSlicePath = (startAngle: number, endAngle: number, r: number, ir: number) => {
        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = center + r * Math.cos(startRad);
        const y1 = center + r * Math.sin(startRad);
        const x2 = center + r * Math.cos(endRad);
        const y2 = center + r * Math.sin(endRad);

        const x3 = center + ir * Math.cos(endRad);
        const y3 = center + ir * Math.sin(endRad);
        const x4 = center + ir * Math.cos(startRad);
        const y4 = center + ir * Math.sin(startRad);

        return `M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} L${x3},${y3} A${ir},${ir} 0 0,0 ${x4},${y4} Z`;
    };

    return (
        <View style={{ width: size, height: size }} {...panResponder.panHandlers}>
            <Svg width={size} height={size}>
                {/* Background Circle */}
                <Circle cx={center} cy={center} r={radius} fill="#1a1a1a" opacity={0.8} />

                {/* Slices */}
                {VECTORS.map((vector, i) => {
                    const startAngle = i * (360 / VECTORS.length);
                    const endAngle = (i + 1) * (360 / VECTORS.length);
                    const isActive = activeVector === vector;
                    const currentIntensity = isActive ? intensity : (intensities[vector] || 0);

                    // Calculate color opacity based on intensity
                    const color = VECTOR_COLORS[vector];
                    const opacity = 0.3 + (currentIntensity * 0.7);

                    // Icon position
                    const midAngle = (startAngle + endAngle) / 2;
                    const iconRad = (midAngle - 90) * (Math.PI / 180);
                    const iconDist = innerRadius + (radius - innerRadius) * 0.6;
                    const iconX = center + iconDist * Math.cos(iconRad);
                    const iconY = center + iconDist * Math.sin(iconRad);

                    return (
                        <G key={vector}>
                            <Path
                                d={createSlicePath(startAngle, endAngle, radius, innerRadius)}
                                fill={color}
                                fillOpacity={opacity}
                                stroke={isActive ? '#fff' : 'none'}
                                strokeWidth={2}
                            />
                            <SvgText
                                x={iconX}
                                y={iconY}
                                fill="#fff"
                                fontSize="24"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                            >
                                {VECTOR_ICONS[vector]}
                            </SvgText>
                            {currentIntensity > 0 && (
                                <SvgText
                                    x={iconX}
                                    y={iconY + 20}
                                    fill="#fff"
                                    fontSize="12"
                                    textAnchor="middle"
                                    alignmentBaseline="middle"
                                    fontWeight="bold"
                                >
                                    {Math.round(currentIntensity * 100)}%
                                </SvgText>
                            )}
                        </G>
                    );
                })}

                {/* Center Hub */}
                <Circle cx={center} cy={center} r={innerRadius} fill="#000" />
                <SvgText
                    x={center}
                    y={center}
                    fill="#fff"
                    fontSize="12"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                >
                    {activeVector ? activeVector.toUpperCase() : 'VIBE'}
                </SvgText>
            </Svg>
        </View>
    );
};
