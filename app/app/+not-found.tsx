import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../src/hooks/useTheme';

export default function NotFound() {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '600', marginBottom: 8 }}>
        Page Not Found
      </Text>
      <Text style={{ color: theme.muted, fontSize: 14, marginBottom: 24, textAlign: 'center' }}>
        The page you're looking for doesn't exist.
      </Text>
      <Pressable
        style={{ backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        onPress={() => router.replace('/')}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Go Home</Text>
      </Pressable>
    </View>
  );
}
