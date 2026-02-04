// External Post Card - Display posts from Bluesky and Mastodon
import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { MessageSquare, Repeat, Heart, ExternalLink, X, ChevronLeft, ChevronRight } from './Icons';
import { COLORS } from '../../constants/theme';
import type { ExternalPost, ExternalComment } from '../../lib/api';
import { getBlueskyThread, getMastodonThread } from '../../lib/api';

interface ExternalPostCardProps {
  post: ExternalPost;
  onPress?: () => void;
}

// Auto-sizing image component that respects aspect ratio
const AutoSizeImage = ({ uri, maxHeight = 500, isGrid = false }: { uri: string; maxHeight?: number; isGrid?: boolean }) => {
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [error, setError] = useState(false);

  useEffect(() => {
    Image.getSize(
      uri,
      (width, height) => {
        setAspectRatio(width / height);
      },
      () => {
        // Keep default aspect ratio on error
      }
    );
  }, [uri]);

  if (error) return null;

  // For grid images, use fixed height; for single images, use aspect ratio
  if (isGrid) {
    return (
      <Image
        source={{ uri }}
        style={[styles.mediaImage, { width: '100%', height: 150 }]}
        resizeMode="cover"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[
        styles.mediaImage,
        {
          width: '100%',
          aspectRatio,
          height: undefined,
          maxHeight,
        },
      ]}
      resizeMode="contain"
      onError={() => setError(true)}
    />
  );
};

