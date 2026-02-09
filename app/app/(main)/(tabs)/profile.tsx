import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

  const handleBack = useCallback(() => router.back(), [router]);

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>Sign in to see your profile</Text>
      </View>
    );
  }

  return (
    <ProfileScreen
      onBack={handleBack}
      isEditable
      onCredClick={handleCredClick}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
