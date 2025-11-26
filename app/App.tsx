
import React, { useState, useEffect } from 'react';
import { View, StatusBar, Platform, TouchableOpacity, Text, ActivityIndicator, StyleSheet, Modal, useWindowDimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { ProfileScreen } from './src/screens/ProfileScreen';
import { VibeValidator } from './src/components/ui/VibeValidator';
import { getFeed, getNodes, Post, searchPosts } from './src/lib/api';
import { CreatePostModal } from './src/components/ui/CreatePostModal';
import { Plus } from 'lucide-react-native';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { SavedPostsScreen } from './src/screens/SavedPostsScreen';
import { BetaTestScreen } from './src/screens/BetaTestScreen';
import { ThemesScreen } from './src/screens/ThemesScreen';
import { CredHistoryScreen } from './src/screens/CredHistoryScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { DiscoveryScreen } from './src/screens/DiscoveryScreen';
import { FollowingScreen } from './src/screens/FollowingScreen';
import { PostDetailScreen } from './src/screens/PostDetailScreen';
import { ModerationQueueScreen } from './src/screens/ModerationQueueScreen';
import { useSocket, SocketProvider } from './src/context/SocketContext';

// Initialize Query Client
const queryClient = new QueryClient();

const MainApp = () => {
  const { user, logout } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [vibeVisible, setVibeVisible] = useState(false); // For Mobile Modal
  const [rightPanelOpen, setRightPanelOpen] = useState(true); // For Desktop Toggle
  const [currentView, setCurrentView] = useState<'feed' | 'profile' | 'beta' | 'notifications' | 'saved' | 'cred-history' | 'themes' | 'messages' | 'chat' | 'discovery' | 'following' | 'post-detail' | 'moderation'>('feed');
  const [viewParams, setViewParams] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

  // Handle post click to open detail view
  const handlePostClick = (post: any) => {
    setViewParams({ postId: post.id });
    setCurrentView('post-detail');
  };



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

  const [feedMode, setFeedMode] = useState<'global' | 'discovery' | 'following'>('global');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const fetchFeed = async (nodeId?: string | null, mode: 'global' | 'discovery' | 'following' = 'global') => {
    setLoading(true);
    try {
      const params: any = {
        nodeId: nodeId || undefined,
        qualityWeight: algoSettings.weights.quality,
        recencyWeight: algoSettings.weights.recency,
        engagementWeight: algoSettings.weights.engagement,
        personalizationWeight: algoSettings.weights.personalization
      };

      if (mode === 'discovery') {
        params.preset = 'popular'; // Or 'balanced'
      } else if (mode === 'following') {
        params.followingOnly = true;
      }

      const data = await getFeed(params);
      const mappedPosts = data.posts.map((p: any) => ({
        id: p.id,
        node: { name: p.node?.name || 'Global', color: '#6366f1' },
        author: {
          id: p.author.id,
          username: p.author.username || 'User',
          avatar: p.author.avatar, // Use backend avatar
          era: p.author.era || 'Lurker Era',
          connoisseurCred: p.author.connoisseurCred || 0
        },
        title: p.title || 'Untitled Post',
        content: p.content,
        commentCount: p.commentCount,
        createdAt: p.createdAt, // Pass original createdAt
        expertGated: false,
        vibes: [],
        linkMeta: p.linkMeta, // Pass link metadata
        poll: p.poll, // Pass poll data
        comments: p.comments?.map((c: any) => ({
          id: c.id,
          author: {
            username: c.author.username || 'User',
            avatar: c.author.avatar,
            era: c.author.era || 'Lurker Era',
            connoisseurCred: c.author.connoisseurCred || 0
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

  // Debounced feed refresh when algo settings change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFeed(selectedNodeId, feedMode);
    }, 500);
    return () => clearTimeout(timer);
  }, [algoSettings]);

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setSearchQuery(''); // Clear search when changing nodes
    setCurrentView('feed'); // Always return to feed view when selecting a node
    // If selecting a node, we implicitly go to global mode for that node
    // But if we are in discovery/following, maybe we should stay there?
    // For now, let's reset to global when picking a node to be safe/simple
    setFeedMode('global');
    fetchFeed(nodeId, 'global');
  };

  const handleFeedModeSelect = (mode: 'global' | 'discovery' | 'following') => {
    setFeedMode(mode);
    setSelectedNodeId(null); // Clear node selection
    setSearchQuery('');

    // Navigate to proper screens for discovery/following, otherwise go to feed
    if (mode === 'discovery') {
      setCurrentView('discovery');
    } else if (mode === 'following') {
      setCurrentView('following');
    } else {
      setCurrentView('feed');
      fetchFeed(null, mode);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchFeed(selectedNodeId, feedMode);
      return;
    }
    setLoading(true);
    try {
      const data = await searchPosts(searchQuery);
      const mappedPosts = data.posts.map((p: any) => ({
        id: p.id,
        node: { name: p.node?.name || 'Global', color: '#6366f1' },
        author: {
          id: p.author.id,
          username: p.author.username || 'User',
          avatar: p.author.avatar,
          era: p.author.era || 'Lurker Era',
          connoisseurCred: p.author.connoisseurCred || 0
        },
        title: p.title || 'Untitled Post',
        content: p.content,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        expertGated: false,
        vibes: [],
        linkMeta: p.linkMeta,
        poll: p.poll,
        comments: p.comments?.map((c: any) => ({
          id: c.id,
          author: {
            username: c.author.username || 'User',
            avatar: c.author.avatar,
            era: c.author.era || 'Lurker Era',
            connoisseurCred: c.author.connoisseurCred || 0
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

  // Socket.io Integration for Real-time Feed
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;

    socket.on('post:new', (newPost: any) => {
      // Only add if we are in global mode or if the post matches the current node
      // For simplicity, just add to top if global or matching node
      // We need to map the raw post to the UI format
      const mappedPost = {
        id: newPost.id,
        node: { name: newPost.node?.name || 'Global', color: '#6366f1' },
        author: {
          id: newPost.author.id,
          username: newPost.author.username || 'User',
          avatar: newPost.author.avatar,
          era: newPost.author.era || 'Lurker Era',
          connoisseurCred: newPost.author.connoisseurCred || 0
        },
        title: newPost.title || 'Untitled Post',
        content: newPost.content,
        commentCount: 0,
        createdAt: newPost.createdAt,
        expertGated: false,
        vibes: [],
        linkMeta: newPost.linkMeta,
        poll: newPost.poll,
        comments: []
      };

      setPosts(prev => [mappedPost, ...prev]);
    });

    return () => {
      socket.off('post:new');
    };
  }, [socket, selectedNodeId, feedMode]);

  // Check for Beta Route
  useEffect(() => {
    if (Platform.OS === 'web') {
      const path = window.location.pathname;
      console.log('Current Path:', path); // DEBUG
      if (path.includes('beta')) {
        setCurrentView('beta');
      }
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.node.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      {/* ... (keep existing StatusBar) */}

      <View style={{ flex: 1, flexDirection: 'row' }}>

        {/* Desktop Sidebar */}
        {isDesktop && (
          <View style={styles.drawerLeft}>
            <Sidebar
              nodes={nodes}
              isDesktop={true}
              user={user}
              onProfileClick={() => setCurrentView('profile')}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
              feedMode={feedMode}
              onFeedModeSelect={handleFeedModeSelect}
              onThemesClick={() => setCurrentView('themes')}
              onSavedClick={() => setCurrentView('saved')}
              onBetaClick={() => setCurrentView('beta')}
              onNewPostClick={() => setIsCreatePostOpen(true)}
              onModerationClick={() => setCurrentView('moderation')}
            />
          </View>
        )}

        {/* Main Content Wrapper - Pushes Right Sidebar to edge */}
        <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: isDesktop ? 1 : 0, borderRightWidth: isDesktop ? 1 : 0, borderColor: COLORS.node.border }}>

          {/* Header - Full Width */}
          <View style={styles.header}>
            {!isDesktop && (
              <TouchableOpacity onPress={() => setMenuVisible(true)}>
                <Menu size={24} color={COLORS.node.text} />
              </TouchableOpacity>
            )}

            {/* Desktop Search */}
            {isDesktop && (
              <View style={styles.searchContainerDesktop}>
                <Search size={16} color={COLORS.node.muted} style={{ position: 'absolute', left: 12, top: 10 }} />
                <TextInput
                  style={styles.inputDesktop}
                  placeholder="Search..."
                  placeholderTextColor={COLORS.node.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                />
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 16 }}>
              {/* Messages Icon */}
              <TouchableOpacity onPress={() => setCurrentView('messages')}>
                <MessageSquare size={24} color={COLORS.node.text} />
              </TouchableOpacity>

              {/* Notifications Bell */}
              <TouchableOpacity onPress={() => setCurrentView('notifications')}>
                <Bell size={24} color={COLORS.node.text} />
              </TouchableOpacity>

              {/* Desktop Right Panel Toggle */}
              {isDesktop && (
                <TouchableOpacity onPress={() => setRightPanelOpen(!rightPanelOpen)}>
                  <PanelRight size={24} color={rightPanelOpen ? COLORS.node.accent : COLORS.node.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Scrollable Content - Full Width */}
          <View style={{ width: '100%', maxWidth: '100%', flex: 1 }}>
            {currentView === 'feed' ? (
              <Feed
                posts={posts}
                currentUser={user}
                onPostAction={(postId, action) => {
                  // Optimistic update: remove post from feed
                  setPosts(prev => prev.filter(p => p.id !== postId));
                }}
                onPostClick={handlePostClick}
              />
            ) : currentView === 'profile' ? (
              <ProfileScreen
                onBack={() => setCurrentView('feed')}
                onCredClick={() => setCurrentView('cred-history')}
              />
            ) : currentView === 'beta' ? (
              <BetaTestScreen onBack={() => setCurrentView('feed')} />
            ) : currentView === 'notifications' ? (
              <NotificationsScreen onBack={() => setCurrentView('feed')} />
            ) : currentView === 'saved' ? (
              <SavedPostsScreen onBack={() => setCurrentView('feed')} />
            ) : currentView === 'cred-history' ? (
              <CredHistoryScreen onBack={() => setCurrentView('profile')} />
            ) : currentView === 'themes' ? (
              <ThemesScreen onBack={() => setCurrentView('feed')} />
            ) : currentView === 'messages' ? (
              <MessagesScreen
                onBack={() => setCurrentView('feed')}
                onNavigate={(screen, params) => {
                  setCurrentView(screen as any);
                  setViewParams(params);
                }}
              />
            ) : currentView === 'chat' ? (
              <ChatScreen
                onBack={() => setCurrentView('messages')}
                conversationId={viewParams?.conversationId}
                recipient={viewParams?.recipient}
              />
            ) : currentView === 'discovery' ? (
              <DiscoveryScreen onBack={() => setCurrentView('feed')} onPostClick={handlePostClick} />
            ) : currentView === 'following' ? (
              <FollowingScreen onBack={() => setCurrentView('feed')} onPostClick={handlePostClick} />
            ) : currentView === 'post-detail' ? (
              <PostDetailScreen postId={viewParams?.postId} onBack={() => setCurrentView('feed')} />
            ) : currentView === 'moderation' ? (
              <ModerationQueueScreen onBack={() => setCurrentView('feed')} />
            ) : null}

            {/* Mobile FAB */}
            {!isDesktop && currentView === 'feed' && (
              <TouchableOpacity
                style={styles.fab}
                onPress={() => setIsCreatePostOpen(true)}
              >
                <Plus size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Desktop Right Panel */}
        {isDesktop && rightPanelOpen && (
          <View style={styles.drawerRight}>
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
              <Sidebar
                nodes={nodes}
                onClose={() => setMenuVisible(false)}
                user={user}
                onProfileClick={() => {
                  setMenuVisible(false);
                  setCurrentView('profile');
                }}
                selectedNodeId={selectedNodeId}
                onNodeSelect={handleNodeSelect}
                feedMode={feedMode}
                onFeedModeSelect={handleFeedModeSelect}
                onThemesClick={() => {
                  setMenuVisible(false);
                  setCurrentView('themes');
                }}
                onSavedClick={() => {
                  setMenuVisible(false);
                  setCurrentView('saved');
                }}
                onBetaClick={() => {
                  setMenuVisible(false);
                  setCurrentView('beta');
                }}
                onModerationClick={() => {
                  setMenuVisible(false);
                  setCurrentView('moderation');
                }}
              />
            </View>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuVisible(false)} />
          </View>
        </Modal>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        visible={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onSuccess={() => {
          setIsCreatePostOpen(false);
          queryClient.invalidateQueries({ queryKey: ['posts'] });
          fetchFeed(selectedNodeId); // Refresh feed after posting
        }}
        nodes={nodes}
        initialNodeId={selectedNodeId}
      />

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
          // Main App - wrapped with SocketProvider for real-time features
          <SocketProvider>
            <MainApp />
          </SocketProvider>
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
  },
  searchContainerDesktop: {
    flex: 1,
    maxWidth: 400,
    marginHorizontal: 24,
    position: 'relative',
    justifyContent: 'center'
  },
  inputDesktop: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    paddingVertical: 8,
    paddingLeft: 36,
    paddingRight: 12,
    color: '#fff',
    fontSize: 14
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100
  }
});
