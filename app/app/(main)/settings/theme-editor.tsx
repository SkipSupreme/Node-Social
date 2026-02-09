import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ThemeEditorScreen } from '../../../src/screens/ThemeEditorScreen';

export default function ThemeEditorRoute() {
  const router = useRouter();

  const handleBack = useCallback(() => router.back(), [router]);

  return (
    <ThemeEditorScreen
      onBack={handleBack}
    />
  );
}
