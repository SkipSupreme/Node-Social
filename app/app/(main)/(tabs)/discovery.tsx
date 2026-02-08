import { View, Text } from 'react-native';
import { useAppTheme } from '../../../src/hooks/useTheme';

export default function DiscoveryScreen() {
  const theme = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 18 }}>Discovery</Text>
      <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8 }}>Explore new content</Text>
    </View>
  );
}
