import { useRouter } from 'expo-router';
import { MessagesScreen } from '../../../src/screens/MessagesScreen';

export default function MessagesRoute() {
  const router = useRouter();

  return (
    <MessagesScreen
      onBack={() => router.back()}
      onNavigate={(screen, params) => {
        if (screen === 'chat' && params.conversationId) {
          router.push(`/messages/${params.conversationId}`);
        }
      }}
    />
  );
}
