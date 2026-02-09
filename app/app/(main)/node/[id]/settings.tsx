import { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../../src/hooks/useTheme';
import { NodeSettingsScreen } from '../../../../src/screens/NodeSettingsScreen';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NodeSettingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const handleBack = useCallback(() => router.back(), [router]);

  if (!id || !UUID_RE.test(id)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.muted }}>Node not found</Text>
      </View>
    );
  }

  return (
    <NodeSettingsScreen
      nodeId={id}
      onBack={handleBack}
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
