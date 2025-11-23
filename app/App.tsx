
import React, { useState, useEffect } from 'react';
import { View, SafeAreaView, StatusBar, Platform, TouchableOpacity, Text, ActivityIndicator, StyleSheet, Modal, useWindowDimensions, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Menu, Settings, X, MessageSquare, Bell, PanelRight, Search } from './src/components/ui/Icons';
import { useAuthStore } from './src/store/auth';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import * as Linking from 'expo-linking';
import { COLORS, SCOPE_COLORS } from './src/constants/theme';

// New UI Components
import { Sidebar } from './src/components/ui/Sidebar';
import { Feed } from './src/components/ui/Feed';
import { VibeValidator } from './src/components/ui/VibeValidator';
import { getFeed, getNodes, Post, searchPosts } from './src/lib/api';

// Initialize Query Client
const queryClient = new QueryClient();

const MainApp = () => {
  const { user, logout } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [vibeVisible, setVibeVisible] = useState(false); // For Mobile Modal
  const [rightPanelOpen, setRightPanelOpen] = useState(true); // For Desktop Toggle
  const [posts, setPosts] = useState<any[]>([]); // Use any for now to match Feed props
  const [loading, setLoading] = useState(true);

  const [algoSettings, setAlgoSettings] = useState({
    preset: 'balanced',
    weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 }
  });

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024; // 3-column breakpoint

  const [nodes, setNodes] = useState<any[]>([]);

  const fetchNodes = async () => {
    try {
      const data = await getNodes();
      // Map API nodes to UI nodes (add color/vibeVelocity if missing)
      const mappedNodes = data.map((n: any) => ({
        ...n,
        type: 'child', // Default type
        vibeVelocity: Math.floor(Math.random() * 100), // Mock velocity
        color: SCOPE_COLORS[Math.floor(Math.random() * SCOPE_COLORS.length)] // Mock color
      }));
      setNodes(mappedNodes);
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    }
  };

  const fetchFeed = async () => {
    try {
      const data = await getFeed();
      const mappedPosts = data.posts.map((p: any) => ({
        id: p.id,
        node: { name: p.node?.name || 'Global', color: '#6366f1' },
        author: {
          username: p.author.email.split('@')[0],
          avatar: `https://picsum.photos/seed/${p.author.id}/200`,
          era: 'Builder Era',
          connoisseurCred: 420
        },
        title: p.title || 'Untitled Post',
        content: p.content,
        commentCount: p.commentCount,
        expertGated: false,
        vibes: [],
        comments: p.comments?.map((c: any) => ({
          id: c.id,
          author: {
            username: c.author.email.split('@')[0],
            avatar: `https://picsum.photos/seed/${c.author.id}/200`,
            era: 'Builder Era',
            connoisseurCred: 100
          },
          content: c.content,
          timestamp: new Date(c.createdAt),
          depth: 0,
          replies: []
        })) || []
      }));
      setPosts(mappedPosts);
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchFeed();
      return;
    }
    setLoading(true);
    try {
      const data = await searchPosts(searchQuery);
      const mappedPosts = data.posts.map((p: any) => ({
        id: p.id,
        node: { name: p.node?.name || 'Global', color: '#6366f1' },
        author: {
          username: p.author.email.split('@')[0],
          avatar: `https://picsum.photos/seed/${p.author.id}/200`,
          era: 'Builder Era',
          connoisseurCred: 420
        },
        title: p.title || 'Untitled Post',
        content: p.content,
        commentCount: p.commentCount,
        expertGated: false,
        vibes: [],
        comments: p.comments?.map((c: any) => ({
          id: c.id,
          author: {
            username: c.author.email.split('@')[0],
            avatar: `https://picsum.photos/seed/${c.author.id}/200`,
            era: 'Builder Era',
            connoisseurCred: 100
          },
          content: c.content,
          timestamp: new Date(c.createdAt),
          depth: 0,
          replies: []
        })) || []
      }));
      setPosts(mappedPosts);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    fetchFeed();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.node.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.node.bg} />

      <View style={{ flex: 1, flexDirection: 'row' }}>

        {/* --- LEFT COLUMN: SIDEBAR (Tablet/Desktop) --- */}
        {isTablet && (
          <View style={{ width: 280 }}>
            <Sidebar nodes={nodes} isDesktop />
          </View>
        )}

        {/* --- CENTER COLUMN: FEED --- */}
        <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: isTablet ? 1 : 0, borderLeftColor: COLORS.node.border }}>

          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: isTablet ? 24 : 16 }]}>
            {!isTablet && (
              <TouchableOpacity onPress={() => setMenuVisible(true)}>
                <Menu color={COLORS.node.muted} size={24} />
              </TouchableOpacity>
            )}

            {/* Desktop Search */}
            {isTablet ? (
              <View style={styles.desktopSearch}>
                <Search size={16} color={COLORS.node.muted} />
                <TextInput
                  placeholder="Search Nodes, people, or vibes..."
                  placeholderTextColor={COLORS.node.muted}
                  style={{ flex: 1, color: '#fff', fontSize: 14, height: '100%' }}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); fetchFeed(); }}>
                    <X size={16} color={COLORS.node.muted} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.headerTitle}>Node<Text style={{ color: COLORS.node.accent }}>Social</Text></Text>
            )}

            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <MessageSquare color={COLORS.node.muted} size={24} />
              <Bell color={COLORS.node.muted} size={24} />

              {/* Right Panel Toggle (Desktop) */}
              {isDesktop && (
                <TouchableOpacity
                  onPress={() => setRightPanelOpen(!rightPanelOpen)}
                  style={[styles.iconBtn, rightPanelOpen && { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}
                >
                  <PanelRight color={rightPanelOpen ? COLORS.node.accent : COLORS.node.muted} size={24} />
                </TouchableOpacity>
              )}

              {/* Vibe Modal Trigger (Mobile/Tablet) */}
              {!isDesktop && (
                <TouchableOpacity onPress={() => setVibeVisible(true)}>
                  <PanelRight color={COLORS.node.muted} size={24} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Feed */}
          <View style={{ flex: 1, width: '100%' }}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.node.accent} style={{ marginTop: 20 }} />
            ) : (
              <Feed posts={posts} />
            )}
          </View>
        </View>

        {/* --- RIGHT COLUMN: VIBE VALIDATOR (Desktop) --- */}
        {isDesktop && rightPanelOpen && (
          <View style={{ width: 320 }}>
            <VibeValidator settings={algoSettings} onUpdate={setAlgoSettings} />
          </View>
        )}

      </View>

      {/* --- MOBILE MODALS --- */}

      {/* Left Menu Modal */}
      {!isTablet && (
        <Modal visible={menuVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.drawerLeft}>
              <Sidebar nodes={nodes} onClose={() => setMenuVisible(false)} />
            </View>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuVisible(false)} />
          </View>
        </Modal>
      )}

      {/* Vibe Validator Modal (Mobile/Tablet) */}
      {!isDesktop && (
        <Modal visible={vibeVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setVibeVisible(false)} />
            <View style={styles.drawerRight}>
              {/* Close Button needed inside since VibeValidator doesn't have one */}
              <TouchableOpacity onPress={() => setVibeVisible(false)} style={styles.closeBtnOverlay}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
              <VibeValidator settings={algoSettings} onUpdate={setAlgoSettings} />
            </View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
};

export default function App() {
  const { user, loading, loadFromStorage, markEmailVerified, logout } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email'>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const emailForVerification = user?.email ?? '';

  // Deep linking setup
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);

      if (path === 'reset-password' && queryParams?.token) {
        setResetToken(queryParams.token as string);
        setCurrentScreen('reset-password');
      } else if (path === 'verify-email' && queryParams?.token) {
        setVerifyToken(queryParams.token as string);
        setCurrentScreen('verify-email');
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.node.bg }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar barStyle="light-content" backgroundColor="#0f1115" />
        {!user ? (
          // Auth Flow
          currentScreen === 'login' ? (
            <LoginScreen
              onSuccessLogin={() => { }}
              goToRegister={() => setCurrentScreen('register')}
              goToForgotPassword={() => setCurrentScreen('forgot-password')}
            />
          ) : currentScreen === 'register' ? (
            <RegisterScreen
              onSuccessLogin={() => setCurrentScreen('login')}
              goToLogin={() => setCurrentScreen('login')}
            />
          ) : currentScreen === 'forgot-password' ? (
            <ForgotPasswordScreen
              goToLogin={() => setCurrentScreen('login')}
            />
          ) : currentScreen === 'reset-password' ? (
            <ResetPasswordScreen
              token={resetToken || ''}
              onSuccess={() => setCurrentScreen('login')}
            />
          ) : currentScreen === 'verify-email' ? (
            <VerifyEmailScreen
              pendingToken={verifyToken || ''}
              email={emailForVerification}
              onTokenConsumed={() => setVerifyToken(null)}
              onVerified={async () => {
                await markEmailVerified();
                setVerifyToken(null);
                setCurrentScreen('login');
              }}
              onLogout={async () => {
                await logout();
                setVerifyToken(null);
                setCurrentScreen('login');
              }}
            />
          ) : null
        ) : (
          // Main App
          <MainApp />
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    backgroundColor: COLORS.node.bg,
    width: '100%'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  desktopSearch: {
    flex: 1,
    maxWidth: 400,
    height: 36,
    backgroundColor: COLORS.node.panel,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    marginHorizontal: 24
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row'
  },
  drawerLeft: {
    width: '80%',
    maxWidth: 300,
    backgroundColor: COLORS.node.panel,
    height: '100%'
  },
  drawerRight: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: COLORS.node.panel,
    height: '100%',
    position: 'relative'
  },
  closeBtnOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8
  }
});
