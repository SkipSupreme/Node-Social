
import React, { useState, useEffect, useRef } from 'react';
import { View, StatusBar, Platform, TouchableOpacity, Text, ActivityIndicator, StyleSheet, Modal, useWindowDimensions, TextInput, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Menu, Settings, X, MessageSquare, Bell, PanelRight, Search, ChevronDown } from './src/components/ui/Icons';
import { useAuthStore } from './src/store/auth';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import * as Linking from 'expo-linking';
import { COLORS, SCOPE_COLORS } from './src/constants/theme';
import { MobileBottomNav } from './src/components/ui/MobileBottomNav';
import { getPresetDisplayName, PresetType } from './src/components/ui/PresetBottomSheet';
import { NodeLogo } from './src/components/ui/NodeLogo';

// New UI Components
import { Sidebar } from './src/components/ui/Sidebar';
import { Feed } from './src/components/ui/Feed';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { VibeValidator, VibeValidatorSettings } from './src/components/ui/VibeValidator';
import { getFeed, getNodes, Post, searchPosts, getFeedPreferences, updateFeedPreferences } from './src/lib/api';
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
// PostTypeFilter removed from main feed - may be added to Vibe Validator expert mode later
import { PostType } from './src/web/components/Feeds/PostTypeFilter';

// Initialize Query Client
const queryClient = new QueryClient();

