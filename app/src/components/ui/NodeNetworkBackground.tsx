// src/components/ui/NodeNetworkBackground.tsx
import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Line, G } from "react-native-svg";
import { COLORS } from "../../constants/theme";

// Torus parameters
const MAJOR_RADIUS = 1; // Distance from center to tube center
const MINOR_RADIUS = 0.4; // Radius of the tube

// Generate points on a torus surface
const generateTorusPoints = (
  majorSegments: number,
  minorSegments: number
): { x: number; y: number; z: number; u: number; v: number }[] => {
  const points: { x: number; y: number; z: number; u: number; v: number }[] = [];

  for (let i = 0; i < majorSegments; i++) {
    const u = (i / majorSegments) * Math.PI * 2;
    for (let j = 0; j < minorSegments; j++) {
      const v = (j / minorSegments) * Math.PI * 2;

      const x = (MAJOR_RADIUS + MINOR_RADIUS * Math.cos(v)) * Math.cos(u);
      const y = (MAJOR_RADIUS + MINOR_RADIUS * Math.cos(v)) * Math.sin(u);
      const z = MINOR_RADIUS * Math.sin(v);

      points.push({ x, y, z, u, v });
    }
  }

  return points;
};

// Generate edges connecting adjacent points on the torus grid
const generateTorusEdges = (
  majorSegments: number,
  minorSegments: number
): [number, number][] => {
  const edges: [number, number][] = [];

  for (let i = 0; i < majorSegments; i++) {
    for (let j = 0; j < minorSegments; j++) {
      const current = i * minorSegments + j;
      const nextMajor = ((i + 1) % majorSegments) * minorSegments + j;
      const nextMinor = i * minorSegments + ((j + 1) % minorSegments);

      // Connect to next point around major circle
      edges.push([current, nextMajor]);
      // Connect to next point around minor circle
      edges.push([current, nextMinor]);
    }
  }

  return edges;
};

// Torus configuration
const MAJOR_SEGMENTS = 16;
const MINOR_SEGMENTS = 10;
const TORUS_POINTS = generateTorusPoints(MAJOR_SEGMENTS, MINOR_SEGMENTS);
const TORUS_EDGES = generateTorusEdges(MAJOR_SEGMENTS, MINOR_SEGMENTS);

export const NodeNetworkBackground: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.9)).current;

  const torusSize = Math.min(width, height) * 0.35;
  const centerX = width / 2;
  const centerY = height / 2;

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    rotateLoop.start();
    pulseLoop.start();

    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  const project3D = (
    vertex: { x: number; y: number; z: number },
    spinAngle: number
  ) => {
    // Spin around Z axis (like a wheel spinning face-on)
    const cosZ = Math.cos(spinAngle);
    const sinZ = Math.sin(spinAngle);
    const spunX = vertex.x * cosZ - vertex.y * sinZ;
    const spunY = vertex.x * sinZ + vertex.y * cosZ;

    // Tilt slightly around X axis so we see some depth (not perfectly flat)
    const tilt = Math.PI * 0.15; // ~27 degree tilt
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const tiltedY = spunY * cosT - vertex.z * sinT;
    const tiltedZ = spunY * sinT + vertex.z * cosT;

    // Perspective projection
    const perspective = 3;
    const scale = perspective / (perspective + tiltedZ * 0.5);

    return {
      x: centerX + spunX * torusSize * scale,
      y: centerY + tiltedY * torusSize * scale,
      z: tiltedZ,
      scale,
    };
  };

  const [rotation, setRotation] = React.useState(0);
  const [opacity, setOpacity] = React.useState(0.9);

  useEffect(() => {
    const listener = rotationAnim.addListener(({ value }) => {
      setRotation(value * Math.PI * 2);
    });
    return () => rotationAnim.removeListener(listener);
  }, [rotationAnim]);

  useEffect(() => {
    const listener = pulseAnim.addListener(({ value }) => {
      setOpacity(value);
    });
    return () => pulseAnim.removeListener(listener);
  }, [pulseAnim]);

  // Project all torus points
  const projectedPoints = useMemo(() => {
    return TORUS_POINTS.map((p, i) => ({
      ...project3D(p, rotation),
      index: i,
    }));
  }, [rotation, centerX, centerY, torusSize]);

  const dotSize = 3;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <G opacity={opacity}>
          {/* Draw edges first (behind dots) */}
          {TORUS_EDGES.map(([from, to], i) => {
            const p1 = projectedPoints[from];
            const p2 = projectedPoints[to];
            const avgZ = (p1.z + p2.z) / 2;
            const lineOpacity = 0.15 + (1 - avgZ) * 0.25;

            return (
              <Line
                key={`edge-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="rgba(255, 255, 255, 0.6)"
                strokeWidth={0.5}
                opacity={lineOpacity}
              />
            );
          })}

          {/* Draw dots sorted by z-depth */}
          {projectedPoints
            .slice()
            .sort((a, b) => a.z - b.z)
            .map((p) => {
              const dotOpacity = 0.4 + (1 - p.z) * 0.6;
              const scaledSize = dotSize * p.scale;

              return (
                <Circle
                  key={`dot-${p.index}`}
                  cx={p.x}
                  cy={p.y}
                  r={scaledSize}
                  fill={COLORS.node.accent}
                  opacity={dotOpacity}
                />
              );
            })}
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

export default NodeNetworkBackground;
