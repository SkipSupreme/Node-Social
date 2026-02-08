import { useRouter } from 'expo-router';
import { FollowingScreen } from '../../src/screens/FollowingScreen';

export default function FollowingRoute() {
  const router = useRouter();

  return (
    <FollowingScreen
      onBack={() => router.back()}
      onPostClick={(post) => router.push(`/post/${post.id}`)}
    />
  );
}
