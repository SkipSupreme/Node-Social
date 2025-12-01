import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FileText, ChevronRight, Trash2, Eye, EyeOff, Ban, Shield } from './Icons';
import { COLORS } from '../../constants/theme';

interface ModAction {
  id: string;
  action: string;
  targetType: string;
  reason: string | null;
  moderatorUsername: string;
  createdAt: string;
}

interface ModLogPreviewProps {
  actions: ModAction[];
  onViewFullLog?: () => void;
}

// Get relative time string
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get icon for action type
function getActionIcon(action: string) {
  switch (action) {
    case 'delete':
      return <Trash2 size={14} color="#ef4444" />;
    case 'hide':
      return <EyeOff size={14} color="#f59e0b" />;
    case 'warn':
      return <Shield size={14} color="#f59e0b" />;
    case 'ban':
      return <Ban size={14} color="#ef4444" />;
    default:
      return <FileText size={14} color={COLORS.node.muted} />;
  }
}

// Get action label
function getActionLabel(action: string): string {
  switch (action) {
    case 'delete':
      return 'Post removed';
    case 'hide':
      return 'Post hidden';
    case 'warn':
      return 'Warning issued';
    case 'ban':
      return 'User banned';
    default:
      return action.charAt(0).toUpperCase() + action.slice(1);
  }
}

export function ModLogPreview({ actions, onViewFullLog }: ModLogPreviewProps) {
  if (actions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No recent mod actions</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <View key={action.id} style={styles.actionItem}>
          <View style={styles.actionHeader}>
            {getActionIcon(action.action)}
            <Text style={styles.actionLabel}>{getActionLabel(action.action)}</Text>
            <Text style={styles.actionTime}>{getRelativeTime(action.createdAt)}</Text>
          </View>
          {action.reason && (
            <Text style={styles.actionReason} numberOfLines={1}>
              Reason: {action.reason}
            </Text>
          )}
          <Text style={styles.actionMod}>by @{action.moderatorUsername}</Text>
        </View>
      ))}

      {onViewFullLog && (
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewFullLog}>
          <Text style={styles.viewAllText}>View full mod log</Text>
          <ChevronRight size={14} color={COLORS.node.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.node.muted,
    fontStyle: 'italic',
  },
  actionItem: {
    backgroundColor: COLORS.node.bg,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.node.text,
    flex: 1,
  },
  actionTime: {
    fontSize: 12,
    color: COLORS.node.muted,
  },
  actionReason: {
    fontSize: 12,
    color: COLORS.node.muted,
    marginTop: 4,
    marginLeft: 22,
  },
  actionMod: {
    fontSize: 11,
    color: COLORS.node.muted,
    marginTop: 4,
    marginLeft: 22,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    color: COLORS.node.accent,
    fontWeight: '500',
  },
});
