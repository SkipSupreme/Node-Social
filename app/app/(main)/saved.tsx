import { useRouter } from 'expo-router';
import { SavedPostsScreen } from '../../src/screens/SavedPostsScreen';

export default function SavedRoute() {
  const router = useRouter();

  return (
    <SavedPostsScreen
      onBack={() => router.back()}
      onPostClick={(post) => router.push(`/post/${post.id}`)}
      onAuthorClick={(authorId) => router.push(`/user/${authorId}`)}
    />
  );
}
