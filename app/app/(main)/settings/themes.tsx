import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ThemesScreen } from '../../../src/screens/ThemesScreen';

export default function ThemesRoute() {
  const router = useRouter();

  const handleBack = useCallback(() => router.back(), [router]);
  const handleEditTheme = useCallback(() => router.push('/settings/theme-editor' as any), [router]);

  return (
    <ThemesScreen
      onBack={handleBack}
      onEditTheme={handleEditTheme}
    />
  );
}
