import { useRouter } from 'expo-router';
import { ThemeEditorScreen } from '../../../src/screens/ThemeEditorScreen';

export default function ThemeEditorRoute() {
  const router = useRouter();

  return (
    <ThemeEditorScreen
      onBack={() => router.back()}
    />
  );
}
