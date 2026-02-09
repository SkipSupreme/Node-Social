import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { DiscoveryScreen } from '../../../src/screens/DiscoveryScreen';

export default function DiscoveryTab() {
  const router = useRouter();

  const handlePostClick = useCallback(
    (postOrId: any) => {
      const postId = typeof postOrId === 'string' ? postOrId : postOrId?.id;
      if (postId) router.push(`/post/${postId}` as any);
    },
    [router]
  );

  const handleUserClick = useCallback(
    (userId: string) => {
      router.push(`/user/${userId}` as any);
    },
    [router]
  );

  const handleBack = useCallback(() => router.back(), [router]);

  return (
    <DiscoveryScreen
      onBack={handleBack}
      onPostClick={handlePostClick}
      onUserClick={handleUserClick}
    />
  );
}
