// Skeleton loading placeholder for posts
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from '../../constants/theme';

// Shimmer animation component
const ShimmerBlock = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View style={[styles.shimmerContainer, { width, height }, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

export const SkeletonPostCard: React.FC = () => {
  return (
    <View style={styles.card}>
      {/* Header: Avatar + Name */}
      <View style={styles.header}>
        <ShimmerBlock width={40} height={40} style={styles.avatar} />
        <View style={styles.headerText}>
          <ShimmerBlock width={120} height={14} style={styles.name} />
          <ShimmerBlock width={80} height={12} style={styles.username} />
        </View>
        <ShimmerBlock width={40} height={12} style={styles.timestamp} />
      </View>

      {/* Content lines */}
      <View style={styles.content}>
        <ShimmerBlock width="100%" height={14} style={styles.line} />
        <ShimmerBlock width="90%" height={14} style={styles.line} />
        <ShimmerBlock width="75%" height={14} style={styles.line} />
      </View>

      {/* Action bar */}
      <View style={styles.actions}>
        <ShimmerBlock width={50} height={20} style={styles.action} />
        <ShimmerBlock width={50} height={20} style={styles.action} />
        <ShimmerBlock width={50} height={20} style={styles.action} />
      </View>
    </View>
  );
};

// Multiple skeleton cards for feed loading state
export const SkeletonFeed: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <View style={styles.feed}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPostCard key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  feed: {
    padding: 8,
  },
  card: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    borderRadius: 20,
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
  name: {
    borderRadius: 4,
    marginBottom: 4,
  },
  username: {
    borderRadius: 4,
  },
  timestamp: {
    borderRadius: 4,
  },
  content: {
    marginBottom: 12,
  },
  line: {
    borderRadius: 4,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
  },
  action: {
    borderRadius: 4,
  },
  shimmerContainer: {
    backgroundColor: COLORS.node.bgAlt,
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});

export default SkeletonPostCard;
