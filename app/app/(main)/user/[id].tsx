import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileScreen } from '../../../src/screens/ProfileScreen';

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) return null;

  return (
    <ProfileScreen
      userId={id}
      onBack={() => router.back()}
      onCredClick={() => router.push('/cred-history')}
      onViewTrustGraph={() => router.push('/governance')}
    />
  );
}
