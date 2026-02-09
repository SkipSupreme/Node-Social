import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { CredHistoryScreen } from '../../src/screens/CredHistoryScreen';

export default function CredHistoryRoute() {
  const router = useRouter();

  const handleBack = useCallback(() => router.back(), [router]);

  return (
    <CredHistoryScreen
      onBack={handleBack}
    />
  );
}