const MainApp = () => {
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [vibeVisible, setVibeVisible] = useState(false); // For Mobile Modal
  const [rightPanelOpen, setRightPanelOpen] = useState(true); // For Desktop Toggle
  const [currentView, setCurrentView] = useState<'feed' | 'profile' | 'beta' | 'notifications' | 'saved' | 'cred-history' | 'themes' | 'messages' | 'chat' | 'discovery' | 'following' | 'post-detail' | 'moderation'>('feed');
  const [viewParams, setViewParams] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

  // Mobile-specific states
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerVisible = useRef(true);

  // Handle post click to open detail view
  const handlePostClick = (post: any) => {
    setViewParams({ postId: post.id });
    setCurrentView('post-detail');
  };

  // Handle scroll to hide/show header on mobile
  const handleScroll = (scrollY: number) => {
    const diff = scrollY - lastScrollY.current;
    const threshold = 5; // More responsive

    if (diff > threshold && headerVisible.current && scrollY > 80) {
      // Scrolling down - hide header
      headerVisible.current = false;
      Animated.spring(headerTranslateY, {
        toValue: -64,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
    } else if (diff < -threshold && !headerVisible.current) {
      // Scrolling up - show header
      headerVisible.current = true;
      Animated.spring(headerTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
    }

    lastScrollY.current = scrollY;
  };

  // Handle bottom nav navigation
  const handleBottomNavigation = (view: 'feed' | 'discovery' | 'create' | 'notifications' | 'profile') => {
    if (view === 'create') {
      setIsCreatePostOpen(true);
    } else {
      setCurrentView(view);
    }
  };



  const [algoSettings, setAlgoSettings] = useState<VibeValidatorSettings>({
    preset: 'balanced',
    weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
    mode: 'simple',
  });

  // Load feed preferences from backend on mount
  const loadFeedPreferences = async () => {
    try {
      const prefs = await getFeedPreferences();
      setAlgoSettings(prev => ({
        ...prev,
        preset: prefs.presetMode || 'balanced',
        weights: {
          quality: prefs.qualityWeight,
          recency: prefs.recencyWeight,
          engagement: prefs.engagementWeight,
          personalization: prefs.personalizationWeight,
        }
      }));
    } catch (error) {
      console.log('Using default feed preferences');
    }
  };

  // Save feed preferences to backend (debounced in effect)
  const saveFeedPreferences = async (settings: typeof algoSettings) => {
    try {
      await updateFeedPreferences({
        preset: settings.preset as any,
        qualityWeight: settings.weights.quality,
        recencyWeight: settings.weights.recency,
        engagementWeight: settings.weights.engagement,
        personalizationWeight: settings.weights.personalization,
      });
    } catch (error) {
      console.error('Failed to save feed preferences:', error);
    }
  };

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

  const [selectedPostTypes, setSelectedPostTypes] = useState<PostType[]>([]);

  // Refs to track latest values for the debounced effect (avoids stale closures)
  const feedModeRef = useRef(feedMode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  
  // Keep refs in sync with state
  useEffect(() => {
    feedModeRef.current = feedMode;
  }, [feedMode]);
  
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  const fetchFeed = async (nodeId?: string | null, mode: 'global' | 'discovery' | 'following' = 'global', postTypes?: PostType[]) => {
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

      // Add post type filter if any selected
      if (postTypes && postTypes.length > 0) {
        params.postTypes = postTypes;
      }

      const data = await getFeed(params);

      // Debug: Log what the backend returns for reactions
      console.log('[Feed] Raw posts from API:', data.posts.map((p: any) => ({
        id: p.id,
        title: p.title?.substring(0, 30),
        myReaction: p.myReaction,
        vibeAggregate: p.vibeAggregate
      })));

      const mappedPosts = data.posts.map((p: any) => ({
        id: p.id,
        node: { id: p.node?.id, name: p.node?.name || 'Global', color: '#6366f1' },
        author: {
          id: p.author.id,
          username: p.author.username || 'User',
          avatar: p.author.avatar,
          era: p.author.era || 'Lurker Era',
          cred: p.author.cred || 0
        },
        title: p.title || 'Untitled Post',
        content: p.content,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        expertGated: false,
        vibes: [],
        linkMeta: p.linkMeta,
        poll: p.poll,
        myReaction: p.myReaction,
        vibeAggregate: p.vibeAggregate,
        comments: p.comments?.map((c: any) => ({
          id: c.id,
          author: {
            id: c.author.id,
            username: c.author.username || 'User',
            avatar: c.author.avatar,
            era: c.author.era || 'Lurker Era',
            cred: c.author.cred || 0
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

  // Debounced feed refresh and preference save when algo settings change
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      // Use refs to get latest feedMode/selectedNodeId without them as dependencies
      // This avoids duplicate fetches since handlers already call fetchFeed directly
      fetchFeed(selectedNodeIdRef.current, feedModeRef.current, selectedPostTypes);
      // Only save to backend after initial load (not on first mount)
      if (settingsInitialized) {
        saveFeedPreferences(algoSettings);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [algoSettings, settingsInitialized, selectedPostTypes]);

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setSearchQuery(''); // Clear search when changing nodes
    setCurrentView('feed'); // Always return to feed view when selecting a node
    // If selecting a node, we implicitly go to global mode for that node
    // But if we are in discovery/following, maybe we should stay there?
    // For now, let's reset to global when picking a node to be safe/simple
    setFeedMode('global');
    fetchFeed(nodeId, 'global', selectedPostTypes);
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
      fetchFeed(null, mode, selectedPostTypes);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchFeed(selectedNodeId, feedMode, selectedPostTypes);
      return;
    }
    setLoading(true);
    try {
      const data = await searchPosts(searchQuery);
      const mappedPosts = data.posts.map((p: any) => ({
        id: p.id,
        node: { id: p.node?.id, name: p.node?.name || 'Global', color: '#6366f1' },
        author: {
          id: p.author.id,
          username: p.author.username || 'User',
          avatar: p.author.avatar,
          era: p.author.era || 'Lurker Era',
          cred: p.author.cred || 0
        },
        title: p.title || 'Untitled Post',
        content: p.content,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        expertGated: false,
        vibes: [],
        linkMeta: p.linkMeta,
        poll: p.poll,
        myReaction: p.myReaction,
        vibeAggregate: p.vibeAggregate,
        comments: p.comments?.map((c: any) => ({
          id: c.id,
          author: {
            id: c.author.id,
            username: c.author.username || 'User',
            avatar: c.author.avatar,
            era: c.author.era || 'Lurker Era',
            cred: c.author.cred || 0
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
    const init = async () => {
      await fetchNodes();
      await loadFeedPreferences();
      setSettingsInitialized(true);
      // fetchFeed will be called by the algoSettings effect after preferences load
    };
    init();
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
        node: { id: newPost.node?.id, name: newPost.node?.name || 'Global', color: '#6366f1' },
        author: {
          id: newPost.author.id,
          username: newPost.author.username || 'User',
          avatar: newPost.author.avatar,
          era: newPost.author.era || 'Lurker Era',
          cred: newPost.author.cred || 0
        },
        title: newPost.title || 'Untitled Post',
        content: newPost.content,
        commentCount: 0,
        createdAt: newPost.createdAt,
        expertGated: false,
        vibes: [],
        linkMeta: newPost.linkMeta,
        poll: newPost.poll,
        myReaction: null,
        vibeAggregate: null, // New posts start with no aggregate
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

  // Status bar height for positioning
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.node.bg }}>
      {/* Persistent status bar background - always visible behind notch/status bar area */}
      {!isDesktop && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: statusBarHeight,
          backgroundColor: COLORS.node.bg,
          zIndex: 200,
        }} />
      )}

      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.node.bg }}>
      <View style={{ flex: 1 }}>
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
              currentView={currentView}
            />
          </View>
        )}

        {/* Main Content Wrapper - Pushes Right Sidebar to edge */}
        <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: isDesktop ? 1 : 0, borderRightWidth: isDesktop ? 1 : 0, borderColor: COLORS.node.border }}>

          {/* Header - Full Width (absolute on mobile, content scrolls underneath) */}
          <Animated.View style={[
            styles.header,
            !isDesktop && styles.mobileHeader,
            !isDesktop && { transform: [{ translateY: headerTranslateY }] }
          ]}>
            {/* Mobile Header */}
            {!isDesktop && !mobileSearchActive && (
              <>
                {/* Left: Menu + Logo */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12 }}>
                  <TouchableOpacity onPress={() => setMenuVisible(true)}>
                    <Menu size={24} color={COLORS.node.text} />
                  </TouchableOpacity>
                  <NodeLogo size="small" showText={true} />
                </View>

                {/* Right: Search + Preset Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 }}>
                  <TouchableOpacity
                    onPress={() => setMobileSearchActive(true)}
                    style={styles.mobileIconButton}
                  >
                    <Search size={20} color={COLORS.node.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setVibeVisible(true)}
                    style={styles.presetButton}
                  >
                    <Text style={styles.presetButtonText} numberOfLines={1}>
                      {getPresetDisplayName(algoSettings.preset as PresetType)}
                    </Text>
                    <ChevronDown size={14} color={COLORS.node.accent} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Mobile Search Active */}
            {!isDesktop && mobileSearchActive && (
              <View style={styles.mobileSearchContainer}>
                <View style={styles.mobileSearchInputWrapper}>
                  <Search size={16} color={COLORS.node.muted} />
                  <TextInput
                    style={styles.mobileSearchInput}
                    placeholder="Search posts, users, nodes..."
                    placeholderTextColor={COLORS.node.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setMobileSearchActive(false);
                    setSearchQuery('');
                  }}
                  style={styles.mobileSearchCancel}
                >
                  <Text style={styles.mobileSearchCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Desktop Header */}
            {isDesktop && (
              <>
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

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 16 }}>
                  <TouchableOpacity onPress={() => setCurrentView('messages')}>
                    <MessageSquare size={24} color={COLORS.node.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setCurrentView('notifications')}>
                    <Bell size={24} color={COLORS.node.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setRightPanelOpen(!rightPanelOpen)}>
                    <PanelRight size={24} color={rightPanelOpen ? COLORS.node.accent : COLORS.node.text} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>

          {/* Scrollable Content - Full Width */}
          <View style={{ width: '100%', maxWidth: '100%', flex: 1 }}>
            {currentView === 'feed' ? (
              <View style={{ flex: 1 }}>
                <Feed
                  posts={posts}
                  currentUser={user}
                  onPostAction={(postId, _action) => {
                    // Optimistic update: remove post from feed
                    setPosts(prev => prev.filter(p => p.id !== postId));
                  }}
                  onPostClick={handlePostClick}
                  globalNodeId={nodes.find(n => n.slug === 'global')?.id}
                  onScroll={!isDesktop ? handleScroll : undefined}
                  headerOffset={!isDesktop ? 64 : 0}
                />
              </View>
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

          </View>
        </View>

        {/* Desktop Right Panel */}
        {isDesktop && rightPanelOpen && (
          <View style={styles.drawerRight}>
            <VibeValidator settings={algoSettings} onUpdate={setAlgoSettings} />
          </View>
        )}

        </View>

        {/* Mobile Bottom Nav - Outside the row, at bottom of screen */}
        {!isDesktop && (
          <MobileBottomNav
            currentView={currentView}
            onNavigate={handleBottomNavigation}
            unreadNotifications={0}
          />
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
                currentView={currentView}
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
          fetchFeed(selectedNodeId, feedMode, selectedPostTypes); // Refresh feed after posting
        }}
        nodes={nodes}
        initialNodeId={selectedNodeId}
      />

      {/* Mobile Vibe Validator Modal */}
      {!isDesktop && (
        <Modal visible={vibeVisible} animationType="slide" transparent>
          <View style={styles.vibeModalOverlay}>
            <View style={styles.vibeModalContent}>
              <TouchableOpacity
                onPress={() => setVibeVisible(false)}
                style={styles.vibeModalClose}
              >
                <X size={24} color={COLORS.node.text} />
              </TouchableOpacity>
              <VibeValidator settings={algoSettings} onUpdate={setAlgoSettings} />
            </View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
    </View>
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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.node.bg} />
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
  mobileHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
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
  // Mobile Header Styles
  mobileIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.node.panel,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.node.border
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${COLORS.node.accent}20`,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.node.accent
  },
  presetButtonText: {
    color: COLORS.node.accent,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 80
  },
  mobileSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12
  },
  mobileSearchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  mobileSearchInput: {
    flex: 1,
    color: COLORS.node.text,
    fontSize: 14
  },
  mobileSearchCancel: {
    padding: 8
  },
  mobileSearchCancelText: {
    color: COLORS.node.accent,
    fontSize: 14,
    fontWeight: '500'
  },
  // Vibe Modal Styles
  vibeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  vibeModalContent: {
    backgroundColor: COLORS.node.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 40
  },
  vibeModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
    backgroundColor: COLORS.node.bg,
    borderRadius: 20,
  }
});
