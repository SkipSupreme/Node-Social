import { useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, Compass, Bell, User } from 'lucide-react-native';
import { useAppTheme } from '../../../src/hooks/useTheme';

export default function TabsLayout() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isDesktop
          ? { display: 'none' }
          : {
              backgroundColor: theme.bg,
              borderTopColor: theme.border,
              borderTopWidth: 1,
            },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
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
