import { useRouter } from 'expo-router';
import { SettingsScreen } from '../../../src/screens/SettingsScreen';
import { useAuthStore } from '../../../src/store/auth';

export default function SettingsRoute() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <SettingsScreen
      onBack={() => router.back()}
      onNavigate={(screen) => router.push(`/settings/${screen}`)}
      user={user ?? undefined}
      onUserUpdate={(updatedUser) => {
        useAuthStore.setState({ user: updatedUser });
      }}
    />
  );
}
