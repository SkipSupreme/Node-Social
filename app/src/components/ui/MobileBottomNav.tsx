import React, { ComponentType } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Home, Compass, Bell, User, Plus } from 'lucide-react-native';
import { useAppTheme } from '../../hooks/useTheme';

type NavItem = 'feed' | 'discovery' | 'create' | 'notifications' | 'profile';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: NavItem) => void;
  unreadNotifications?: number;
  unreadMessages?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  unreadNotifications = 0,
  unreadMessages = 0,
}) => {
  const theme = useAppTheme();

  const isActive = (view: NavItem) => {
    if (view === 'feed') return currentView === 'feed' || currentView === 'following';
    return currentView === view;
  };

  const NavButton = ({ view, icon: Icon, label }: { view: NavItem; icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; label: string }) => {
    const active = isActive(view);
    return (
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => onNavigate(view)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Icon
            size={24}
            color={active ? theme.accent : theme.muted}
            strokeWidth={active ? 2.5 : 2}
          />
          {view === 'notifications' && unreadNotifications > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.navLabel, { color: theme.muted }, active && { color: theme.accent, fontWeight: '600' }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <NavButton view="feed" icon={Home} label="Feed" />
      <NavButton view="discovery" icon={Compass} label="Explore" />

      {/* Center Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => onNavigate('create')}
        activeOpacity={0.8}
      >
        <View style={[styles.createButtonInner, { backgroundColor: theme.accent }]}>
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

      <NavButton view="notifications" icon={Bell} label="Alerts" />
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => onNavigate('profile')}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <User
            size={24}
            color={isActive('profile') ? theme.accent : theme.muted}
            strokeWidth={isActive('profile') ? 2.5 : 2}
          />
          {unreadMessages > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.navLabel, { color: theme.muted }, isActive('profile') && { color: theme.accent, fontWeight: '600' }]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
    paddingBottom: 2,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
  },
  navLabel: {
    fontSize: 8,
    marginTop: 1,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  createButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  createButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 3px 6px rgba(99, 102, 241, 0.3)',
  },
});
