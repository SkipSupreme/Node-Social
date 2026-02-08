import { useLocalSearchParams, useRouter } from 'expo-router';
import { PostDetailScreen } from '../../../src/screens/PostDetailScreen';

export default function PostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) return null;

  return (
    <PostDetailScreen
      postId={id}
      onBack={() => router.back()}
      onAuthorClick={(authorId) => router.push(`/user/${authorId}`)}
    />
  );
}
