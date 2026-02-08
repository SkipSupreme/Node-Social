import { useRouter } from 'expo-router';
import { ThemesScreen } from '../../../src/screens/ThemesScreen';

export default function ThemesRoute() {
  const router = useRouter();

  return (
    <ThemesScreen
      onBack={() => router.back()}
      onEditTheme={() => router.push('/settings/theme-editor')}
    />
  );
}
