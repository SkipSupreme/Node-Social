import React, { ComponentType } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Home, Compass, Bell, User, Plus } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

type NavItem = 'feed' | 'discovery' | 'create' | 'notifications' | 'profile';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: NavItem) => void;
  unreadNotifications?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  unreadNotifications = 0,
}) => {
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
            color={active ? COLORS.node.accent : COLORS.node.muted}
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
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <NavButton view="feed" icon={Home} label="Feed" />
      <NavButton view="discovery" icon={Compass} label="Explore" />

      {/* Center Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => onNavigate('create')}
        activeOpacity={0.8}
      >
        <View style={styles.createButtonInner}>
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

      <NavButton view="notifications" icon={Bell} label="Alerts" />
      <NavButton view="profile" icon={User} label="Profile" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.node.bg,
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
    color: COLORS.node.muted,
    marginTop: 1,
  },
  navLabelActive: {
    color: COLORS.node.accent,
    fontWeight: '600',
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
    backgroundColor: COLORS.node.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 3px 6px rgba(99, 102, 241, 0.3)',
  },
});
