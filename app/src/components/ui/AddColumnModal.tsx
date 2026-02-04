// Modal for adding new columns
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Image } from 'react-native';
import { X, Globe, Compass, Users, User, Bell, Search, TrendingUp, Hash, ChevronRight, ExternalLink } from './Icons';
import { COLORS } from '../../constants/theme';
import { FeedColumn, ExternalFeedConfig } from '../../store/columns';

interface AddColumnModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (column: Omit<FeedColumn, 'id'>) => void;
  nodes: any[];
  existingColumns: FeedColumn[];
}

type Step = 'type' | 'node' | 'search' | 'external';

interface ColumnTypeOption {
  type: FeedColumn['type'];
  title: string;
  description: string;
  icon: any;
  requiresSelection?: boolean;
}

const columnTypes: ColumnTypeOption[] = [
  { type: 'global', title: 'Global Feed', description: 'All posts from everywhere', icon: Globe },
  { type: 'discovery', title: 'Discovery', description: 'Trending and popular posts', icon: Compass },
  { type: 'following', title: 'Following', description: 'Posts from people you follow', icon: Users },
  { type: 'node', title: 'Node Feed', description: 'Posts from a specific community', icon: Hash, requiresSelection: true },
  { type: 'trending', title: 'Trending', description: 'What\'s vibing right now', icon: TrendingUp },
  { type: 'search', title: 'Saved Search', description: 'Track posts matching a query', icon: Search, requiresSelection: true },
  { type: 'bluesky', title: 'Bluesky', description: 'Posts from Bluesky network', icon: ExternalLink, requiresSelection: true },
  { type: 'mastodon', title: 'Mastodon', description: 'Posts from Mastodon/Fediverse', icon: ExternalLink, requiresSelection: true },
  { type: 'external-combined', title: 'Combined External', description: 'Mix of Bluesky & Mastodon', icon: ExternalLink },
  { type: 'profile', title: 'My Profile', description: 'Your posts and activity', icon: User },
  { type: 'notifications', title: 'Notifications', description: 'Your notifications feed', icon: Bell },
];

