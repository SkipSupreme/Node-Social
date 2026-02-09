import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { FollowingScreen } from '../../src/screens/FollowingScreen';

export default function FollowingRoute() {
  const router = useRouter();

  const handleBack = useCallback(() => router.back(), [router]);
  const handlePostClick = useCallback(
    (post: { id: string }) => router.push(`/post/${post.id}` as any),
    [router]
  );

  return (
    <FollowingScreen
      onBack={handleBack}
      onPostClick={handlePostClick}
    />
  );
}
