import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SavedPostsScreen } from '../../src/screens/SavedPostsScreen';

export default function SavedRoute() {
  const router = useRouter();

  const handleBack = useCallback(() => router.back(), [router]);
  const handlePostClick = useCallback(
    (post: { id: string }) => router.push(`/post/${post.id}` as any),
    [router]
  );
  const handleAuthorClick = useCallback(
    (authorId: string) => router.push(`/user/${authorId}` as any),
    [router]
  );

  return (
    <SavedPostsScreen
      onBack={handleBack}
      onPostClick={handlePostClick}
      onAuthorClick={handleAuthorClick}
    />
  );
}
