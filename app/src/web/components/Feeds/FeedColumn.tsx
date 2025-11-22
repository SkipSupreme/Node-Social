// Phase 4.1 - Feed Column Component
// Main feed column with posts

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { PostCardWeb } from '../Posts/PostCardWeb';
import { PostTypeFilter, type PostType } from './PostTypeFilter';
import { getFeed, getNode, type Post, type Node } from '../../../lib/api';

interface FeedColumnProps {
  nodeId?: string;
  width: number;
  onNodeLoad?: (node: Node | null) => void;
  postTypeFilter?: PostType[]; // Initial post type filter
}

export const FeedColumn: React.FC<FeedColumnProps> = ({
  nodeId,
  width,
  onNodeLoad,
  postTypeFilter,
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [node, setNode] = useState<Node | null>(null);
  const [selectedPostTypes, setSelectedPostTypes] = useState<PostType[]>(
    postTypeFilter || []
  );

  useEffect(() => {
    if (nodeId) {
      loadNode();
    }
    loadPosts(true);
  }, [nodeId, selectedPostTypes]); // Reload when post types change

  const loadNode = async () => {
    if (!nodeId) {
      setNode(null);
      onNodeLoad?.(null);
      return;
    }
    try {
      const nodeData = await getNode(nodeId);
      setNode(nodeData);
      onNodeLoad?.(nodeData);
    } catch (error) {
      console.error('Failed to load node:', error);
      setNode(null);
      onNodeLoad?.(null);
    }
  };

  const loadPosts = async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
      setError(null);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }

    try {
      const currentCursor = refresh ? undefined : cursor;
      // Phase 4.2 - Post Type Filtering
      // Apply post type filter if any types selected
      const feedParams: Parameters<typeof getFeed>[0] = {
        cursor: currentCursor,
        limit: 20,
        nodeId,
      };
      
      if (selectedPostTypes.length > 0) {
        feedParams.postTypes = selectedPostTypes;
      }
      
      const data = await getFeed(feedParams);

      if (refresh) {
        setPosts(data.posts);
      } else {
        // Deduplicate posts
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
      console.error('Failed to load feed:', err);
      setError('Failed to load feed. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

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
      <View style={[styles.container, { width }]}>
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width }]}>
      {/* Feed Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            {node ? `n/${node.slug}` : 'All Posts'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* Post Type Filter */}
          <PostTypeFilter
            selectedTypes={selectedPostTypes}
            onTypesChange={setSelectedPostTypes}
            multiSelect={true}
          />
          {/* Future: Sort options */}
        </View>
      </View>

      {error && !refreshing && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={posts}
        renderItem={({ item }) => <PostCardWeb post={item} node={node} />}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadPosts(true)} tintColor="#2563EB" />
        }
        onEndReached={() => loadPosts(false)}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={posts.length === 0 && styles.listContentEmpty}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 4,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
});

