
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StatusBar, Platform, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, useWindowDimensions, Animated, Image, Text } from 'react-native';
import { HelpCircle } from './src/components/ui/Icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalProvider, PortalHost } from '@gorhom/portal';
import { useAuthStore } from './src/store/auth';
import { useThemeStore, type ThemeTokens } from './src/store/theme';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import * as Linking from 'expo-linking';
import { COLORS } from './src/constants/theme';
import { useAppTheme } from './src/hooks/useTheme';
import { MobileBottomNav } from './src/components/ui/MobileBottomNav';

// New UI Components
import { Sidebar } from './src/components/ui/Sidebar';
import { Feed } from './src/components/ui/Feed';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { VibeValidator, VibeValidatorSettings } from './src/components/ui/VibeValidator';
import { getFeed, getNodes, searchPosts, searchUsers, SearchUser, getFeedPreferences, updateFeedPreferences, getCombinedExternalFeed, getBlueskyDiscover, getMastodonTrending, ExternalPost, Node, Post, TipTapDoc } from './src/lib/api';
import { VibeAggregateData } from './src/components/VibeBar';
import { CreatePostModal } from './src/components/ui/CreatePostModal';
import { EditPostModal } from './src/components/ui/EditPostModal';
import { UIPost } from './src/components/ui/Feed';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { SavedPostsScreen } from './src/screens/SavedPostsScreen';
import { ThemesScreen } from './src/screens/ThemesScreen';
import { ThemeEditorScreen } from './src/screens/ThemeEditorScreen';
import { CredHistoryScreen } from './src/screens/CredHistoryScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { DiscoveryScreen } from './src/screens/DiscoveryScreen';
import { FollowingScreen } from './src/screens/FollowingScreen';
import { PostDetailScreen } from './src/screens/PostDetailScreen';
import { GovernanceScreen } from './src/screens/GovernanceScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NodeSettingsScreen } from './src/screens/NodeSettingsScreen';
import { ModLogScreen } from './src/screens/ModLogScreen';
import { useSocket, SocketProvider } from './src/context/SocketContext';
import { AuthPromptProvider, useAuthPrompt } from './src/context/AuthPromptContext';
import { FeedHeader } from './src/components/ui/FeedHeader';
import { WhatsVibing } from './src/components/ui/WhatsVibing';
import { NodeLandingPage } from './src/components/ui/NodeLandingPage';
import { ToastContainer } from './src/components/ui/Toast';
import { MultiColumnContainer } from './src/components/ui/MultiColumnContainer';
import { useColumnsStore } from './src/store/columns';
import { SkeletonFeed } from './src/components/ui/SkeletonPostCard';
import { NodeInfoSheet } from './src/components/ui/NodeInfoSheet';
import { storage } from './src/lib/storage';

// Initialize Query Client with performance-optimized settings (Tier 4)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 30 seconds before refetching
      staleTime: 30 * 1000,
      // Cache data for 5 minutes even when unused
      gcTime: 5 * 60 * 1000,
      // Retry failed requests up to 2 times
      retry: 2,
      // Don't refetch on window focus for mobile (saves bandwidth)
      refetchOnWindowFocus: false,
      // Refetch on reconnect for real-time feel
      refetchOnReconnect: true,
    },
  },
});

// Mapped comment shape for feed state
interface MappedComment {
  id: string;
  author: { id: string; username: string; avatar: string; era: string; cred: number };
  content: string;
  timestamp: Date;
  depth: number;
  replies: MappedComment[];
}

// Type for mapped posts used in feed state
interface MappedPost {
  id: string;
  node: { id: string | undefined; name: string; slug: string; color: string };
  author: { id: string; username: string; avatar: string; era: string; cred: number };
  title: string;
  content: string | null;
  contentJson?: TipTapDoc | null;
  contentFormat?: 'markdown' | 'tiptap';
  commentCount: number;
  createdAt: string;
  expertGated: boolean;
  vibes: string[];
  linkUrl?: string | null;
  mediaUrl?: string | null;
  linkMeta?: Post['linkMeta'];
  poll?: {
    id: string;
    question: string;
    endsAt?: string;
    options: { id: string; text: string; order?: number; _count?: { votes: number } }[];
    votes?: { optionId: string }[];
  };
  myReaction?: { [key: string]: number } | null;
  vibeAggregate?: VibeAggregateData | null;
  isSaved: boolean;
  comments: MappedComment[];
}

// Navigation parameter types
type ViewName = 'feed' | 'profile' | 'notifications' | 'saved' | 'cred-history' | 'themes' | 'messages' | 'chat' | 'discovery' | 'following' | 'post-detail' | 'governance' | 'moderation' | 'appeals' | 'council' | 'vouches' | 'trust-graph' | 'nodeSettings' | 'modLog' | 'blocked-muted';

interface NavigationParams {
  userId?: string;
  postId?: string;
  conversationId?: string;
  recipient?: { id: string; username: string; avatar?: string | null };
}

interface NavigationEntry {
  view: string;
  params: NavigationParams | null;
}

// Feed query parameters
interface FeedQueryParams {
  nodeId?: string;
  cursor?: string;
  limit?: number;
  preset?: string;
  followingOnly?: boolean;
  timeRange?: string;
  textOnly?: boolean;
  mediaOnly?: boolean;
  linksOnly?: boolean;
  hasDiscussion?: boolean;
  qualityWeight?: number;
  recencyWeight?: number;
  engagementWeight?: number;
  personalizationWeight?: number;
}