// Zoomable image with modal viewer
const ZoomableImage = ({ uri, maxHeight = 500 }: { uri: string; maxHeight?: number }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    Image.getSize(
      uri,
      (width, height) => {
        setAspectRatio(width / height);
      },
      () => {}
    );
  }, [uri]);

  return (
    <>
      <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.9}>
        <Image
          source={{ uri }}
          style={[
            styles.mediaImage,
            {
              width: '100%',
              aspectRatio,
              height: undefined,
              maxHeight,
            },
          ]}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
        <View style={styles.imageZoomModal}>
          <TouchableOpacity
            style={styles.imageZoomClose}
            onPress={() => setModalVisible(false)}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.imageZoomContainer}
            onPress={() => setModalVisible(false)}
          >
            <Image
              source={{ uri }}
              style={{
                width: screenWidth,
                height: screenWidth / aspectRatio,
                maxHeight: screenHeight * 0.85,
              }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

// Image gallery with carousel for multiple images
const ImageGallery = ({ urls, maxHeight = 500 }: { urls: string[]; maxHeight?: number }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [aspectRatios, setAspectRatios] = useState<number[]>([]);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    // Preload all image sizes
    urls.forEach((uri, index) => {
      Image.getSize(
        uri,
        (width, height) => {
          setAspectRatios(prev => {
            const newRatios = [...prev];
            newRatios[index] = width / height;
            return newRatios;
          });
        },
        () => {}
      );
    });
  }, [urls]);

  if (urls.length === 0) return null;

  // Single image - use zoomable
  if (urls.length === 1) {
    return <ZoomableImage uri={urls[0]!} maxHeight={maxHeight} />;
  }

  // Grid for 2-4 images
  return (
    <>
      <View style={styles.mediaContainerGrid}>
        {urls.slice(0, 4).map((url, index) => (
          <TouchableOpacity
            key={index}
            style={styles.mediaGridItem}
            onPress={() => {
              setActiveIndex(index);
              setModalVisible(true);
            }}
            activeOpacity={0.9}
          >
            <AutoSizeImage uri={url} isGrid={true} />
            {index === 3 && urls.length > 4 && (
              <View style={styles.moreImagesOverlay}>
                <Text style={styles.moreImagesText}>+{urls.length - 4}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Full screen modal for gallery */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
        <View style={styles.imageZoomModal}>
          <TouchableOpacity
            style={styles.imageZoomClose}
            onPress={() => setModalVisible(false)}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>

          {/* Image counter */}
          <View style={styles.galleryCounter}>
            <Text style={styles.galleryCounterText}>
              {activeIndex + 1} / {urls.length}
            </Text>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setActiveIndex(index);
            }}
            contentOffset={{ x: activeIndex * screenWidth, y: 0 }}
          >
            {urls.map((url, index) => {
              const ratio = aspectRatios[index] || 16 / 9;
              return (
                <TouchableOpacity
                  key={index}
                  activeOpacity={1}
                  style={{ width: screenWidth, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setModalVisible(false)}
                >
                  <Image
                    source={{ uri: url }}
                    style={{
                      width: screenWidth,
                      height: screenWidth / ratio,
                      maxHeight: screenHeight * 0.85,
                    }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Navigation arrows */}
          {activeIndex > 0 && (
            <TouchableOpacity
              style={[styles.galleryNav, styles.galleryNavLeft]}
              onPress={() => setActiveIndex(activeIndex - 1)}
            >
              <ChevronLeft size={32} color="#fff" />
            </TouchableOpacity>
          )}
          {activeIndex < urls.length - 1 && (
            <TouchableOpacity
              style={[styles.galleryNav, styles.galleryNavRight]}
              onPress={() => setActiveIndex(activeIndex + 1)}
            >
              <ChevronRight size={32} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </>
  );
};

// Platform badge component
const PlatformBadge = ({ platform }: { platform: 'bluesky' | 'mastodon' }) => {
  const isBluesky = platform === 'bluesky';
  return (
    <View style={[styles.platformBadge, isBluesky ? styles.blueskyBadge : styles.mastodonBadge]}>
      <Text style={styles.platformBadgeText}>
        {isBluesky ? '🦋' : '🦣'}
      </Text>
    </View>
  );
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
};

// Format large numbers
const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const ExternalPostCardInner: React.FC<ExternalPostCardProps> = ({ post, onPress }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ExternalComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState(false);

  const handleOpenExternal = () => {
    Linking.openURL(post.externalUrl);
  };

  const handleOpenProfile = () => {
    Linking.openURL(post.author.profileUrl);
  };

  const handleToggleComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }

    // If we already have comments, just show them
    if (comments.length > 0) {
      setShowComments(true);
      return;
    }

    // Fetch comments
    setLoadingComments(true);
    setCommentsError(false);
    setShowComments(true);

    try {
      let result;
      if (post.platform === 'bluesky') {
        console.log('Fetching Bluesky thread for:', post.externalId);
        result = await getBlueskyThread(post.externalId);
      } else {
        // Extract instance and status ID from Mastodon post
        // externalUrl is like "https://mastodon.social/@username/123456789"
        // externalId is the ActivityPub URI
        console.log('Parsing Mastodon URL:', post.externalUrl, 'externalId:', post.externalId);

        // Try externalUrl first (web URL format)
        const urlMatch = post.externalUrl.match(/https?:\/\/([^\/]+)\/@[^\/]+\/(\d+)/);
        if (urlMatch) {
          const [, instance, statusId] = urlMatch;
          console.log('Extracted from URL:', instance, statusId);
          result = await getMastodonThread(instance, statusId);
        } else {
          // Try externalId (ActivityPub URI format)
          const uriMatch = post.externalId.match(/https?:\/\/([^\/]+)\/users\/[^\/]+\/statuses\/(\d+)/);
          if (uriMatch) {
            const [, instance, statusId] = uriMatch;
            console.log('Extracted from URI:', instance, statusId);
            result = await getMastodonThread(instance, statusId);
          } else {
            console.error('Could not parse Mastodon post URL/ID');
            throw new Error('Could not parse Mastodon post URL');
          }
        }
      }

      console.log('Thread result:', result);
      if (result?.replies) {
        setComments(result.replies);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setCommentsError(true);
    }

    setLoadingComments(false);
  };

  return (
    <View style={styles.container}>
      {/* Repost indicator */}
      {post.isRepost && post.repostedBy && (
        <View style={styles.repostHeader}>
          <Repeat size={12} color={COLORS.node.muted} />
          <Text style={styles.repostText}>
            {post.repostedBy.displayName || post.repostedBy.username} reposted
          </Text>
        </View>
      )}

      {/* Main card */}
      <TouchableOpacity
        style={styles.card}
        onPress={onPress || handleOpenExternal}
        activeOpacity={0.7}
      >
        {/* Header with avatar, name, platform badge */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleOpenProfile} style={styles.authorSection}>
            {post.author.avatar ? (
              <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {post.author.displayName?.charAt(0) || post.author.username?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {post.author.displayName}
                </Text>
                <PlatformBadge platform={post.platform} />
              </View>
              <Text style={styles.username} numberOfLines={1}>
                @{post.author.username}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.timestamp}>{formatRelativeTime(post.createdAt)}</Text>
        </View>

        {/* Content */}
        <Text style={styles.content}>{post.content}</Text>

        {/* Media - opens in-app viewer */}
        {post.mediaUrls.length > 0 && (
          <View style={styles.mediaContainer}>
            <ImageGallery urls={post.mediaUrls} maxHeight={500} />
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.stat, showComments && styles.statActive]}
            onPress={handleToggleComments}
          >
            <MessageSquare size={16} color={showComments ? COLORS.node.accent : COLORS.node.muted} />
            <Text style={[styles.statText, showComments && styles.statTextActive]}>
              {formatCount(post.replyCount)}
            </Text>
          </TouchableOpacity>
          <View style={styles.stat}>
            <Repeat size={16} color={COLORS.node.muted} />
            <Text style={styles.statText}>{formatCount(post.repostCount)}</Text>
          </View>
          <View style={styles.stat}>
            <Heart size={16} color={COLORS.node.muted} />
            <Text style={styles.statText}>{formatCount(post.likeCount)}</Text>
          </View>
          <TouchableOpacity style={styles.stat} onPress={handleOpenExternal}>
            <ExternalLink size={16} color={COLORS.node.muted} />
          </TouchableOpacity>
        </View>

        {/* Comments section */}
        {showComments && (
          <View style={styles.commentsSection}>
            {loadingComments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.node.accent} />
                <Text style={styles.loadingText}>Loading replies...</Text>
              </View>
            ) : commentsError ? (
              <Text style={styles.errorText}>Failed to load replies</Text>
            ) : comments.length > 0 ? (
              <>
                {comments.slice(0, 5).map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      {comment.author.avatar ? (
                        <Image source={{ uri: comment.author.avatar }} style={styles.commentAvatarImg} />
                      ) : (
                        <View style={[styles.commentAvatarImg, styles.commentAvatarPlaceholder]}>
                          <Text style={styles.commentAvatarInitial}>
                            {comment.author.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>
                          {comment.author.displayName || comment.author.username}
                        </Text>
                        <Text style={styles.commentTime}>{formatRelativeTime(comment.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentText} numberOfLines={3}>
                        {comment.content}
                      </Text>
                    </View>
                  </View>
                ))}
                {comments.length > 5 && (
                  <TouchableOpacity style={styles.viewMoreButton} onPress={handleOpenExternal}>
                    <Text style={styles.viewMoreText}>
                      View all {comments.length} replies on {post.platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.noCommentsText}>No replies yet</Text>
            )}
            <TouchableOpacity style={styles.viewOnPlatformButton} onPress={handleOpenExternal}>
              <ExternalLink size={14} color={COLORS.node.accent} />
              <Text style={styles.viewOnPlatformText}>
                Reply on {post.platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

// Memoize to prevent unnecessary re-renders during scroll
export const ExternalPostCard = memo(ExternalPostCardInner, (prevProps, nextProps) => {
  return prevProps.post.id === nextProps.post.id;
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 2,
  },
  repostText: {
    fontSize: 12,
    color: COLORS.node.muted,
  },
  card: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.node.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.node.textSecondary,
  },
  authorInfo: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.node.text,
    flexShrink: 1,
  },
  username: {
    fontSize: 13,
    color: COLORS.node.textSecondary,
    marginTop: 1,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.node.muted,
    marginLeft: 8,
  },
  platformBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blueskyBadge: {
    backgroundColor: 'rgba(0, 133, 255, 0.15)',
  },
  mastodonBadge: {
    backgroundColor: 'rgba(99, 100, 255, 0.15)',
  },
  platformBadgeText: {
    fontSize: 10,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.node.text,
    marginBottom: 10,
  },
  mediaContainer: {
    marginBottom: 10,
    marginLeft: -12,
    marginRight: -12,
    overflow: 'hidden',
  },
  mediaContainerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaSingleItem: {
    width: '100%',
  },
  mediaGridItem: {
    width: '50%',
    padding: 1,
  },
  mediaImage: {
    backgroundColor: COLORS.node.bgAlt,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: COLORS.node.muted,
  },
  statActive: {
    backgroundColor: `${COLORS.node.accent}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: -8,
  },
  statTextActive: {
    color: COLORS.node.accent,
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.node.muted,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.node.muted,
    textAlign: 'center',
    padding: 12,
  },
  noCommentsText: {
    fontSize: 13,
    color: COLORS.node.muted,
    textAlign: 'center',
    padding: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  commentAvatar: {
    width: 28,
    height: 28,
  },
  commentAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentAvatarPlaceholder: {
    backgroundColor: COLORS.node.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.node.textSecondary,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  commentTime: {
    fontSize: 11,
    color: COLORS.node.muted,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.node.textSecondary,
    lineHeight: 18,
  },
  viewMoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.node.accent,
  },
  viewOnPlatformButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: `${COLORS.node.accent}10`,
    borderRadius: 8,
  },
  viewOnPlatformText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.node.accent,
  },
  // Image zoom modal styles
  imageZoomModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageZoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageZoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  // Gallery styles
  galleryCounter: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  galleryCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryNav: {
    position: 'absolute',
    top: '50%',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
  },
  galleryNavLeft: {
    left: 10,
  },
  galleryNavRight: {
    right: 10,
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});

export default ExternalPostCard;
