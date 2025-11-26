import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFeed, getNodes, Post, Node, createPostReaction } from "../lib/api";
import { Feed } from "../components/ui/Feed";
import { VibeValidator, VIBE_PRESETS, VibePreset } from "../components/VibeValidator";
import { VibeCheckModal } from "../components/VibeCheckModal";
import { COLORS } from "../constants/theme";

type FeedScreenProps = {
  onCreatePost: () => void;
  onPostPress: (post: Post) => void;
};

export const FeedScreen = ({ onCreatePost, onPostPress }: FeedScreenProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [activePreset, setActivePreset] = useState<VibePreset>(VIBE_PRESETS[1]); // Default to Balanced
  const prevSelectedNodeId = useRef<string | undefined>(undefined);
  const prevActivePresetId = useRef<string>('balanced');

  // Vibe Check Modal State
  const [vibeModalVisible, setVibeModalVisible] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);

  const loadNodes = async () => {
    try {
      const nodeList = await getNodes();
      setNodes(nodeList);
    } catch (error) {
      console.error("Failed to load nodes:", error);
    }
  };

  const loadPosts = async (refresh = false) => {
    if (refresh) {
      setLoading(true);
      setRefreshing(true);
      setError(null);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }

    try {
      const currentCursor = refresh ? undefined : cursor;
      const weights = activePreset ? activePreset.weights : {};
      const data = await getFeed({
        cursor: currentCursor,
        limit: 20,
        nodeId: selectedNodeId,
        ...weights
      });

      if (refresh) {
        setPosts(data.posts);
      } else {
        // Deduplicate posts by ID to prevent duplicate keys
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newPosts = data.posts.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }

      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      console.error("Failed to load feed:", err);
      setError("Failed to load feed. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadNodes();
    loadPosts(true);
  }, []);

  useEffect(() => {
    // Reload feed when node filter changes, once current load is finished
    if (
      selectedNodeId !== prevSelectedNodeId.current ||
      activePreset.id !== prevActivePresetId.current
    ) {
      setPosts([]);
      setCursor(undefined);
      setHasMore(true);
      loadPosts(true);
      prevSelectedNodeId.current = selectedNodeId;
      prevActivePresetId.current = activePreset.id;
    }
  }, [selectedNodeId, activePreset]);

  const handleVibeCheck = (post: any) => {
    setActivePost(post);
    setVibeModalVisible(true);
  };

  const handleVibeComplete = async (intensities: { [key: string]: number }) => {
    if (!activePost) return;

    // Optimistic update
    const updatedPost = { ...activePost, myReaction: intensities };
    setPosts(posts.map(p => p.id === activePost.id ? updatedPost : p));

    try {
      await createPostReaction(activePost.id, {
        nodeId: activePost.nodeId || activePost.node?.id || 'global', // Fallback if needed
        intensities
      });
    } catch (error) {
      console.error('Failed to save reaction:', error);
      // Revert? For now just log
    }
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptyText}>Be the first to start the conversation!</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        <TouchableOpacity
          style={styles.nodeFilterButton}
          onPress={() => setShowNodePicker(!showNodePicker)}
        >
          <Text style={styles.nodeFilterText}>
            {selectedNode ? selectedNode.name : "All Nodes"}
          </Text>
          <Text style={styles.nodeFilterArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.vibeValidatorContainer}>
        <VibeValidator
          selectedPresetId={activePreset.id}
          onSelectPreset={setActivePreset}
          currentConfig={activePreset.weights}
        />
      </View>

      {showNodePicker && (
        <View style={styles.nodePicker}>
          <TouchableOpacity
            style={[styles.nodeOption, !selectedNodeId && styles.nodeOptionSelected]}
            onPress={() => {
              setSelectedNodeId(undefined);
              setShowNodePicker(false);
            }}
          >
            <Text style={[styles.nodeOptionText, !selectedNodeId && styles.nodeOptionTextSelected]}>
              All Nodes
            </Text>
          </TouchableOpacity>
          {nodes.map((node) => (
            <TouchableOpacity
              key={node.id}
              style={[styles.nodeOption, selectedNodeId === node.id && styles.nodeOptionSelected]}
              onPress={() => {
                setSelectedNodeId(node.id);
                setShowNodePicker(false);
              }}
            >
              <Text
                style={[
                  styles.nodeOptionText,
                  selectedNodeId === node.id && styles.nodeOptionTextSelected,
                ]}
              >
                {node.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && !refreshing && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Use Unified Feed Component */}
      <View style={{ flex: 1 }}>
        {/* We need to wrap Feed in a way that handles pull-to-refresh if Feed doesn't support it directly yet.
              The Feed component uses ScrollView. We might need to pass refreshControl to it or wrap it.
              For now, let's assume Feed handles scrolling and we lose pull-to-refresh unless we modify Feed.tsx.
              Actually, Feed.tsx uses ScrollView.
              Let's modify Feed.tsx to accept refreshControl or just wrap it?
              Wrapping ScrollView in ScrollView is bad.
              Let's just pass the posts to Feed and let it render.
              BUT we lose onEndReached and RefreshControl.
              
              Refactoring Feed.tsx to be a pure list renderer (FlatList) would be better.
              But Feed.tsx currently maps posts.
              
              Let's stick to the plan: Use Feed component.
              Wait, Feed component is just a ScrollView with map.
              It doesn't support pagination/refresh.
              
              Maybe I should just keep FlatList in FeedScreen and use PostCard from Feed.tsx?
              Yes, that's safer for preserving functionality.
              
              So, I will import PostCard from '../components/ui/Feed' (I need to export it).
              And keep the FlatList here.
          */}
        <Feed
          posts={posts as any}
          currentUser={{}} // TODO: Get from store
          onVibeCheck={handleVibeCheck}
        />
      </View>

      <TouchableOpacity style={styles.fab} onPress={onCreatePost}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <VibeCheckModal
        visible={vibeModalVisible}
        onClose={() => setVibeModalVisible(false)}
        onComplete={handleVibeComplete}
        initialIntensities={activePost?.myReaction || undefined}
        postId={activePost?.id}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  nodeFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
  },
  nodeFilterText: {
    fontSize: 14,
    color: "#334155",
    marginRight: 4,
  },
  nodeFilterArrow: {
    fontSize: 10,
    color: "#64748B",
  },
  nodePicker: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    maxHeight: 200,
  },
  nodeOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  nodeOptionSelected: {
    backgroundColor: "#EFF6FF",
  },
  nodeOptionText: {
    fontSize: 14,
    color: "#334155",
  },
  nodeOptionTextSelected: {
    color: "#2563EB",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 4,
  },
  errorBannerText: {
    color: "#991B1B",
    fontSize: 14,
  },
  centerLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  vibeValidatorContainer: {
    marginBottom: 8,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: "#FFFFFF",
    marginTop: -2,
  },
});
