import { useState, useEffect, useCallback } from 'react';
import { View, Modal, useWindowDimensions, StyleSheet } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../src/hooks/useTheme';
import { useAuthStore } from '../../src/store/auth';
import { useNodes } from '../../src/hooks/useNodes';
import { useFeedSourceStore } from '../../src/store/feedSource';
import { useColumnsStore } from '../../src/store/columns';
import { useModalStore } from '../../src/store/modal';
import { useAuthPrompt } from '../../src/context/AuthPromptContext';
import { Sidebar } from '../../src/components/ui/Sidebar';
import { WhatsVibing } from '../../src/components/ui/WhatsVibing';
import { NodeLandingPage } from '../../src/components/ui/NodeLandingPage';
import { CreatePostModal } from '../../src/components/ui/CreatePostModal';
import { EditPostModal } from '../../src/components/ui/EditPostModal';
import { NodeInfoSheet } from '../../src/components/ui/NodeInfoSheet';
import { AddColumnModal } from '../../src/components/ui/AddColumnModal';
import type { UIPost } from '../../src/components/ui/Feed';

export default function MainLayout() {
  const theme = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // Stores
  const user = useAuthStore((s) => s.user);
  const { data: nodes } = useNodes();
  const selectedNodeId = useFeedSourceStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useFeedSourceStore((s) => s.setSelectedNodeId);
  const { columns, isMultiColumnEnabled, addColumn, loadFromStorage } = useColumnsStore();
  const { requireAuth } = useAuthPrompt();

  // Modal store
  const {
    isCreatePostOpen, quotedExternalPost, createPostInitialNodeId, closeCreatePost, openCreatePost,
    isEditPostOpen, editingPost, closeEditPost,
    nodeInfoNodeId, closeNodeInfo,
    isAddColumnOpen, closeAddColumn, openAddColumn,
    isSidebarOpen, closeSidebar,
  } = useModalStore();

  // Local state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load column config from storage
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Derive feedMode from current pathname
  const feedMode = pathname === '/discovery' ? 'discovery' as const
    : pathname === '/following' ? 'following' as const
    : 'global' as const;

  // Derive currentView from pathname for sidebar highlighting
  const currentView = pathname.startsWith('/settings') ? 'settings'
    : pathname.startsWith('/messages') ? 'messages'
    : pathname.startsWith('/governance') ? 'governance'
    : pathname === '/saved' ? 'saved'
    : pathname.startsWith('/notifications') || pathname === '/notifications' ? 'notifications'
    : pathname.startsWith('/user') ? 'profile'
    : 'feed';

  // --- Sidebar navigation callbacks ---
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    // Navigate to feed tab when selecting a node
    if (pathname !== '/') router.push('/' as any);
  }, [setSelectedNodeId, pathname, router]);

  const handleFeedModeSelect = useCallback((mode: 'global' | 'discovery' | 'following') => {
    if (mode === 'discovery') router.push('/discovery' as any);
    else if (mode === 'following') {
      if (requireAuth('Sign in to see posts from people you follow')) {
        router.push('/following' as any);
      }
    } else {
      router.push('/' as any);
    }
  }, [router, requireAuth]);

  const handleProfileClick = useCallback(() => {
    if (requireAuth('Sign in to view your profile')) {
      router.push('/profile' as any);
    }
  }, [router, requireAuth]);

  const handleSettingsClick = useCallback(() => {
    router.push('/settings' as any);
  }, [router]);

  const handleSavedClick = useCallback(() => {
    if (requireAuth('Sign in to see your saved posts')) {
      router.push('/saved' as any);
    }
  }, [router, requireAuth]);

  const handleNewPostClick = useCallback(() => {
    if (requireAuth('Sign in to create a post')) {
      openCreatePost({ nodeId: selectedNodeId });
    }
  }, [requireAuth, openCreatePost, selectedNodeId]);

  const handleGovernanceClick = useCallback(() => {
    router.push('/governance' as any);
  }, [router]);

  const handleNotificationsClick = useCallback(() => {
    if (requireAuth('Sign in to see your notifications')) {
      router.push('/notifications' as any);
    }
  }, [router, requireAuth]);

  const handleMessagesClick = useCallback(() => {
    if (requireAuth('Sign in to access messages')) {
      router.push('/messages' as any);
    }
  }, [router, requireAuth]);

  const handleSearch = useCallback((query: string) => {
    router.push(`/discovery?q=${encodeURIComponent(query)}` as any);
  }, [router]);

  // --- Right panel callbacks ---
  const handleNodeInfoNavigateToSettings = useCallback(() => {
    if (selectedNodeId) router.push(`/node/${selectedNodeId}/settings` as any);
  }, [selectedNodeId, router]);

  const handleNodeInfoNavigateToModLog = useCallback(() => {
    if (selectedNodeId) router.push(`/node/${selectedNodeId}/mod-log` as any);
  }, [selectedNodeId, router]);

  const handleStartChat = useCallback((userId: string) => {
    router.push('/messages' as any);
  }, [router]);

  // --- Modal callbacks ---
  const handleCreatePostSuccess = useCallback(() => {
    closeCreatePost();
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  }, [closeCreatePost, queryClient]);

  const handleEditPostSuccess = useCallback((_updatedPost: { id: string; title: string; content: string; contentJson?: any }) => {
    closeEditPost();
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  }, [closeEditPost, queryClient]);

  const handleNodeInfoViewPosts = useCallback(() => {
    const nodeId = nodeInfoNodeId;
    closeNodeInfo();
    if (nodeId) {
      setSelectedNodeId(nodeId);
      router.push('/' as any);
    }
  }, [nodeInfoNodeId, closeNodeInfo, setSelectedNodeId, router]);

  // --- Render ---
  if (!isDesktop) {
    // Mobile: just the route content + modals
    return (
      <View style={{ flex: 1 }}>
        <Slot />

        {/* Mobile sidebar modal */}
        <Modal visible={isSidebarOpen} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <Sidebar
              nodes={nodes ?? []}
              onClose={closeSidebar}
              isDesktop={false}
              user={user ?? undefined}
              selectedNodeId={selectedNodeId}
              onNodeSelect={(nodeId) => { handleNodeSelect(nodeId); closeSidebar(); }}
              onNodeInfo={(nodeId) => { useModalStore.getState().openNodeInfo(nodeId); closeSidebar(); }}
              feedMode={feedMode}
              onFeedModeSelect={(mode) => { handleFeedModeSelect(mode); closeSidebar(); }}
              onProfileClick={() => { handleProfileClick(); closeSidebar(); }}
              onSettingsClick={() => { handleSettingsClick(); closeSidebar(); }}
              onSavedClick={() => { handleSavedClick(); closeSidebar(); }}
              onNewPostClick={() => { handleNewPostClick(); closeSidebar(); }}
              onGovernanceClick={() => { handleGovernanceClick(); closeSidebar(); }}
              onNotificationsClick={() => { handleNotificationsClick(); closeSidebar(); }}
              onMessagesClick={() => { handleMessagesClick(); closeSidebar(); }}
              unreadNotifications={0}
              unreadMessages={0}
              currentView={currentView}
              onSearch={(q) => { handleSearch(q); closeSidebar(); }}
            />
          </View>
        </Modal>

        {/* Shared modals */}
        <CreatePostModal
          visible={isCreatePostOpen}
          onClose={closeCreatePost}
          onSuccess={handleCreatePostSuccess}
          nodes={nodes ?? []}
          initialNodeId={createPostInitialNodeId}
          quotedExternalPost={quotedExternalPost}
        />
        <EditPostModal
          visible={isEditPostOpen}
          post={editingPost as UIPost | null}
          onClose={closeEditPost}
          onSuccess={handleEditPostSuccess}
        />
        <NodeInfoSheet
          visible={nodeInfoNodeId !== null}
          onClose={closeNodeInfo}
          nodeId={nodeInfoNodeId}
          onViewPosts={handleNodeInfoViewPosts}
        />
      </View>
    );
  }

  // Desktop: 3-column layout
  return (
    <View style={[styles.desktopContainer, { backgroundColor: theme.bg }]}>
      {/* Left sidebar */}
      <View style={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded, { borderRightColor: theme.border }]}>
        <Sidebar
          nodes={nodes ?? []}
          isDesktop={true}
          user={user ?? undefined}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
          onNodeInfo={(nodeId) => useModalStore.getState().openNodeInfo(nodeId)}
          feedMode={feedMode}
          onFeedModeSelect={handleFeedModeSelect}
          onProfileClick={handleProfileClick}
          onSettingsClick={handleSettingsClick}
          onSavedClick={handleSavedClick}
          onNewPostClick={handleNewPostClick}
          onGovernanceClick={handleGovernanceClick}
          onNotificationsClick={handleNotificationsClick}
          onMessagesClick={handleMessagesClick}
          onAddColumnClick={openAddColumn}
          unreadNotifications={0}
          unreadMessages={0}
          isMultiColumnEnabled={isMultiColumnEnabled}
          currentView={currentView}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onSearch={handleSearch}
        />
      </View>

      {/* Main content */}
      <View style={styles.mainContent}>
        <Slot />
      </View>

      {/* Right panel -- hidden in multi-column mode */}
      {!isMultiColumnEnabled && (
        <View style={[styles.rightPanel, { borderLeftColor: theme.border }]}>
          {selectedNodeId ? (
            <NodeLandingPage
              nodeId={selectedNodeId}
              onNavigateToSettings={handleNodeInfoNavigateToSettings}
              onNavigateToModLog={handleNodeInfoNavigateToModLog}
              onStartChat={handleStartChat}
            />
          ) : (
            <WhatsVibing onNodeClick={handleNodeSelect} />
          )}
        </View>
      )}

      {/* Shared modals */}
      <CreatePostModal
        visible={isCreatePostOpen}
        onClose={closeCreatePost}
        onSuccess={handleCreatePostSuccess}
        nodes={nodes ?? []}
        initialNodeId={createPostInitialNodeId}
        quotedExternalPost={quotedExternalPost}
      />
      <EditPostModal
        visible={isEditPostOpen}
        post={editingPost as UIPost | null}
        onClose={closeEditPost}
        onSuccess={handleEditPostSuccess}
      />
      <NodeInfoSheet
        visible={nodeInfoNodeId !== null}
        onClose={closeNodeInfo}
        nodeId={nodeInfoNodeId}
        onViewPosts={handleNodeInfoViewPosts}
      />
      <AddColumnModal
        visible={isAddColumnOpen}
        onClose={closeAddColumn}
        onAdd={addColumn}
        nodes={nodes ?? []}
        existingColumns={columns}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    borderRightWidth: 1,
  },
  sidebarExpanded: {
    width: 280,
  },
  sidebarCollapsed: {
    width: 56,
  },
  mainContent: {
    flex: 1,
  },
  rightPanel: {
    width: 280,
    borderLeftWidth: 1,
  },
});
