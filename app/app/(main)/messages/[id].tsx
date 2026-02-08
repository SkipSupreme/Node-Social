import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChatScreen } from '../../../src/screens/ChatScreen';
import { getConversations } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/store/auth';
import { useAppTheme } from '../../../src/hooks/useTheme';

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const theme = useAppTheme();

  // Reuse cached conversations query to get recipient info
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 30_000,
  });

  const conversation = conversations?.find((c) => c.id === id);
  // Find the other participant (not the current user)
  const otherParticipant = conversation?.participants.find(
    (p) => p.userId !== user?.id
  )?.user ?? conversation?.participants[0]?.user;

  if (!id || isLoading || !otherParticipant) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ChatScreen
      conversationId={id}
      recipient={{
        id: otherParticipant.id,
        username: otherParticipant.username,
        avatar: otherParticipant.avatar,
      }}
      onBack={() => router.back()}
    />
  );
}
