import { useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { useAuthPrompt } from '../../../src/context/AuthPromptContext';
import { useAuthStore } from '../../../src/store/auth';
import { NotificationsScreen } from '../../../src/screens/NotificationsScreen';

export default function NotificationsTab() {
  const theme = useAppTheme();
  const router = useRouter();
  const { requireAuth } = useAuthPrompt();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    requireAuth('Sign in to view your notifications');
  }, []);

  const handleNavigateToPost = useCallback(
    (postId: string) => {
      router.push(`/post/${postId}` as any);
    },
    [router]
  );

  const handleNavigateToUser = useCallback(
    (userId: string) => {
      router.push(`/user/${userId}` as any);
    },
    [router]
  );

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.muted, fontSize: 16 }}>Sign in to see notifications</Text>
      </View>
    );
  }

  return (
    <NotificationsScreen
      onBack={() => router.back()}
      onNavigateToPost={handleNavigateToPost}
      onNavigateToUser={handleNavigateToUser}
    />
  );
}
