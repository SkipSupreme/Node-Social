import { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { ProfileScreen } from '../../../src/screens/ProfileScreen';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const handleBack = useCallback(() => router.back(), [router]);
  const handleCredClick = useCallback(() => router.push('/cred-history' as any), [router]);
  const handleViewTrustGraph = useCallback(() => router.push('/governance' as any), [router]);

  if (!id || !UUID_RE.test(id)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.muted }}>User not found</Text>
      </View>
    );
  }

  return (
    <ProfileScreen
      userId={id}
      onBack={handleBack}
      onCredClick={handleCredClick}
      onViewTrustGraph={handleViewTrustGraph}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
