import { Platform, useWindowDimensions, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, Compass, Bell, User, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../src/hooks/useTheme';
import { useModalStore } from '../../../src/store/modal';

export default function TabsLayout() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 1024;

  // On web, safe area insets often report 0 — use a generous fallback
  const bottomPadding = Platform.OS === 'web'
    ? Math.max(insets.bottom, 16)
    : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isDesktop
          ? { display: 'none' }
          : {
              backgroundColor: theme.bg,
              borderTopColor: theme.border,
              borderTopWidth: StyleSheet.hairlineWidth,
              paddingBottom: bottomPadding,
            },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discovery"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            useModalStore.getState().openCreatePost();
          },
        }}
        options={{
          title: '',
          tabBarAccessibilityLabel: 'Create new post',
          tabBarIcon: () => (
            <View style={[styles.createButton, { backgroundColor: theme.accent }]}>
              <Plus size={20} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0px 2px 6px rgba(99, 102, 241, 0.35)',
  },
});