// Error Boundary to catch rendering errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging (could send to error reporting service)
    console.error('App Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.node.bg, padding: 20 }}>
          <Text style={{ color: COLORS.node.text, fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: COLORS.node.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const MainApp = () => {
  const theme = useAppTheme();
  const { user } = useAuthStore();
  const { requireAuth } = useAuthPrompt();
  const { isMultiColumnEnabled, loadFromStorage: loadColumnsConfig } = useColumnsStore();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [vibeVisible, setVibeVisible] = useState(false); // For Vibe Validator Modal
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Left sidebar collapse state
  const [currentView, setCurrentView] = useState<'feed' | 'profile' | 'notifications' | 'saved' | 'cred-history' | 'themes' | 'theme-editor' | 'messages' | 'chat' | 'discovery' | 'following' | 'post-detail' | 'governance' | 'moderation' | 'appeals' | 'council' | 'vouches' | 'trust-graph' | 'nodeSettings' | 'modLog' | 'blocked-muted' | 'settings'>('feed');
  const [viewParams, setViewParams] = useState<any>(null);
  const [navigationHistory, setNavigationHistory] = useState<Array<{ view: string; params: any }>>([]);

  // Refs to track latest navigation state (avoids stale closures in memoized callbacks)
  const currentViewRef = useRef(currentView);
  const viewParamsRef = useRef(viewParams);
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
  useEffect(() => { viewParamsRef.current = viewParams; }, [viewParams]);

  // Navigate to a new view, pushing current view to history stack
  // Stable callback — reads current view/params from refs, safe to use in memoized callbacks
  const navigateTo = useCallback((view: typeof currentView, params?: any) => {
    setNavigationHistory(prev => [...prev, { view: currentViewRef.current, params: viewParamsRef.current }]);
    setViewParams(params || null);
    setCurrentView(view);
  }, []);

  // Go back to previous view in history
  const goBack = () => {
    if (navigationHistory.length > 0) {
      const history = [...navigationHistory];
      const previous = history.pop()!;
      setNavigationHistory(history);
      setViewParams(previous.params);
      setCurrentView(previous.view as typeof currentView);
    } else {
      setCurrentView('feed');
      setViewParams(null);
    }
  };

  const [posts, setPosts] = useState<MappedPost[]>([]);
  const [externalPosts, setExternalPosts] = useState<ExternalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [quotedExternalPost, setQuotedExternalPost] = useState<ExternalPost | null>(null);
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<UIPost | null>(null);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [nodeInfoVisible, setNodeInfoVisible] = useState(false);
  const [nodeInfoNodeId, setNodeInfoNodeId] = useState<string | null>(null);

  // Feed source for mobile mixed feed (node, bluesky, mastodon, or mixed)
  // Persisted to storage so it survives layout changes
  const [feedSource, setFeedSourceState] = useState<'node' | 'bluesky' | 'mastodon' | 'mixed'>('node');
  const feedSourceRef = useRef(feedSource);

  // Load feedSource from storage on mount
  useEffect(() => {
    storage.getItem('feedSource').then((saved) => {
      if (saved && ['node', 'bluesky', 'mastodon', 'mixed'].includes(saved)) {
        setFeedSourceState(saved as 'node' | 'bluesky' | 'mastodon' | 'mixed');
        feedSourceRef.current = saved as 'node' | 'bluesky' | 'mastodon' | 'mixed';
      }
    });
  }, []);

  // Wrapper to persist feedSource changes
  const setFeedSource = (source: 'node' | 'bluesky' | 'mastodon' | 'mixed') => {
    setFeedSourceState(source);
    feedSourceRef.current = source;
    storage.setItem('feedSource', source);
  };

  // Mobile-specific states
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerVisible = useRef(true);

  // Handle post click to open detail view
  // Accepts either a post object or just a postId string (from desktop columns)
  const handlePostClick = useCallback((postOrId: any) => {
    const postId = typeof postOrId === 'string' ? postOrId : postOrId?.id;
    if (!postId) {
      console.error('handlePostClick called with invalid post:', postOrId);
      return;
    }
    navigateTo('post-detail', { postId });
  }, [navigateTo]);

  // Handle scroll to hide/show header on mobile
  const handleScroll = useCallback((scrollY: number) => {
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
  }, [headerTranslateY]);

  // Handle bottom nav navigation
  // Bottom nav acts as "tab switching" - clears history and goes directly to the view
  const handleBottomNavigation = (view: 'feed' | 'discovery' | 'create' | 'notifications' | 'profile') => {
    if (view === 'create') {
      // Require auth to create posts
      if (requireAuth('Sign in to create posts')) {
        setIsCreatePostOpen(true);
      }
      return;
    }

    // Require auth for notifications and profile (own profile)
    if (view === 'notifications') {
      if (!requireAuth('Sign in to see your notifications')) return;
    }
    if (view === 'profile') {
      if (!requireAuth('Sign in to see your profile')) return;
    }

    // Clear navigation history and view params when switching tabs via bottom nav
    // This is the expected UX: tapping a tab = "go to root of that tab"
    setNavigationHistory([]);
    setViewParams(null);

    // When navigating to feed, clear search and refresh feed data
    if (view === 'feed') {
      setSearchQuery('');
      setSearchUserResults([]); // Clear user search results
      setFeedMode('global');
      setSelectedNodeId(null);
      fetchFeed(null, 'global');
    }
    setCurrentView(view);
  };



  const [algoSettings, setAlgoSettings] = useState<VibeValidatorSettings>({
    preset: 'balanced',
    weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
    mode: 'simple',
    intermediate: {
      timeRange: 'all',
      discoveryRate: 15,
      hideMutedWords: true,
      showSeenPosts: false,
      textOnly: false,
      mediaOnly: false,
      linksOnly: false,
      hasDiscussion: false,
      textDensity: 'any',
      mediaType: 'any',
    },
    advanced: {
      authorCredWeight: 50,
      vectorQualityWeight: 35,
      confidenceWeight: 15,
      timeDecay: 60,
      velocity: 25,
      freshness: 15,
      halfLifeHours: 12,
      decayFunction: 'exponential',
      intensity: 40,
      discussionDepth: 30,
      shareWeight: 20,
      expertCommentBonus: 10,
      followingWeight: 50,
      alignment: 20,
      affinity: 15,
      trustNetwork: 15,
      vectorMultipliers: {
        insightful: 100,
        joy: 100,
        fire: 100,
        support: 100,
        shock: 100,
        questionable: 100,
      },
      antiAlignmentPenalty: 20,
    },
    expert: {
      maxPostsPerAuthor: 3,
      topicClusteringPenalty: 20,
      textRatio: 40,
      imageRatio: 25,
      videoRatio: 20,
      linkRatio: 15,
      explorationPool: 'global',
      enableExperiments: false,
      timeBasedProfiles: false,
      moodToggle: 'normal',
    },
  });

  // Map frontend preset IDs to backend preset IDs
  // Frontend uses user-friendly names, backend has different naming
  const mapPresetToBackend = (preset: string | undefined): "latest" | "balanced" | "popular" | "expert" | "personal" | "custom" => {
    switch (preset) {
      case 'latest': return 'latest';
      case 'balanced': return 'balanced';
      case 'trending': return 'popular';  // Frontend "What's Hot" -> Backend "popular"
      case 'expert': return 'expert';
      case 'network': return 'personal';  // Frontend "My Network" -> Backend "personal"
      case 'custom': return 'custom';
      default: return 'custom';  // Any unknown preset treated as custom
    }
  };

  // Map backend preset IDs to frontend preset IDs (for loading)
  const mapPresetFromBackend = (preset: string | null | undefined): string => {
    switch (preset) {
      case 'latest': return 'latest';
      case 'balanced': return 'balanced';
      case 'popular': return 'trending';  // Backend "popular" -> Frontend "trending"
      case 'expert': return 'expert';
      case 'personal': return 'network';  // Backend "personal" -> Frontend "network"
      case 'custom': return 'custom';
      default: return 'balanced';  // Default fallback
    }
  };

  // Load ALL feed preferences from backend on mount
  // Returns the loaded settings so caller can update ref synchronously
  const loadFeedPreferences = async (): Promise<VibeValidatorSettings | null> => {
    try {
      const prefs = await getFeedPreferences();
      const settings: VibeValidatorSettings = {
        preset: mapPresetFromBackend(prefs.presetMode),
        weights: {
          quality: prefs.qualityWeight,
          recency: prefs.recencyWeight,
          engagement: prefs.engagementWeight,
          personalization: prefs.personalizationWeight,
        },
        mode: 'simple', // Mode is UI-only, not persisted
        intermediate: {
          timeRange: (prefs.timeRange as any) || 'all',
          discoveryRate: prefs.discoveryRate ?? 15,
          hideMutedWords: prefs.hideMutedWords ?? true,
          showSeenPosts: prefs.showSeenPosts ?? false,
          textOnly: prefs.textOnly ?? false,
          mediaOnly: prefs.mediaOnly ?? false,
          linksOnly: prefs.linksOnly ?? false,
          hasDiscussion: prefs.hasDiscussion ?? false,
          textDensity: 'any',
          mediaType: 'any',
        },
        advanced: {
          authorCredWeight: prefs.authorCredWeight ?? 50,
          vectorQualityWeight: prefs.vectorQualityWeight ?? 35,
          confidenceWeight: prefs.confidenceWeight ?? 15,
          timeDecay: prefs.timeDecay ?? 60,
          velocity: prefs.velocity ?? 25,
          freshness: prefs.freshness ?? 15,
          halfLifeHours: prefs.halfLifeHours ?? 12,
          decayFunction: (prefs.decayFunction as any) ?? 'exponential',
          intensity: prefs.intensity ?? 40,
          discussionDepth: prefs.discussionDepth ?? 30,
          shareWeight: prefs.shareWeight ?? 20,
          expertCommentBonus: prefs.expertCommentBonus ?? 10,
          followingWeight: prefs.followingWeight ?? 50,
          alignment: prefs.alignment ?? 20,
          affinity: prefs.affinity ?? 15,
          trustNetwork: prefs.trustNetwork ?? 15,
          vectorMultipliers: prefs.vectorMultipliers ?? {
            insightful: 100,
            joy: 100,
            fire: 100,
            support: 100,
            shock: 100,
            questionable: 100,
          },
          antiAlignmentPenalty: prefs.antiAlignmentPenalty ?? 20,
        },
        expert: {
          maxPostsPerAuthor: prefs.maxPostsPerAuthor ?? 3,
          topicClusteringPenalty: prefs.topicClusteringPenalty ?? 20,
          textRatio: prefs.textRatio ?? 40,
          imageRatio: prefs.imageRatio ?? 25,
          videoRatio: prefs.videoRatio ?? 20,
          linkRatio: prefs.linkRatio ?? 15,
          explorationPool: (prefs.explorationPool as any) ?? 'global',
          enableExperiments: prefs.enableExperiments ?? false,
          timeBasedProfiles: prefs.timeBasedProfiles ?? false,
          moodToggle: (prefs.moodToggle as any) ?? 'normal',
        },
      };
      setAlgoSettings(settings);
      return settings;
    } catch (error) {
      // Use default feed preferences
      return null;
    }
  };

  // Save ALL feed preferences to backend (debounced in effect)
  const saveFeedPreferences = async (settings: typeof algoSettings) => {
    try {
      await updateFeedPreferences({
        // Basic
        preset: mapPresetToBackend(settings.preset),
        qualityWeight: settings.weights.quality,
        recencyWeight: settings.weights.recency,
        engagementWeight: settings.weights.engagement,
        personalizationWeight: settings.weights.personalization,

        // Intermediate
        timeRange: settings.intermediate?.timeRange,
        discoveryRate: settings.intermediate?.discoveryRate,
        hideMutedWords: settings.intermediate?.hideMutedWords,
        showSeenPosts: settings.intermediate?.showSeenPosts,
        textOnly: settings.intermediate?.textOnly,
        mediaOnly: settings.intermediate?.mediaOnly,
        linksOnly: settings.intermediate?.linksOnly,
        hasDiscussion: settings.intermediate?.hasDiscussion,

        // Advanced - Quality
        authorCredWeight: settings.advanced?.authorCredWeight,
        vectorQualityWeight: settings.advanced?.vectorQualityWeight,
        confidenceWeight: settings.advanced?.confidenceWeight,

        // Advanced - Recency
        timeDecay: settings.advanced?.timeDecay,
        velocity: settings.advanced?.velocity,
        freshness: settings.advanced?.freshness,
        halfLifeHours: settings.advanced?.halfLifeHours,
        decayFunction: settings.advanced?.decayFunction,

        // Advanced - Engagement
        intensity: settings.advanced?.intensity,
        discussionDepth: settings.advanced?.discussionDepth,
        shareWeight: settings.advanced?.shareWeight,
        expertCommentBonus: settings.advanced?.expertCommentBonus,

        // Advanced - Personalization
        followingWeight: settings.advanced?.followingWeight,
        alignment: settings.advanced?.alignment,
        affinity: settings.advanced?.affinity,
        trustNetwork: settings.advanced?.trustNetwork,

        // Advanced - Vectors
        vectorMultipliers: settings.advanced?.vectorMultipliers,
        antiAlignmentPenalty: settings.advanced?.antiAlignmentPenalty,

        // Expert
        maxPostsPerAuthor: settings.expert?.maxPostsPerAuthor,
        topicClusteringPenalty: settings.expert?.topicClusteringPenalty,
        textRatio: settings.expert?.textRatio,
        imageRatio: settings.expert?.imageRatio,
        videoRatio: settings.expert?.videoRatio,
        linkRatio: settings.expert?.linkRatio,
        explorationPool: settings.expert?.explorationPool,
        enableExperiments: settings.expert?.enableExperiments,
        timeBasedProfiles: settings.expert?.timeBasedProfiles,
        moodToggle: settings.expert?.moodToggle,
      });
    } catch (error) {
      console.error('Failed to save feed preferences:', error);
    }
  };

  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024; // 3-column breakpoint

  const [nodes, setNodes] = useState<Array<Node & { type: string; color: string }>>([]);

  const fetchNodes = async () => {
    try {
      const data = await getNodes();
      // Map API nodes to UI nodes (preserve avatar/color, add defaults if missing)
      const mappedNodes = data.map((n: any) => ({
        ...n,
        type: 'child', // Default type
        color: n.color || '#6366f1', // Use API color or consistent fallback (matches NodeLandingPage)
      }));
      setNodes(mappedNodes);
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    }
  };

  const [feedMode, setFeedMode] = useState<'global' | 'discovery' | 'following'>('global');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Refs to track latest values for the debounced effect (avoids stale closures)
  const feedModeRef = useRef(feedMode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const algoSettingsRef = useRef(algoSettings);

  // Keep refs in sync with state
  useEffect(() => {
    feedModeRef.current = feedMode;
  }, [feedMode]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    algoSettingsRef.current = algoSettings;
  }, [algoSettings]);

  const mapPost = (p: any) => ({
    id: p.id,
    node: { id: p.node?.id, name: p.node?.name || 'Global', slug: p.node?.slug || 'global', color: '#6366f1' },
    author: {
      id: p.author.id,
      username: p.author.username || 'User',
      avatar: p.author.avatar,
      era: p.author.era || 'Lurker Era',
      cred: p.author.cred || 0
    },
    title: p.title || 'Untitled Post',
    content: p.content,
    contentJson: p.contentJson, // TipTap JSON for rich text
    contentFormat: p.contentFormat, // 'markdown' | 'tiptap'
    commentCount: p.commentCount,
    createdAt: p.createdAt,
    expertGated: false,
    vibes: [],
    linkUrl: p.linkUrl,
    mediaUrl: p.mediaUrl, // Direct image/video URL from Reddit etc.
    linkMeta: p.linkMeta,
    poll: p.poll,
    myReaction: p.myReaction,
    vibeAggregate: p.vibeAggregate,
    isSaved: p.isSaved ?? false,
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
  });

  const fetchFeed = async (nodeId?: string | null, mode: 'global' | 'discovery' | 'following' = 'global') => {
    // Use ref to get latest algoSettings to avoid stale closure issues during initialization
    const settings = algoSettingsRef.current;
    const source = feedSourceRef.current;
    setLoading(true);
    setNextCursor(undefined);
    setHasMore(true);
    setExternalPosts([]);

    try {
      // For external-only feeds (Bluesky or Mastodon only)
      if (source === 'bluesky') {
        const result = await getBlueskyDiscover(20);
        setExternalPosts(result.posts);
        setPosts([]);
        setHasMore(!!result.nextCursor);
        setNextCursor(result.nextCursor);
        return;
      }

      if (source === 'mastodon') {
        const result = await getMastodonTrending('mastodon.social', 20);
        setExternalPosts(result.posts);
        setPosts([]);
        setHasMore(!!result.nextCursor);
        setNextCursor(result.nextCursor);
        return;
      }

      // For mixed feed, fetch both in parallel
      if (source === 'mixed') {
        const params: any = {
          nodeId: nodeId || undefined,
          limit: 15, // Fetch fewer Node posts to make room for external
          timeRange: settings.intermediate?.timeRange,
          textOnly: settings.intermediate?.textOnly,
          mediaOnly: settings.intermediate?.mediaOnly,
          linksOnly: settings.intermediate?.linksOnly,
          hasDiscussion: settings.intermediate?.hasDiscussion,
          qualityWeight: settings.weights.quality,
          recencyWeight: settings.weights.recency,
          engagementWeight: settings.weights.engagement,
          personalizationWeight: settings.weights.personalization,
        };

        const [nodeData, externalData] = await Promise.all([
          getFeed(params),
          getCombinedExternalFeed(['bluesky', 'mastodon'], 10),
        ]);

        const mappedPosts = nodeData.posts.map(mapPost);
        setPosts(mappedPosts);
        setExternalPosts(externalData.posts);
        setNextCursor(nodeData.nextCursor);
        setHasMore(nodeData.hasMore);
        return;
      }

      // Node Social only feed
      const params: any = {
        nodeId: nodeId || undefined,
        limit: 20,
        // Pass intermediate filters from algoSettings (apply to all modes)
        timeRange: settings.intermediate?.timeRange,
        textOnly: settings.intermediate?.textOnly,
        mediaOnly: settings.intermediate?.mediaOnly,
        linksOnly: settings.intermediate?.linksOnly,
        hasDiscussion: settings.intermediate?.hasDiscussion,
      };

      if (mode === 'discovery') {
        // Use preset for discovery - let backend apply preset's default weights
        params.preset = 'popular';
      } else if (mode === 'following') {
        // Following mode uses user's weights but filters to followed users
        params.followingOnly = true;
        params.qualityWeight = settings.weights.quality;
        params.recencyWeight = settings.weights.recency;
        params.engagementWeight = settings.weights.engagement;
        params.personalizationWeight = settings.weights.personalization;
      } else {
        // Global mode uses user's custom algorithm weights
        params.qualityWeight = settings.weights.quality;
        params.recencyWeight = settings.weights.recency;
        params.engagementWeight = settings.weights.engagement;
        params.personalizationWeight = settings.weights.personalization;
      }

      const data = await getFeed(params);

      const mappedPosts = data.posts.map(mapPost);
      setPosts(mappedPosts);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed(selectedNodeId, feedMode);
  }, [selectedNodeId, feedMode]);

  // Handler for quoting an external post to Node
  const handleQuoteExternalPost = (post: ExternalPost) => {
    setQuotedExternalPost(post);
    setIsCreatePostOpen(true);
  };

  // Handler for saving an external post locally
  // TODO: Implement proper external post saving to backend
  const handleSaveExternalPost = (post: ExternalPost) => {
    // For now, just show a toast - full implementation requires backend support
    console.log('Saving external post:', post.id);
    // Could save to local storage or add an API endpoint for saving external post references
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    const settings = algoSettingsRef.current;
    const mode = feedModeRef.current;
    const nodeId = selectedNodeIdRef.current;

    setLoadingMore(true);
    try {
      const params: any = {
        nodeId: nodeId || undefined,
        cursor: nextCursor,
        limit: 20,
        timeRange: settings.intermediate?.timeRange,
        textOnly: settings.intermediate?.textOnly,
        mediaOnly: settings.intermediate?.mediaOnly,
        linksOnly: settings.intermediate?.linksOnly,
        hasDiscussion: settings.intermediate?.hasDiscussion,
      };

      if (mode === 'discovery') {
        params.preset = 'popular';
      } else if (mode === 'following') {
        params.followingOnly = true;
        params.qualityWeight = settings.weights.quality;
        params.recencyWeight = settings.weights.recency;
        params.engagementWeight = settings.weights.engagement;
        params.personalizationWeight = settings.weights.personalization;
      } else {
        params.qualityWeight = settings.weights.quality;
        params.recencyWeight = settings.weights.recency;
        params.engagementWeight = settings.weights.engagement;
        params.personalizationWeight = settings.weights.personalization;
      }

      const data = await getFeed(params);
      const mappedPosts = data.posts.map(mapPost);

      // Deduplicate posts when appending (in case of overlap)
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = mappedPosts.filter(p => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to load more posts:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Debounced feed refresh and preference save when algo settings change
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const initialFetchDone = useRef(false);
  useEffect(() => {
    // Don't start the timer until settings are initialized
    // This prevents double-fetch: one with defaults, one with loaded preferences
    if (!settingsInitialized) return;

    // On initial load, fetch immediately (no delay) to ensure we use fresh algoSettings
    // Subsequent changes use debounce to avoid excessive API calls
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchFeed(selectedNodeIdRef.current, feedModeRef.current);
      return;
    }

    const timer = setTimeout(() => {
      // Use refs to get latest feedMode/selectedNodeId without them as dependencies
      // This avoids duplicate fetches since handlers already call fetchFeed directly
      fetchFeed(selectedNodeIdRef.current, feedModeRef.current);
      saveFeedPreferences(algoSettings);
    }, 500);
    return () => clearTimeout(timer);
  }, [algoSettings, settingsInitialized]);

  const handleNodeSelect = (nodeId: string | null, name?: string, _slug?: string) => {
    // In multi-column mode ON DESKTOP, update the first column AND manage node-info column
    if (isDesktop && isMultiColumnEnabled && nodeId) {
      const node = nodes.find(n => n.id === nodeId);
      const nodeName = name || node?.name || 'Node';
      const store = useColumnsStore.getState();
      const columns = store.columns;

      if (columns.length > 0) {
        // Update the first column to show this node's feed
        store.updateColumn(columns[0].id, {
          type: 'node',
          nodeId,
          title: nodeName
        });

        // Find any existing node-info column (we only keep one, always beside the feed)
        const existingInfoColIndex = columns.findIndex(c => c.type === 'node-info');

        if (existingInfoColIndex !== -1) {
          // Update the existing node-info column with the new node
          store.updateColumn(columns[existingInfoColIndex].id, {
            type: 'node-info',
            nodeId,
            title: `${nodeName} Info`
          });

          // If it's not already at position 1 (right after feed), move it there
          if (existingInfoColIndex !== 1) {
            store.reorderColumns(existingInfoColIndex, 1);
          }
        } else {
          // No node-info column exists, add one and move it to position 1
          store.addColumn({
            type: 'node-info',
            nodeId,
            title: `${nodeName} Info`
          });

          // After adding, it's at the end - move it to position 1
          const newColumns = store.columns;
          if (newColumns.length > 2) {
            store.reorderColumns(newColumns.length - 1, 1);
          }
        }
      }
      return; // Don't change main feed state in multi-column mode
    }

    // Single-feed mode: original behavior
    setSelectedNodeId(nodeId);
    setSearchQuery(''); // Clear search when changing nodes
    setSearchUserResults([]); // Clear user search results
    setCurrentView('feed'); // Always return to feed view when selecting a node
    setFeedMode('global');
    fetchFeed(nodeId, 'global');

    // Theme override: apply node theme when entering a community, clear when leaving
    if (nodeId) {
      // Fetch node details to get customTheme (fire-and-forget)
      import('./src/lib/api').then(({ getNodeDetails }) => {
        getNodeDetails(nodeId).then((details) => {
          if (details?.customTheme && typeof details.customTheme === 'object') {
            useThemeStore.getState().setNodeThemeOverride(details.customTheme as Partial<ThemeTokens>);
          } else {
            useThemeStore.getState().clearNodeOverride();
          }
        }).catch(() => {
          // Silently fail — keep current theme
        });
      });
    } else {
      useThemeStore.getState().clearNodeOverride();
    }
  };

  const handleFeedModeSelect = (mode: 'global' | 'discovery' | 'following') => {
    setFeedMode(mode);
    setSelectedNodeId(null); // Clear node selection
    setSearchQuery('');
    setSearchUserResults([]); // Clear user search results
    // Clear node theme override when leaving a node
    useThemeStore.getState().clearNodeOverride();

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
  const [searchUserResults, setSearchUserResults] = useState<SearchUser[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchUserResults([]);
      fetchFeed(selectedNodeId, feedMode);
      return;
    }
    setLoading(true);
    setCurrentView('feed'); // Switch to feed view to show search results
    try {
      // Search both posts and users
      const [postsData, usersData] = await Promise.all([
        searchPosts(searchQuery),
        searchUsers(searchQuery, 5), // Limit to 5 user results
      ]);

      setSearchUserResults(usersData.users || []);

      const mappedPosts = postsData.posts.map((p: any) => ({
        id: p.id,
        node: { id: p.node?.id, name: p.node?.name || 'Global', slug: p.node?.slug || 'global', color: '#6366f1' },
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
        linkUrl: p.linkUrl,
        mediaUrl: p.mediaUrl,
        linkMeta: p.linkMeta,
        poll: p.poll,
        myReaction: p.myReaction,
        vibeAggregate: p.vibeAggregate,
        isSaved: p.isSaved ?? false,
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

  // Helper for sidebar search - sets query state then searches
  const handleSearchWithQuery = (query: string) => {
    setSearchQuery(query);
    // Execute search directly with the query (don't rely on state)
    if (!query.trim()) {
      setSearchUserResults([]);
      fetchFeed(selectedNodeId, feedMode);
      return;
    }
    setLoading(true);
    setCurrentView('feed');
    Promise.all([
      searchPosts(query),
      searchUsers(query, 5),
    ]).then(([postsData, usersData]) => {
      setSearchUserResults(usersData.users || []);
      const mappedPosts = postsData.posts.map((p: any) => ({
        id: p.id,
        node: { id: p.node?.id, name: p.node?.name || 'Global', slug: p.node?.slug || 'global', color: '#6366f1' },
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
        linkUrl: p.linkUrl,
        mediaUrl: p.mediaUrl,
        linkMeta: p.linkMeta,
        poll: p.poll,
        myReaction: p.myReaction,
        vibeAggregate: p.vibeAggregate,
        isSaved: p.isSaved ?? false,
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
    }).catch(error => {
      console.error('Search failed:', error);
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    const init = async () => {
      // Parallelize init calls for faster startup (-1.5-2s improvement)
      const [_, loadedSettings] = await Promise.all([
        fetchNodes(),
        loadFeedPreferences(),
      ]);
      // Load column config after nodes (may reference node data)
      await loadColumnsConfig();
      // Update ref synchronously before triggering the fetch effect
      // This ensures fetchFeed uses the loaded settings, not defaults
      if (loadedSettings) {
        algoSettingsRef.current = loadedSettings;
      }
      // Setting this to true triggers the debounced effect which fetches immediately
      // on first run (see initialFetchDone ref) - ensures fresh algoSettings are used
      setSettingsInitialized(true);
    };
    init();
  }, []);

  // Socket.io Integration for Real-time Feed
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;

    // Use refs to access current state values without adding them as dependencies
    // This prevents re-registering the listener on every feedMode/selectedNodeId change
    const handleNewPost = (newPost: any) => {
      // Only add post if it matches the current feed view
      const postNodeId = newPost.node?.id || null;
      const currentFeedMode = feedModeRef.current;
      const currentNodeId = selectedNodeIdRef.current;

      // Filter based on current feed mode and selected node
      if (currentFeedMode === 'following') {
        // In following mode, skip real-time updates (would need follow list to filter properly)
        // Let the user refresh to see new posts from followed users
        return;
      }

      if (currentFeedMode === 'discovery') {
        // In discovery mode, skip real-time updates (algorithm-based feed)
        return;
      }

      // In global mode: only add if no node selected OR post matches selected node
      if (currentNodeId && postNodeId !== currentNodeId) {
        // User is viewing a specific node, but this post is from a different node
        return;
      }

      // Map the raw post to the UI format
      // Use null (not undefined) for missing node ID to match postNodeId above
      const mappedPost = {
        id: newPost.id,
        node: { id: postNodeId, name: newPost.node?.name || 'Global', slug: newPost.node?.slug || 'global', color: '#6366f1' },
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
        linkUrl: newPost.linkUrl,
        linkMeta: newPost.linkMeta,
        poll: newPost.poll,
        myReaction: null,
        vibeAggregate: null, // New posts start with no aggregate
        isSaved: false, // New posts start unsaved
        comments: []
      };

      // Only add if not already in feed (avoid duplicates from real-time + refresh)
      setPosts(prev => {
        if (prev.some(p => p.id === mappedPost.id)) {
          return prev; // Already exists, don't add duplicate
        }
        return [mappedPost, ...prev];
      });
    };

    socket.on('post:new', handleNewPost);

    return () => {
      socket.off('post:new', handleNewPost);
    };
  }, [socket]);


  // Status bar height for positioning
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Persistent status bar background - always visible behind notch/status bar area */}
      {!isDesktop && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: statusBarHeight,
          backgroundColor: theme.bg,
          zIndex: 200,
        }} />
      )}

      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>

        {/* Desktop Sidebar */}
        {isDesktop && (
          <View style={[styles.drawerLeft, { backgroundColor: theme.panel }, sidebarCollapsed && styles.drawerLeftCollapsed]}>
            <Sidebar
              nodes={nodes}
              isDesktop={true}
              user={user ?? undefined}
              onProfileClick={() => navigateTo('profile')}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
              onNodeInfo={(nodeId) => {
                setNodeInfoNodeId(nodeId);
                setNodeInfoVisible(true);
              }}
              feedMode={feedMode}
              onFeedModeSelect={handleFeedModeSelect}
              onSettingsClick={() => navigateTo('settings')}
              onSavedClick={() => requireAuth('Sign in to see your saved posts') && navigateTo('saved')}
              onNewPostClick={() => requireAuth('Sign in to create posts') && setIsCreatePostOpen(true)}
              onGovernanceClick={() => requireAuth('Sign in to access governance') && navigateTo('governance')}
              onNotificationsClick={() => requireAuth('Sign in to see your notifications') && navigateTo('notifications')}
              onMessagesClick={() => requireAuth('Sign in to access messages') && navigateTo('messages')}
              onAddColumnClick={() => setShowAddColumnModal(true)}
              unreadNotifications={0}
              unreadMessages={0}
              isMultiColumnEnabled={isMultiColumnEnabled}
              currentView={currentView}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onSearch={handleSearchWithQuery}
            />
          </View>
        )}

        {/* Main Content Wrapper */}
        <View style={{ flex: 1, borderLeftWidth: isDesktop ? 1 : 0, borderRightWidth: isDesktop ? 1 : 0, borderColor: theme.border }}>

          {/* Mobile Header */}
          {!isDesktop && (
            <Animated.View style={[
              styles.mobileHeader,
              { transform: [{ translateY: headerTranslateY }] }
            ]}>
              <FeedHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearch={handleSearch}
                algoSettings={algoSettings}
                onVibeClick={() => setVibeVisible(true)}
                feedSource={feedSource}
                onFeedSourceChange={(source) => {
                  setFeedSource(source);
                  // Trigger fetch with new source
                  fetchFeed(selectedNodeId, feedMode);
                }}
                onMenuClick={() => setMenuVisible(true)}
                isDesktop={false}
              />
              {/* Node Header - Show when viewing a specific node, animates with main header */}
              {selectedNodeId && currentView === 'feed' && (() => {
                const currentNode = nodes.find(n => n.id === selectedNodeId);
                if (!currentNode) return null;
                return (
                  <View style={[styles.mobileNodeHeader, { backgroundColor: theme.panel, borderBottomColor: theme.border }]}>
                    <TouchableOpacity
                      style={[styles.mobileNodeHeaderBack, { backgroundColor: theme.bg, borderColor: theme.border }]}
                      onPress={() => handleNodeSelect(null)}
                    >
                      <Text style={[styles.mobileNodeHeaderBackText, { color: theme.textSecondary }]}>← All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.mobileNodeHeaderInfo}
                      onPress={() => {
                        setNodeInfoNodeId(selectedNodeId);
                        setNodeInfoVisible(true);
                      }}
                    >
                      {currentNode.avatar ? (
                        <Image
                          source={{ uri: currentNode.avatar }}
                          style={styles.mobileNodeHeaderAvatar}
                        />
                      ) : (
                        <View style={[styles.mobileNodeHeaderAvatar, { backgroundColor: currentNode.color || '#6366f1' }]}>
                          <Text style={styles.mobileNodeHeaderAvatarText}>
                            {currentNode.name?.charAt(0).toUpperCase() || 'N'}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.mobileNodeHeaderName, { color: theme.text }]} numberOfLines={1}>
                        {currentNode.name}
                      </Text>
                      <HelpCircle size={16} color={theme.muted} />
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </Animated.View>
          )}

          {/* Scrollable Content - Full Width */}
          <View style={{ width: '100%', maxWidth: '100%', flex: 1 }}>
            {currentView === 'feed' ? (
              <View style={{ flex: 1 }}>
                {/* Desktop Multi-Column Mode */}
                {isDesktop && isMultiColumnEnabled ? (
                  <MultiColumnContainer
                    currentUser={user}
                    nodes={nodes}
                    globalNodeId={nodes.find(n => n.slug === 'global')?.id}
                    onPostClick={handlePostClick}
                    onAuthorClick={(authorId) => navigateTo('profile', { userId: authorId })}
                    onUserClick={(userId) => navigateTo('profile', { userId })}
                    onPostAction={(postId, _action) => {
                      setPosts(prev => prev.filter(p => p.id !== postId));
                    }}
                    onSaveToggle={(postId, saved) => {
                      setPosts(prev => prev.map(p =>
                        p.id === postId ? { ...p, isSaved: saved } : p
                      ));
                    }}
                    onNodeClick={handleNodeSelect}
                    showAddModal={showAddColumnModal}
                    onCloseAddModal={() => setShowAddColumnModal(false)}
                    onQuoteExternalPost={handleQuoteExternalPost}
                    onSaveExternalPost={handleSaveExternalPost}
                    onEdit={(post) => {
                      setEditingPost(post);
                      setIsEditPostOpen(true);
                    }}
                  />
                ) : (
                  /* Mobile/Tablet Single Feed */
                  loading && posts.length === 0 ? (
                    <SkeletonFeed count={6} />
                  ) : (
                    <Feed
                      posts={posts}
                      externalPosts={externalPosts}
                      currentUser={user}
                      onPostAction={(postId, _action) => {
                        // Optimistic update: remove post from feed
                        setPosts(prev => prev.filter(p => p.id !== postId));
                      }}
                      onPostClick={handlePostClick}
                      onEdit={(post) => {
                        setEditingPost(post);
                        setIsEditPostOpen(true);
                      }}
                      onAuthorClick={(authorId) => {
                        navigateTo('profile', { userId: authorId });
                      }}
                      onSaveToggle={(postId, saved) => {
                        // Update post's saved state in feed
                        setPosts(prev => prev.map(p =>
                          p.id === postId ? { ...p, isSaved: saved } : p
                        ));
                      }}
                      globalNodeId={nodes.find(n => n.slug === 'global')?.id}
                      onScroll={!isDesktop ? handleScroll : undefined}
                      headerOffset={!isDesktop ? (selectedNodeId ? 64 + 44 : 64) : 0}
                      onLoadMore={loadMorePosts}
                      hasMore={hasMore}
                      loadingMore={loadingMore}
                      searchUserResults={searchUserResults}
                      onUserClick={(userId) => navigateTo('profile', { userId })}
                      onRefresh={handleRefresh}
                      refreshing={refreshing}
                      onQuoteExternalPost={handleQuoteExternalPost}
                      onSaveExternalPost={handleSaveExternalPost}
                    />
                  )
                )}
              </View>
            ) : currentView === 'profile' ? (
              <ProfileScreen
                key={viewParams?.userId || 'own-profile'}
                onBack={goBack}
                onCredClick={() => navigateTo('cred-history')}
                userId={viewParams?.userId}
                onViewTrustGraph={() => navigateTo('trust-graph')}
              />
            ) : currentView === 'notifications' ? (
              <NotificationsScreen
                onBack={goBack}
                onNavigateToPost={(postId) => {
                  navigateTo('post-detail', { postId });
                }}
                onNavigateToUser={(userId) => {
                  navigateTo('profile', { userId });
                }}
              />
            ) : currentView === 'saved' ? (
              <SavedPostsScreen
                onBack={goBack}
                onPostClick={handlePostClick}
                onAuthorClick={(authorId) => navigateTo('profile', { userId: authorId })}
              />
            ) : currentView === 'cred-history' ? (
              <CredHistoryScreen onBack={goBack} />
            ) : currentView === 'settings' ? (
              <SettingsScreen
                onBack={goBack}
                onNavigate={(screen) => navigateTo(screen as typeof currentView)}
                user={user ?? undefined}
                onUserUpdate={(updatedUser) => {
                  useAuthStore.getState().updateUser(updatedUser);
                }}
              />
            ) : currentView === 'themes' ? (
              <ThemesScreen
                onBack={goBack}
                onEditTheme={() => navigateTo('theme-editor')}
              />
            ) : currentView === 'theme-editor' ? (
              <ThemeEditorScreen onBack={goBack} />
            ) : currentView === 'messages' ? (
              <MessagesScreen
                onBack={goBack}
                onNavigate={(screen, params) => {
                  navigateTo(screen as typeof currentView, params);
                }}
              />
            ) : currentView === 'chat' ? (
              <ChatScreen
                onBack={goBack}
                conversationId={viewParams?.conversationId}
                recipient={viewParams?.recipient}
              />
            ) : currentView === 'discovery' ? (
              <DiscoveryScreen
                onBack={goBack}
                onPostClick={handlePostClick}
                onUserClick={(userId) => navigateTo('profile', { userId })}
              />
            ) : currentView === 'following' ? (
              <FollowingScreen onBack={goBack} onPostClick={handlePostClick} />
            ) : currentView === 'post-detail' ? (
              <PostDetailScreen
                postId={viewParams?.postId}
                onBack={goBack}
                onAuthorClick={(authorId) => {
                  navigateTo('profile', { userId: authorId });
                }}
                onCommentAdded={(postId) => {
                  // Update comment count in feed's posts array
                  setPosts(prev => prev.map(p =>
                    p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p
                  ));
                }}
              />
            ) : currentView === 'governance' || currentView === 'moderation' || currentView === 'appeals' || currentView === 'council' || currentView === 'vouches' || currentView === 'trust-graph' || currentView === 'blocked-muted' ? (
              <GovernanceScreen
                onBack={goBack}
                initialTab={
                  currentView === 'moderation' ? 'moderation' :
                  currentView === 'council' ? 'council' :
                  currentView === 'trust-graph' || currentView === 'vouches' ? 'trust' :
                  currentView === 'appeals' ? 'appeals' :
                  currentView === 'blocked-muted' ? 'blocked' :
                  (viewParams?.initialTab || 'moderation')
                }
                nodeId={selectedNodeId || 'global'}
                nodeName={nodes.find(n => n.id === selectedNodeId)?.name || 'Global'}
                userId={viewParams?.userId}
                onUserClick={(uid: string) => navigateTo('profile', { userId: uid })}
              />
            ) : currentView === 'nodeSettings' && selectedNodeId ? (
              <NodeSettingsScreen
                nodeId={selectedNodeId}
                onBack={goBack}
              />
            ) : currentView === 'modLog' && selectedNodeId ? (
              <ModLogScreen
                nodeId={selectedNodeId}
                nodeName={nodes.find(n => n.id === selectedNodeId)?.name || 'Node'}
                onBack={goBack}
              />
            ) : null}

          </View>
        </View>

        {/* Desktop Right Panel - Hidden when multi-column mode is enabled (WhatsVibing is now a column type) */}
        {isDesktop && !isMultiColumnEnabled && (
          <View style={[styles.drawerRight, { backgroundColor: theme.panel }]}>
            {selectedNodeId ? (
              <NodeLandingPage
                nodeId={selectedNodeId}
                onNavigateToSettings={() => {
                  navigateTo('nodeSettings');
                }}
                onNavigateToModLog={() => {
                  navigateTo('modLog');
                }}
                onMessageCouncil={() => {
                  navigateTo('council');
                }}
                onStartChat={async (userId) => {
                  try {
                    const { startConversation } = await import('./src/lib/api');
                    const conversation = await startConversation(userId);
                    navigateTo('chat', { conversationId: conversation.id });
                  } catch (error) {
                    console.error('Failed to start conversation:', error);
                  }
                }}
              />
            ) : (
              <WhatsVibing
                onNodeClick={(nodeId) => handleNodeSelect(nodeId)}
              />
            )}
          </View>
        )}

        </View>

        {/* Mobile Bottom Nav - Outside the row, at bottom of screen */}
        {!isDesktop && (
          <MobileBottomNav
            currentView={currentView}
            onNavigate={handleBottomNavigation}
            unreadNotifications={0}
            unreadMessages={0}
          />
        )}

      </View>

      {/* --- MOBILE MODALS --- */}

      {/* Left Menu Modal - show on mobile and tablet (not desktop) */}
      {!isDesktop && (
        <Modal visible={menuVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.drawerLeft, { backgroundColor: theme.panel }]}>
              <Sidebar
                nodes={nodes}
                onClose={() => setMenuVisible(false)}
                user={user ?? undefined}
                onProfileClick={() => {
                  setMenuVisible(false);
                  navigateTo('profile');
                }}
                selectedNodeId={selectedNodeId}
                onNodeSelect={handleNodeSelect}
                onNodeInfo={(nodeId) => {
                  // Don't close the sidebar - show NodeInfoSheet on top
                  setNodeInfoNodeId(nodeId);
                  setNodeInfoVisible(true);
                }}
                feedMode={feedMode}
                onFeedModeSelect={handleFeedModeSelect}
                onSettingsClick={() => {
                  setMenuVisible(false);
                  navigateTo('settings');
                }}
                onSavedClick={() => {
                  setMenuVisible(false);
                  navigateTo('saved');
                }}
                onGovernanceClick={() => {
                  setMenuVisible(false);
                  if (requireAuth('Sign in to access governance')) {
                    navigateTo('governance');
                  }
                }}
                onNotificationsClick={() => {
                  setMenuVisible(false);
                  if (requireAuth('Sign in to see your notifications')) {
                    navigateTo('notifications');
                  }
                }}
                onMessagesClick={() => {
                  setMenuVisible(false);
                  if (requireAuth('Sign in to access messages')) {
                    navigateTo('messages');
                  }
                }}
                unreadNotifications={0}
                unreadMessages={0}
                currentView={currentView}
                onSearch={handleSearchWithQuery}
              />
            </View>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuVisible(false)} />
          </View>
        </Modal>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        visible={isCreatePostOpen}
        onClose={() => {
          setIsCreatePostOpen(false);
          setQuotedExternalPost(null);
        }}
        onSuccess={() => {
          setIsCreatePostOpen(false);
          setQuotedExternalPost(null);
          queryClient.invalidateQueries({ queryKey: ['posts'] });
          fetchFeed(selectedNodeId, feedMode); // Refresh feed after posting
        }}
        nodes={nodes}
        initialNodeId={selectedNodeId}
        quotedExternalPost={quotedExternalPost}
      />

      {/* Edit Post Modal */}
      <EditPostModal
        visible={isEditPostOpen}
        post={editingPost}
        onClose={() => {
          setIsEditPostOpen(false);
          setEditingPost(null);
        }}
        onSuccess={(updatedPost) => {
          setIsEditPostOpen(false);
          setEditingPost(null);
          // Update post in-place instead of re-fetching to avoid losing the post
          setPosts(prev => prev.map(p =>
            p.id === updatedPost.id
              ? {
                  ...p,
                  title: updatedPost.title,
                  content: updatedPost.content,
                  ...(updatedPost.contentJson ? { contentJson: updatedPost.contentJson } : {}),
                }
              : p
          ));
          queryClient.invalidateQueries({ queryKey: ['posts'] });
        }}
      />

      {/* Mobile Vibe Validator - 90% height bottom sheet with X button */}
      {!isDesktop && (
        <Modal visible={vibeVisible} animationType="slide" transparent>
          <View style={styles.vibeModalOverlay}>
            {/* Tap outside area to close */}
            <TouchableOpacity
              style={styles.vibeModalTopSpacer}
              activeOpacity={1}
              onPress={() => setVibeVisible(false)}
            />
            {/* Content */}
            <View style={[styles.vibeModalContent, { backgroundColor: theme.panel }]}>
              <VibeValidator
                settings={algoSettings}
                onUpdate={setAlgoSettings}
                onClose={() => setVibeVisible(false)}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Node Info Sheet */}
      <NodeInfoSheet
        visible={nodeInfoVisible}
        onClose={() => {
          setNodeInfoVisible(false);
          setNodeInfoNodeId(null);
        }}
        nodeId={nodeInfoNodeId}
        onViewPosts={() => {
          if (nodeInfoNodeId) {
            // Close the sidebar menu too when viewing posts
            setMenuVisible(false);
            handleNodeSelect(nodeInfoNodeId);
          }
        }}
      />

    </SafeAreaView>
    </View>
  );
};

export default function App() {
  const theme = useAppTheme();
  const { user, loading, loadFromStorage, markEmailVerified, logout } = useAuthStore();
  // Auth modal state - null means closed, otherwise shows the specified screen
  const [authModal, setAuthModal] = useState<'login' | 'register' | 'forgot-password' | null>(null);
  // Deep link tokens for reset/verify flows
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const emailForVerification = user?.email ?? '';

  // Deep linking setup
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);

      // Validate token format: should be a 64-char hex string (32 bytes)
      const isValidToken = (t: unknown): t is string =>
        typeof t === 'string' && /^[a-f0-9]{64}$/.test(t);

      if (path === 'reset-password' && isValidToken(queryParams?.token)) {
        setResetToken(queryParams.token);
      } else if (path === 'verify-email' && isValidToken(queryParams?.token)) {
        setVerifyToken(queryParams.token);
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

  // Hydrate theme store from local storage on first load
  useEffect(() => {
    useThemeStore.getState().hydrate();
  }, []);

  // Sync user's custom theme from the API when user data arrives
  useEffect(() => {
    if (user?.customTheme && typeof user.customTheme === 'object') {
      useThemeStore.getState().setUserTheme(user.customTheme as Partial<ThemeTokens>);
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <ErrorBoundary>
    <SafeAreaProvider style={{ flex: 1, backgroundColor: theme.bg }}>
      <PortalProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

        {/* Main App - always shown, works for anonymous and logged-in users */}
        <AuthPromptProvider
          user={user}
          onLogin={() => setAuthModal('login')}
          onRegister={() => setAuthModal('register')}
        >
          <SocketProvider>
            <MainApp />
          </SocketProvider>
        </AuthPromptProvider>

        {/* Auth Modal - shown when user needs to login/register */}
        <Modal visible={authModal !== null} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: theme.bg }}>
            {authModal === 'login' ? (
              <LoginScreen
                onSuccessLogin={() => setAuthModal(null)}
                goToRegister={() => setAuthModal('register')}
                goToForgotPassword={() => setAuthModal('forgot-password')}
                onClose={() => setAuthModal(null)}
              />
            ) : authModal === 'register' ? (
              <RegisterScreen
                onSuccessLogin={() => setAuthModal(null)}
                goToLogin={() => setAuthModal('login')}
                onClose={() => setAuthModal(null)}
              />
            ) : authModal === 'forgot-password' ? (
              <ForgotPasswordScreen
                goToLogin={() => setAuthModal('login')}
                onClose={() => setAuthModal(null)}
              />
            ) : null}
          </View>
        </Modal>

        {/* Reset Password Modal - shown via deep link */}
        <Modal visible={resetToken !== null} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <ResetPasswordScreen
              token={resetToken || ''}
              onSuccess={() => setResetToken(null)}
              onClose={() => setResetToken(null)}
            />
          </View>
        </Modal>

        {/* Verify Email Modal - shown via deep link */}
        <Modal visible={verifyToken !== null} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <VerifyEmailScreen
              pendingToken={verifyToken || ''}
              email={emailForVerification}
              onTokenConsumed={() => setVerifyToken(null)}
              onVerified={async () => {
                await markEmailVerified();
                setVerifyToken(null);
              }}
              onLogout={async () => {
                await logout();
                setVerifyToken(null);
              }}
            />
          </View>
        </Modal>

        {/* Portal host for overlays that need to escape parent z-index */}
        <PortalHost name="radialWheel" />

        {/* Toast notifications */}
        <ToastContainer />
      </QueryClientProvider>
      </PortalProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  // Mobile Header
  mobileHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  drawerLeft: {
    width: '80%',
    maxWidth: 300,
    height: '100%',
  },
  drawerLeftCollapsed: {
    width: 56,
    maxWidth: 56,
  },
  drawerRight: {
    width: '85%',
    maxWidth: 320,
    height: '100%',
    position: 'relative',
  },
  // Mobile Vibe Validator - 90% height bottom sheet
  vibeModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  vibeModalTopSpacer: {
    height: '10%',
  },
  vibeModalContent: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    height: '90%',
  },
  // Mobile Node Header - shown when viewing a specific node (inside animated header)
  mobileNodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  mobileNodeHeaderBack: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  mobileNodeHeaderBackText: {
    fontSize: 13,
    fontWeight: '500',
  },
  mobileNodeHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginLeft: 12,
  },
  mobileNodeHeaderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mobileNodeHeaderAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mobileNodeHeaderName: {
    fontSize: 15,
    fontWeight: '600',
    maxWidth: 150,
  },
});
