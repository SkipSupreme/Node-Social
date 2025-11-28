import React from 'react';
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

  const NavButton = ({ view, icon: Icon, label }: { view: NavItem; icon: any; label: string }) => {
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
    backgroundColor: COLORS.node.panel,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
    paddingBottom: 20, // Extra padding for home indicator
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 10,
    color: COLORS.node.muted,
    marginTop: 2,
  },
  navLabelActive: {
    color: COLORS.node.accent,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  createButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24, // Lift it up
  },
  createButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.node.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.node.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