export const AddColumnModal: React.FC<AddColumnModalProps> = ({
  visible,
  onClose,
  onAdd,
  nodes,
  existingColumns,
}) => {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<FeedColumn['type'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mastodonInstance, setMastodonInstance] = useState('mastodon.social');

  // Popular Mastodon instances for quick selection
  const popularMastodonInstances = [
    'mastodon.social',
    'mas.to',
    'hachyderm.io',
    'fosstodon.org',
    'infosec.exchange',
    'techhub.social',
  ];

  const handleSelectType = (type: FeedColumn['type']) => {
    const option = columnTypes.find(ct => ct.type === type);

    if (option?.requiresSelection) {
      setSelectedType(type);
      if (type === 'node') {
        setStep('node');
      } else if (type === 'search') {
        setStep('search');
      } else if (type === 'bluesky' || type === 'mastodon') {
        setStep('external');
      }
    } else {
      // Add column directly (including external-combined)
      if (type === 'external-combined') {
        onAdd({
          type,
          title: 'External Feeds',
          externalConfig: {
            platform: 'bluesky', // Will fetch both anyway
          },
        });
      } else {
        onAdd({
          type,
          title: option?.title || type,
        });
      }
      handleClose();
    }
  };

  const handleSelectNode = (node: any) => {
    onAdd({
      type: 'node',
      title: node.name,
      nodeId: node.id,
    });
    handleClose();
  };

  const handleAddSearch = () => {
    if (!searchQuery.trim()) return;
    onAdd({
      type: 'search',
      title: `Search: ${searchQuery}`,
      searchQuery: searchQuery.trim(),
    });
    handleClose();
  };

  const handleAddBlueskyFeed = (feedType: 'discover' | 'user', handle?: string) => {
    const config: ExternalFeedConfig = {
      platform: 'bluesky',
      blueskyFeed: feedType,
      blueskyHandle: handle,
    };
    onAdd({
      type: 'bluesky',
      title: feedType === 'discover' ? 'Bluesky Discover' : `Bluesky @${handle}`,
      externalConfig: config,
    });
    handleClose();
  };

  const handleAddMastodonFeed = (timeline: 'public' | 'local' | 'trending', instance: string) => {
    const config: ExternalFeedConfig = {
      platform: 'mastodon',
      mastodonInstance: instance,
      mastodonTimeline: timeline,
    };
    const timelineNames = { public: 'Federated', local: 'Local', trending: 'Trending' };
    onAdd({
      type: 'mastodon',
      title: `${timelineNames[timeline]} (${instance})`,
      externalConfig: config,
    });
    handleClose();
  };

  const handleClose = () => {
    setStep('type');
    setSelectedType(null);
    setSearchQuery('');
    setMastodonInstance('mastodon.social');
    onClose();
  };

  const handleBack = () => {
    setStep('type');
    setSelectedType(null);
    setSearchQuery('');
    setMastodonInstance('mastodon.social');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity
          style={styles.modal}
          activeOpacity={1}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            {step !== 'type' && (
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <ChevronRight size={20} color={COLORS.node.text} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            )}
            <Text style={styles.title}>
              {step === 'type' ? 'Add Column' : step === 'node' ? 'Select Node' : step === 'search' ? 'Saved Search' : selectedType === 'bluesky' ? 'Bluesky Feed' : 'Mastodon Feed'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={20} color={COLORS.node.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {step === 'type' && (
              <View style={styles.typeList}>
                {columnTypes.map((option) => {
                  const Icon = option.icon;
                  return (
                    <TouchableOpacity
                      key={option.type}
                      style={styles.typeItem}
                      onPress={() => handleSelectType(option.type)}
                    >
                      <View style={styles.typeIcon}>
                        <Icon size={20} color={COLORS.node.accent} />
                      </View>
                      <View style={styles.typeInfo}>
                        <Text style={styles.typeTitle}>{option.title}</Text>
                        <Text style={styles.typeDescription}>{option.description}</Text>
                      </View>
                      <ChevronRight size={16} color={COLORS.node.muted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {step === 'node' && (
              <View style={styles.nodeList}>
                {nodes.map((node) => (
                  <TouchableOpacity
                    key={node.id}
                    style={styles.nodeItem}
                    onPress={() => handleSelectNode(node)}
                  >
                    {node.avatar ? (
                      <Image source={{ uri: node.avatar }} style={styles.nodeAvatar} />
                    ) : (
                      <View style={[styles.nodeAvatarPlaceholder, { backgroundColor: node.color || COLORS.node.accent }]}>
                        <Text style={styles.nodeAvatarText}>{node.name[0]}</Text>
                      </View>
                    )}
                    <View style={styles.nodeInfo}>
                      <Text style={styles.nodeName}>{node.name}</Text>
                      {node.subscriberCount !== undefined && (
                        <Text style={styles.nodeMembers}>{node.subscriberCount} members</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step === 'search' && (
              <View style={styles.searchForm}>
                <Text style={styles.searchLabel}>Enter a search query to track:</Text>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="e.g., react native, web3, AI..."
                  placeholderTextColor={COLORS.node.muted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddSearch}
                />
                <TouchableOpacity
                  style={[styles.addButton, !searchQuery.trim() && styles.addButtonDisabled]}
                  onPress={handleAddSearch}
                  disabled={!searchQuery.trim()}
                >
                  <Text style={styles.addButtonText}>Add Search Column</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'external' && selectedType === 'bluesky' && (
              <View style={styles.externalForm}>
                <Text style={styles.externalLabel}>Choose a Bluesky feed:</Text>
                <TouchableOpacity
                  style={styles.externalOption}
                  onPress={() => handleAddBlueskyFeed('discover')}
                >
                  <Text style={styles.externalOptionIcon}>🦋</Text>
                  <View style={styles.externalOptionInfo}>
                    <Text style={styles.externalOptionTitle}>What's Hot</Text>
                    <Text style={styles.externalOptionDesc}>Popular posts from across Bluesky</Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.node.muted} />
                </TouchableOpacity>
              </View>
            )}

            {step === 'external' && selectedType === 'mastodon' && (
              <View style={styles.externalForm}>
                <Text style={styles.externalLabel}>Select a timeline type:</Text>

                <TouchableOpacity
                  style={styles.externalOption}
                  onPress={() => handleAddMastodonFeed('public', mastodonInstance)}
                >
                  <Text style={styles.externalOptionIcon}>🌐</Text>
                  <View style={styles.externalOptionInfo}>
                    <Text style={styles.externalOptionTitle}>Federated Timeline</Text>
                    <Text style={styles.externalOptionDesc}>Public posts from across the Fediverse</Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.node.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.externalOption}
                  onPress={() => handleAddMastodonFeed('local', mastodonInstance)}
                >
                  <Text style={styles.externalOptionIcon}>🏠</Text>
                  <View style={styles.externalOptionInfo}>
                    <Text style={styles.externalOptionTitle}>Local Timeline</Text>
                    <Text style={styles.externalOptionDesc}>Posts from {mastodonInstance}</Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.node.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.externalOption}
                  onPress={() => handleAddMastodonFeed('trending', mastodonInstance)}
                >
                  <Text style={styles.externalOptionIcon}>📈</Text>
                  <View style={styles.externalOptionInfo}>
                    <Text style={styles.externalOptionTitle}>Trending</Text>
                    <Text style={styles.externalOptionDesc}>Currently popular posts</Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.node.muted} />
                </TouchableOpacity>

                <View style={styles.instanceSection}>
                  <Text style={styles.instanceLabel}>Instance:</Text>
                  <TextInput
                    style={styles.instanceInput}
                    value={mastodonInstance}
                    onChangeText={setMastodonInstance}
                    placeholder="mastodon.social"
                    placeholderTextColor={COLORS.node.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Text style={styles.instanceHint}>Popular instances:</Text>
                <View style={styles.instanceChips}>
                  {popularMastodonInstances.map((instance) => (
                    <TouchableOpacity
                      key={instance}
                      style={[
                        styles.instanceChip,
                        mastodonInstance === instance && styles.instanceChipActive,
                      ]}
                      onPress={() => setMastodonInstance(instance)}
                    >
                      <Text
                        style={[
                          styles.instanceChipText,
                          mastodonInstance === instance && styles.instanceChipTextActive,
                        ]}
                      >
                        {instance}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: COLORS.node.panel,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  content: {
    padding: 16,
  },
  typeList: {
    gap: 8,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.node.bg,
    gap: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.node.panel,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeInfo: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  typeDescription: {
    fontSize: 13,
    color: COLORS.node.muted,
    marginTop: 2,
  },
  nodeList: {
    gap: 8,
  },
  nodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.node.bg,
    gap: 12,
  },
  nodeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  nodeAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  nodeMembers: {
    fontSize: 13,
    color: COLORS.node.muted,
    marginTop: 2,
  },
  searchForm: {
    gap: 16,
  },
  searchLabel: {
    fontSize: 14,
    color: COLORS.node.textSecondary,
  },
  searchInput: {
    backgroundColor: COLORS.node.bg,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: COLORS.node.text,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  addButton: {
    backgroundColor: COLORS.node.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // External feed styles
  externalForm: {
    gap: 12,
  },
  externalLabel: {
    fontSize: 14,
    color: COLORS.node.textSecondary,
    marginBottom: 4,
  },
  externalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.node.bg,
    gap: 12,
  },
  externalOptionIcon: {
    fontSize: 24,
  },
  externalOptionInfo: {
    flex: 1,
  },
  externalOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  externalOptionDesc: {
    fontSize: 13,
    color: COLORS.node.muted,
    marginTop: 2,
  },
  instanceSection: {
    marginTop: 16,
  },
  instanceLabel: {
    fontSize: 14,
    color: COLORS.node.textSecondary,
    marginBottom: 8,
  },
  instanceInput: {
    backgroundColor: COLORS.node.bg,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.node.text,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  instanceHint: {
    fontSize: 12,
    color: COLORS.node.muted,
    marginTop: 12,
    marginBottom: 8,
  },
  instanceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  instanceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.node.bg,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  instanceChipActive: {
    backgroundColor: COLORS.node.accent,
    borderColor: COLORS.node.accent,
  },
  instanceChipText: {
    fontSize: 13,
    color: COLORS.node.muted,
  },
  instanceChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default AddColumnModal;
