// Jest setup file for React Native Testing Library
// Note: @testing-library/react-native v12.4+ has built-in matchers

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => insets,
  };
});

// Mock @react-native-community/slider
jest.mock('@react-native-community/slider', () => 'Slider');

// Mock react-native-youtube-iframe
jest.mock('react-native-youtube-iframe', () => ({
  default: 'YoutubePlayer',
}));

// Mock react-native-webview
jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

// Mock expo-av
jest.mock('expo-av', () => ({
  Video: 'Video',
  ResizeMode: { CONTAIN: 'contain' },
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

// Silence console warnings in tests (optional, remove if you want to see them)
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('Animated')) return;
  originalWarn(...args);
};
