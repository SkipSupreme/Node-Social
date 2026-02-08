import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ArrowLeft, FileText, Trash2, Eye, EyeOff, Ban, Shield, Filter } from '../components/ui/Icons';
import { useAppTheme } from '../hooks/useTheme';
import { getNodeModLog, ModLogAction } from '../lib/api';

interface ModLogScreenProps {
  nodeId: string;
  nodeName: string;
  onBack: () => void;
}

// Get relative time string
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get icon for action type
function getActionIcon(action: string, mutedColor: string) {
  switch (action) {
    case 'delete':
      return <Trash2 size={16} color="#ef4444" />;
    case 'hide':
      return <EyeOff size={16} color="#f59e0b" />;
    case 'warn':
      return <Shield size={16} color="#f59e0b" />;
    case 'ban':
      return <Ban size={16} color="#ef4444" />;
    default:
      return <FileText size={16} color={mutedColor} />;
  }
}

// Get action label
function getActionLabel(action: string): string {
  switch (action) {
    case 'delete':
      return 'Post Removed';
    case 'hide':
      return 'Post Hidden';
    case 'warn':
      return 'Warning Issued';
    case 'ban':
      return 'User Banned';
    default:
      return action.charAt(0).toUpperCase() + action.slice(1);
  }
}

const ACTION_FILTERS = [
  { key: '', label: 'All' },
  { key: 'delete', label: 'Removed' },
  { key: 'hide', label: 'Hidden' },
  { key: 'warn', label: 'Warnings' },
  { key: 'ban', label: 'Bans' },
];

export function ModLogScreen({ nodeId, nodeName, onBack }: ModLogScreenProps) {
  const theme = useAppTheme();
  const [actions, setActions] = useState<ModLogAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');

  const fetchModLog = useCallback(async (reset = false, filter?: string) => {
    if (reset) {
      setLoading(true);
      setActions([]);
      setNextCursor(null);
    }

    try {
      const filterToUse = filter !== undefined ? filter : actionFilter;
      const result = await getNodeModLog(nodeId, {
        limit: 20,
        cursor: reset ? undefined : nextCursor || undefined,
        action: filterToUse || undefined,
      });

      if (reset) {
        setActions(result.actions);
      } else {
        setActions((prev) => [...prev, ...result.actions]);
      }
      setNextCursor(result.nextCursor);
    } catch (error) {
      console.error('Failed to fetch mod log:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [nodeId, actionFilter, nextCursor]);

  useEffect(() => {
    fetchModLog(true);
  }, [nodeId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchModLog(true);
  };

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchModLog(false);
  };

  const handleFilterChange = (filter: string) => {
    setActionFilter(filter);
    fetchModLog(true, filter);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.panel }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mod Log</Text>
          <Text style={[styles.headerSubtitle, { color: theme.muted }]}>n/{nodeName}</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={[styles.filtersContainer, { backgroundColor: theme.panel, borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {ACTION_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                actionFilter === filter.key && styles.filterButtonActive,
              , { backgroundColor: theme.bg, borderColor: theme.border }, { backgroundColor: theme.accent, borderColor: theme.accent }]}
              onPress={() => handleFilterChange(filter.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  actionFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent}
            />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isCloseToBottom =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
            if (isCloseToBottom && nextCursor && !loadingMore) {
              handleLoadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {actions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FileText size={48} color={theme.muted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Mod Actions</Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                {actionFilter
                  ? `No "${ACTION_FILTERS.find(f => f.key === actionFilter)?.label}" actions found`
                  : 'This community has no moderation history'}
              </Text>
            </View>
          ) : (
            <>
              {actions.map((action) => (
                <View key={action.id} style={[styles.actionCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                  <View style={styles.actionHeader}>
                    <View style={[styles.actionIconContainer, { backgroundColor: theme.bg }]}>
                      {getActionIcon(action.action, theme.muted)}
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionLabel, { color: theme.text }]}>{getActionLabel(action.action)}</Text>
                      <Text style={[styles.actionTime, { color: theme.muted }]}>{getRelativeTime(action.createdAt)}</Text>
                    </View>
                  </View>

                  {action.reason && (
                    <View style={[styles.reasonContainer, { borderTopColor: theme.border }]}>
                      <Text style={[styles.reasonLabel, { color: theme.muted }]}>Reason:</Text>
                      <Text style={[styles.reasonText, { color: theme.text }]}>{action.reason}</Text>
                    </View>
                  )}

                  <View style={[styles.actionFooter, { borderTopColor: theme.border }]}>
                    <Text style={[styles.moderatorText, { color: theme.muted }]}>
                      Action by <Text style={[styles.moderatorName, { color: theme.accent }]}>@{action.moderatorUsername}</Text>
                    </Text>
                    <Text style={[styles.targetText, { color: theme.muted }]}>
                      {action.targetType}: {action.targetId.slice(0, 8)}...
                    </Text>
                  </View>
                </View>
              ))}

              {loadingMore && (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              )}

              {!nextCursor && actions.length > 0 && (
                <Text style={[styles.endText, { color: theme.muted }]}>End of mod log</Text>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  filtersContainer: {
    borderBottomWidth: 1,
  },
  filters: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  filterButtonActive: {
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  actionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionTime: {
    fontSize: 12,
    marginTop: 2,
  },
  reasonContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moderatorText: {
    fontSize: 12,
  },
  moderatorName: {
    fontWeight: '500',
  },
  targetText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endText: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 16,
  },
});
