import { useLocalSearchParams, useRouter } from 'expo-router';
import { NodeSettingsScreen } from '../../../../src/screens/NodeSettingsScreen';

export default function NodeSettingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) return null;

  return (
    <NodeSettingsScreen
      nodeId={id}
      onBack={() => router.back()}
    />
  );
}
