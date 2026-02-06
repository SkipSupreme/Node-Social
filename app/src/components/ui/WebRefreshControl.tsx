// Web-compatible pull-to-refresh wrapper
// RefreshControl only works on iOS/Android, this provides the same UX for web
import React, { useState, useRef, useCallback } from 'react';
import { View, Animated, StyleSheet, Platform, PanResponder } from 'react-native';
import { RefreshCw } from './Icons';
import { COLORS } from '../../constants/theme';

interface WebRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 80; // How far to pull before triggering refresh
const MAX_PULL = 120; // Maximum pull distance

export const WebRefreshControl: React.FC<WebRefreshControlProps> = ({
  refreshing,
  onRefresh,
  children,
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const pullDistance = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<View>(null);
  const startY = useRef(0);
  const isAtTop = useRef(true);

  // Rotation animation for the refresh icon
  const rotation = pullDistance.interpolate({
    inputRange: [0, PULL_THRESHOLD],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });

  const opacity = pullDistance.interpolate({
    inputRange: [0, PULL_THRESHOLD / 2, PULL_THRESHOLD],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const handleTouchStart = useCallback((e: any) => {
    if (refreshing) return;
    startY.current = e.nativeEvent.pageY || e.nativeEvent.touches?.[0]?.pageY || 0;
    // Check if we're at the top of the scroll
    isAtTop.current = true; // We'll update this on scroll
  }, [refreshing]);

  const handleTouchMove = useCallback((e: any) => {
    if (refreshing || !isAtTop.current) return;

    const currentY = e.nativeEvent.pageY || e.nativeEvent.touches?.[0]?.pageY || 0;
    const diff = currentY - startY.current;

    if (diff > 0) {
      setIsPulling(true);
      const dampedDiff = Math.min(diff * 0.5, MAX_PULL);
      pullDistance.setValue(dampedDiff);
    }
  }, [refreshing, pullDistance]);

  const handleTouchEnd = useCallback(() => {
    if (refreshing) return;

    pullDistance.flattenOffset();

    // Check if we pulled enough to trigger refresh
    // @ts-ignore - accessing internal value
    const currentValue = pullDistance._value || 0;

    if (currentValue >= PULL_THRESHOLD) {
      // Trigger refresh
      onRefresh();
    }

    // Animate back
    Animated.spring(pullDistance, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 7,
    }).start(() => {
      setIsPulling(false);
    });
  }, [refreshing, pullDistance, onRefresh]);

  const handleScroll = useCallback((e: any) => {
    const scrollTop = e.nativeEvent?.contentOffset?.y || 0;
    isAtTop.current = scrollTop <= 0;
  }, []);

  // Only use custom pull-to-refresh on web
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <Animated.View
        style={[
          styles.pullIndicator,
          {
            opacity: refreshing ? 1 : opacity,
            transform: [
              { translateY: Animated.subtract(pullDistance, 40) },
              { rotate: refreshing ? '0deg' : rotation },
            ],
          },
        ]}
      >
        <Animated.View style={refreshing ? styles.spinning : undefined}>
          <RefreshCw size={24} color={COLORS.node.accent} />
        </Animated.View>
      </Animated.View>

      {/* Content with pull transform */}
      <Animated.View
        style={[
          styles.content,
          isPulling || refreshing ? {
            transform: [{ translateY: refreshing ? 40 : pullDistance }],
          } : undefined,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  pullIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    flex: 1,
  },
  spinning: {
    // CSS animation for spinning would go here but RN doesn't support it directly
    // We'll handle this differently
  },
});

export default WebRefreshControl;
