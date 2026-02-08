import { useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { useAuthPrompt } from '../../../src/context/AuthPromptContext';
import { useAuthStore } from '../../../src/store/auth';
import { ProfileScreen } from '../../../src/screens/ProfileScreen';

export default function ProfileTab() {
  const theme = useAppTheme();
  const router = useRouter();
  const { requireAuth } = useAuthPrompt();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    requireAuth('Sign in to view your profile');
  }, []);

  const handleCredClick = useCallback(() => {
    router.push('/cred-history' as any);
  }, [router]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted, fontSize: 16 }}>Sign in to see your profile</Text>
      </View>
    );
  }

  return (
    <ProfileScreen
      onBack={() => router.back()}
      isEditable
      onCredClick={handleCredClick}
    />
  );
}
