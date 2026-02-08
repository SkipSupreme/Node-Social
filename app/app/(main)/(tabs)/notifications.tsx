import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { useAuthPrompt } from '../../../src/context/AuthPromptContext';
import { useAuthStore } from '../../../src/store/auth';

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const { requireAuth } = useAuthPrompt();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    requireAuth('Sign in to view your notifications');
  }, []);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted, fontSize: 16 }}>Sign in to see notifications</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 18 }}>Notifications</Text>
      <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8 }}>Your activity updates</Text>
    </View>
  );
}
