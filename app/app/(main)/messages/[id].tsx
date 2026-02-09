import { useMemo, useCallback } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChatScreen } from '../../../src/screens/ChatScreen';
import { getConversations } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/store/auth';
import { useAppTheme } from '../../../src/hooks/useTheme';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const theme = useAppTheme();

  // Reuse cached conversations query to get recipient info
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 30_000,
  });

  const otherParticipant = useMemo(() => {
    const conversation = conversations?.find((c) => c.id === id);
    if (!conversation) return undefined;
    return conversation.participants.find(
      (p) => p.userId !== user?.id
    )?.user ?? conversation.participants[0]?.user;
  }, [conversations, id, user?.id]);

  const handleBack = useCallback(() => router.back(), [router]);

  if (!id || !UUID_RE.test(id)) {
    router.back();
    return null;
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!otherParticipant) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>Conversation not found</Text>
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
      onBack={handleBack}
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
