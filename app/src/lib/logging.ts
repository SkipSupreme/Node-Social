// src/lib/logging.ts
// Filter out harmless iOS Simulator warnings

import { LogBox } from "react-native";

/**
 * Suppress known harmless iOS Simulator warnings
 * 
 * Note: These warnings come from native iOS frameworks (UIKit, CoreHaptics)
 * and appear in the Xcode console. They are harmless and expected in the simulator:
 * - UIKeyboardLayoutStar: Keyboard focus caching limitation (cosmetic only)
 * - CoreHaptics: Simulator doesn't have haptic pattern library (expected behavior)
 * 
 * LogBox will filter React Native-level warnings, but native iOS warnings
 * may still appear in Xcode's console. This is normal and can be ignored.
 */
export function setupLoggingFilters() {
  // Suppress UIKit keyboard focus warnings (if they come through React Native)
  LogBox.ignoreLogs([
    /UIKeyboardLayoutStar.*focusItemsInRect/,
    /UIKeyboardLayoutStar.*caching for linear focus movement/,
    /UIKeyboardLayoutStar.*implements focusItemsInRect/,
  ]);

  // Suppress CoreHaptics warnings (simulator doesn't have haptic library)
  LogBox.ignoreLogs([
    /CoreHaptics.*CHHapticPattern/,
    /Failed to read pattern library data/,
    /hapticpatternlibrary\.plist.*couldn't be opened/,
    /_UIKBFeedbackGenerator.*Error creating CHHapticPattern/,
    /CHHapticPattern\.mm.*patternForKey/,
  ]);

  // Filter console.warn for JavaScript-level warnings
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args.join(" ");
    
    // Filter out iOS Simulator warnings
    if (
      message.includes("UIKeyboardLayoutStar") ||
      message.includes("CHHapticPattern") ||
      message.includes("hapticpatternlibrary.plist") ||
      message.includes("_UIKBFeedbackGenerator") ||
      message.includes("CoreHaptics")
    ) {
      return; // Suppress these warnings
    }
    
    // Call original warn for everything else
    originalWarn.apply(console, args);
  };
}

