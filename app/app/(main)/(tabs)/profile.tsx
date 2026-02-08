import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { useAuthPrompt } from '../../../src/context/AuthPromptContext';
import { useAuthStore } from '../../../src/store/auth';

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { requireAuth } = useAuthPrompt();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    requireAuth('Sign in to view your profile');
  }, []);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted, fontSize: 16 }}>Sign in to see your profile</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 18 }}>Profile</Text>
      <Text style={{ color: theme.muted, fontSize: 14, marginTop: 8 }}>{user.username}</Text>
    </View>
  );
}
