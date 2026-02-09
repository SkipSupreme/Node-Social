import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SettingsScreen } from '../../../src/screens/SettingsScreen';
import { useAuthStore } from '../../../src/store/auth';

export default function SettingsRoute() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const handleBack = useCallback(() => router.back(), [router]);
  const handleNavigate = useCallback(
    (screen: string) => router.push(`/settings/${screen}` as any),
    [router]
  );
  const handleUserUpdate = useCallback(
    (updatedUser: any) => { useAuthStore.setState({ user: updatedUser }); },
    []
  );

  return (
    <SettingsScreen
      onBack={handleBack}
      onNavigate={handleNavigate}
      user={user ?? undefined}
      onUserUpdate={handleUserUpdate}
    />
  );
}
