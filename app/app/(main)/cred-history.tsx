import { useRouter } from 'expo-router';
import { CredHistoryScreen } from '../../src/screens/CredHistoryScreen';

export default function CredHistoryRoute() {
  const router = useRouter();

  return (
    <CredHistoryScreen
      onBack={() => router.back()}
    />
  );
}
