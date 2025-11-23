import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFeed, getNodes, Post, Node } from "../lib/api";
import { PostCard } from "../components/PostCard";

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
  const prevSelectedNodeId = useRef<string | undefined>(undefined);

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
      const data = await getFeed({ cursor: currentCursor, limit: 20, nodeId: selectedNodeId });

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
    if (loading) return;

    if (prevSelectedNodeId.current !== selectedNodeId) {
      prevSelectedNodeId.current = selectedNodeId;
      loadPosts(true);
    }
  }, [selectedNodeId, loading]);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2563EB" />
      </View>
    );
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

      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <PostCard post={item} onPress={onPostPress} />
        )}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadPosts(true)} tintColor="#2563EB" />
        }
        onEndReached={() => loadPosts(false)}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={posts.length === 0 && styles.listContentEmpty}
      />

      <TouchableOpacity style={styles.fab} onPress={onCreatePost}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
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
