// Phase 8 - Responsive Hook
// Detects screen size and switches between mobile/desktop layouts

import { useState, useEffect } from 'react';
import { Dimensions, Platform, ScaledSize } from 'react-native';

const MOBILE_BREAKPOINT = 768; // Below 768px = mobile, above = desktop

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

export const useResponsive = (): ResponsiveState => {
  // On native platforms (not web), always return mobile
  if (Platform.OS !== 'web') {
    const { width, height } = Dimensions.get('window');
    return {
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      width,
      height,
    };
  }

  const [dimensions, setDimensions] = useState<ScaledSize>(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const width = dimensions.width;
  const isMobile = width < MOBILE_BREAKPOINT;
  const isTablet = width >= MOBILE_BREAKPOINT && width < 1024;
  const isDesktop = width >= 1024;

  return {
    isMobile,
    isTablet,
    isDesktop,
    width,
    height: dimensions.height,
  };
};

