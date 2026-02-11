// Dummy route for the Create Post tab.
// The tab press is intercepted in _layout.tsx to open CreatePostModal —
// this file exists only because Expo Router requires a route file per tab.
import { View } from 'react-native';

export default function CreateScreen() {
  return <View />;
}
