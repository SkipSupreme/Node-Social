import { useLocalSearchParams, useRouter } from 'expo-router';
import { ModLogScreen } from '../../../../src/screens/ModLogScreen';

export default function ModLogRoute() {
  const { id, nodeName } = useLocalSearchParams<{ id: string; nodeName?: string }>();
  const router = useRouter();

  if (!id) return null;

  return (
    <ModLogScreen
      nodeId={id}
      nodeName={nodeName || 'Community'}
      onBack={() => router.back()}
    />
  );
}
