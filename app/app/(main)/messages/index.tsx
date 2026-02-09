import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { MessagesScreen } from '../../../src/screens/MessagesScreen';

export default function MessagesRoute() {
  const router = useRouter();

  const handleBack = useCallback(() => router.back(), [router]);
  const handleNavigate = useCallback(
    (screen: string, params: { conversationId?: string }) => {
      if (screen === 'chat' && params.conversationId) {
        router.push(`/messages/${params.conversationId}` as any);
      }
    },
    [router]
  );

  return (
    <MessagesScreen
      onBack={handleBack}
      onNavigate={handleNavigate}
    />
  );
}
