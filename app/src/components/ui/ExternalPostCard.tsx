// External Post Card - Display posts from Bluesky and Mastodon
import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
  ScrollView,
  TextInput,
} from 'react-native';
import { MessageSquare, Repeat, Heart, ExternalLink, X, ChevronLeft, ChevronRight, Send } from './Icons';
import { useAppTheme } from '../../hooks/useTheme';
import type { ExternalPost, ExternalComment } from '../../lib/api';
import { getBlueskyThread, getMastodonThread } from '../../lib/api';
import { VibeBar, type VibeAggregateData } from '../VibeBar';
import { VibeRadialWheel } from '../VibeRadialWheel';

interface ExternalPostCardProps {
  post: ExternalPost;
  onPress?: () => void;
  onRepostToNode?: (post: ExternalPost) => void;
  onSaveToNode?: (post: ExternalPost) => void;
  isSaved?: boolean;
  hasLinkedAccount?: boolean;
  onExternalLike?: (post: ExternalPost) => Promise<{ recordUri?: string }>;
  onExternalUnlike?: (post: ExternalPost, recordUri?: string) => Promise<void>;
  onExternalRepost?: (post: ExternalPost) => Promise<{ recordUri?: string }>;
  onExternalUnrepost?: (post: ExternalPost, recordUri?: string) => Promise<void>;
  onExternalReply?: (post: ExternalPost, text: string) => Promise<void>;
  vibeAggregate?: VibeAggregateData | null;
  myReaction?: Record<string, number> | null;
  globalNodeId?: string;
}

// Auto-sizing image component that respects aspect ratio
const AutoSizeImage = ({ uri, maxHeight = 500, isGrid = false }: { uri: string; maxHeight?: number; isGrid?: boolean }) => {
  const theme = useAppTheme();
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
        style={[styles.mediaImage, { width: '100%', height: 150, backgroundColor: theme.bgAlt }]}
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
          backgroundColor: theme.bgAlt,
        },
      ]}
      resizeMode="contain"
      onError={() => setError(true)}
    />
  );
};

// Zoomable image with modal viewer
const ZoomableImage = ({ uri, maxHeight = 500 }: { uri: string; maxHeight?: number }) => {
  const theme = useAppTheme();
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
              backgroundColor: theme.bgAlt,
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

const ExternalPostCardInner: React.FC<ExternalPostCardProps> = ({
  post, onPress, onRepostToNode, onSaveToNode, isSaved = false,
  hasLinkedAccount, onExternalLike, onExternalUnlike, onExternalRepost, onExternalUnrepost, onExternalReply,
  vibeAggregate: vibeAggregateProp, myReaction: myReactionProp, globalNodeId,
}) => {
  const theme = useAppTheme();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ExternalComment[]>([]);
  const [localSaved, setLocalSaved] = useState(isSaved);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState(false);

  // Vibe state (optimistic updates)
  const [localVibeAggregate, setLocalVibeAggregate] = useState<VibeAggregateData | null>(vibeAggregateProp || null);
  const [localMyReaction, setLocalMyReaction] = useState<Record<string, number> | null>(myReactionProp || null);

  // Sync props to local state when they change
  useEffect(() => {
    if (vibeAggregateProp) setLocalVibeAggregate(vibeAggregateProp);
  }, [vibeAggregateProp]);
  useEffect(() => {
    if (myReactionProp) setLocalMyReaction(myReactionProp);
  }, [myReactionProp]);

  // External platform interaction state
  const [externalLiked, setExternalLiked] = useState(false);
  const [externalReposted, setExternalReposted] = useState(false);
  const [likeRecordUri, setLikeRecordUri] = useState<string | undefined>();
  const [repostRecordUri, setRepostRecordUri] = useState<string | undefined>();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [interactionLoading, setInteractionLoading] = useState<string | null>(null);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [repostedToNode, setRepostedToNode] = useState(false);
  const [visibleCommentCount, setVisibleCommentCount] = useState(5);

  const handleExternalLike = async () => {
    if (interactionLoading) return;

    if (externalLiked && onExternalUnlike) {
      setInteractionLoading('like');
      try {
        await onExternalUnlike(post, likeRecordUri);
        setExternalLiked(false);
        setLikeRecordUri(undefined);
      } catch (err) {
        console.error('External unlike failed:', err);
      } finally {
        setInteractionLoading(null);
      }
      return;
    }

    if (!onExternalLike) return;
    setInteractionLoading('like');
    try {
      const result = await onExternalLike(post);
      setExternalLiked(true);
      setLikeRecordUri(result?.recordUri);
    } catch (err) {
      console.error('External like failed:', err);
    } finally {
      setInteractionLoading(null);
    }
  };

  const handleExternalRepost = async () => {
    if (interactionLoading) return;

    if (externalReposted && onExternalUnrepost) {
      setInteractionLoading('repost');
      try {
        await onExternalUnrepost(post, repostRecordUri);
        setExternalReposted(false);
        setRepostRecordUri(undefined);
      } catch (err) {
        console.error('External unrepost failed:', err);
      } finally {
        setInteractionLoading(null);
      }
      return;
    }

    if (!onExternalRepost) return;
    setInteractionLoading('repost');
    try {
      const result = await onExternalRepost(post);
      setExternalReposted(true);
      setRepostRecordUri(result?.recordUri);
    } catch (err) {
      console.error('External repost failed:', err);
    } finally {
      setInteractionLoading(null);
    }
  };

  const handleRepostPress = () => {
    if (hasLinkedAccount) {
      if (externalReposted) {
        handleExternalRepost();
      } else {
        setShowRepostMenu(!showRepostMenu);
      }
    } else {
      onRepostToNode?.(post);
    }
  };

  const handleExternalReply = async () => {
    if (!onExternalReply || !replyText.trim() || interactionLoading) return;
    setInteractionLoading('reply');
    try {
      await onExternalReply(post, replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
    } catch (err) {
      console.error('External reply failed:', err);
    } finally {
      setInteractionLoading(null);
    }
  };

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
        result = await getBlueskyThread(post.externalId);
      } else {
        // Extract instance and status ID from Mastodon post
        // externalUrl is like "https://mastodon.social/@username/123456789"
        // externalId is the ActivityPub URI
        // Try externalUrl first (web URL format)
        const urlMatch = post.externalUrl.match(/https?:\/\/([^\/]+)\/@[^\/]+\/(\d+)/);
        if (urlMatch) {
          const [, instance, statusId] = urlMatch;
          result = await getMastodonThread(instance, statusId);
        } else {
          // Try externalId (ActivityPub URI format)
          const uriMatch = post.externalId.match(/https?:\/\/([^\/]+)\/users\/[^\/]+\/statuses\/(\d+)/);
          if (uriMatch) {
            const [, instance, statusId] = uriMatch;
            result = await getMastodonThread(instance, statusId);
          } else {
            console.error('Could not parse Mastodon post URL/ID');
            throw new Error('Could not parse Mastodon post URL');
          }
        }
      }

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
    <View style={[styles.container, showRepostMenu && styles.containerElevated]}>
      {/* Repost indicator */}
      {post.isRepost && post.repostedBy && (
        <View style={styles.repostHeader}>
          <Repeat size={12} color={theme.muted} />
          <Text style={[styles.repostText, { color: theme.muted }]}>
            {post.repostedBy.displayName || post.repostedBy.username} reposted
          </Text>
        </View>
      )}

      {/* Main card */}
      <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.border }]}>
        {/* Navigable content area — clicking opens external URL */}
        <TouchableOpacity
          onPress={onPress || handleOpenExternal}
          activeOpacity={0.7}
        >
          {/* Header with avatar, name, platform badge */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleOpenProfile} style={styles.authorSection}>
              {post.author.avatar ? (
                <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.bgAlt }]}>
                  <Text style={[styles.avatarInitial, { color: theme.textSecondary }]}>
                    {post.author.displayName?.charAt(0) || post.author.username?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.authorInfo}>
                <View style={styles.authorNameRow}>
                  <Text style={[styles.displayName, { color: theme.text }]} numberOfLines={1}>
                    {post.author.displayName}
                  </Text>
                  <PlatformBadge platform={post.platform} />
                </View>
                <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>
                  @{post.author.username}
                </Text>
              </View>
            </TouchableOpacity>
            <Text style={[styles.timestamp, { color: theme.muted }]}>{formatRelativeTime(post.createdAt)}</Text>
          </View>

          {/* Content */}
          <Text style={[styles.content, { color: theme.text }]}>{post.content}</Text>

          {/* Media - opens in-app viewer */}
          {post.mediaUrls.length > 0 && (
            <View style={styles.mediaContainer}>
              <ImageGallery urls={post.mediaUrls} maxHeight={500} />
            </View>
          )}
        </TouchableOpacity>

        {/* Stats row — unified: platform actions when linked, Node Social actions when not */}
        <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
          {/* Comment / Reply */}
          <TouchableOpacity
            style={[styles.stat, (showComments || showReplyInput) && [styles.statActive, { backgroundColor: `${theme.accent}15` }]]}
            onPress={() => {
              handleToggleComments();
              if (hasLinkedAccount) setShowReplyInput(!showReplyInput);
            }}
          >
            {interactionLoading === 'reply' ? (
              <ActivityIndicator size={14} color={theme.accent} />
            ) : (
              <MessageSquare size={16} color={(showComments || showReplyInput) ? theme.accent : theme.muted} />
            )}
            <Text style={[styles.statText, { color: theme.muted }, (showComments || showReplyInput) && { color: theme.accent }]}>
              {formatCount(post.replyCount)}
            </Text>
          </TouchableOpacity>

          {/* Vibe Radial Wheel */}
          <VibeRadialWheel
            contentId={post.id}
            nodeId={globalNodeId}
            contentType="external"
            initialReaction={localMyReaction}
            compact={true}
            onComplete={(intensities) => {
              // Optimistic update: merge new intensities into aggregate
              setLocalMyReaction({
                insightful: (intensities.Insightful || 0) / 100,
                joy: (intensities.Joy || 0) / 100,
                fire: (intensities.Fire || 0) / 100,
                support: (intensities.Support || 0) / 100,
                shock: (intensities.Shock || 0) / 100,
                questionable: (intensities.Questionable || 0) / 100,
              });
              setLocalVibeAggregate(prev => ({
                insightfulSum: (prev?.insightfulSum || 0) + (intensities.Insightful || 0) / 100,
                joySum: (prev?.joySum || 0) + (intensities.Joy || 0) / 100,
                fireSum: (prev?.fireSum || 0) + (intensities.Fire || 0) / 100,
                supportSum: (prev?.supportSum || 0) + (intensities.Support || 0) / 100,
                shockSum: (prev?.shockSum || 0) + (intensities.Shock || 0) / 100,
                questionableSum: (prev?.questionableSum || 0) + (intensities.Questionable || 0) / 100,
                totalReactions: (prev?.totalReactions || 0) + 1,
              }));
            }}
          />

          {/* Repost / Boost */}
          <View>
            <TouchableOpacity
              style={[styles.stat, (externalReposted || repostedToNode || showRepostMenu) && [styles.statActive, { backgroundColor: `${theme.accent}15` }]]}
              onPress={handleRepostPress}
              disabled={interactionLoading === 'repost'}
            >
              {interactionLoading === 'repost' ? (
                <ActivityIndicator size={14} color={theme.accent} />
              ) : (
                <Repeat size={16} color={(externalReposted || repostedToNode) ? theme.accent : theme.muted} />
              )}
              <Text style={[styles.statText, { color: (externalReposted || repostedToNode) ? theme.accent : theme.muted }]}>
                {formatCount(post.repostCount)}
              </Text>
            </TouchableOpacity>

            {/* Repost choice menu with backdrop for dismissal */}
            {showRepostMenu && (
              <>
                <Pressable
                  style={styles.repostMenuBackdrop}
                  onPress={() => setShowRepostMenu(false)}
                />
                <View style={[styles.repostMenu, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                  <TouchableOpacity
                    style={[styles.repostMenuItem, { borderBottomColor: theme.border }]}
                    onPress={() => {
                      setShowRepostMenu(false);
                      handleExternalRepost();
                    }}
                  >
                    <Repeat size={14} color={theme.text} />
                    <Text style={[styles.repostMenuText, { color: theme.text }]}>
                      {post.platform === 'bluesky' ? 'Repost on Bluesky' : 'Boost on Mastodon'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.repostMenuItem, { borderBottomWidth: 0 }]}
                    onPress={() => {
                      setShowRepostMenu(false);
                      onRepostToNode?.(post);
                      setRepostedToNode(true);
                    }}
                  >
                    <ExternalLink size={14} color={theme.text} />
                    <Text style={[styles.repostMenuText, { color: theme.text }]}>Repost to Node</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Like / Heart */}
          <TouchableOpacity
            style={[styles.stat, (externalLiked || localSaved) && [styles.statActive, { backgroundColor: 'rgba(239,68,68,0.08)' }]]}
            onPress={hasLinkedAccount ? handleExternalLike : () => {
              setLocalSaved(!localSaved);
              onSaveToNode?.(post);
            }}
            disabled={interactionLoading === 'like'}
          >
            {interactionLoading === 'like' ? (
              <ActivityIndicator size={14} color="#ef4444" />
            ) : (
              <Heart
                size={16}
                color={(hasLinkedAccount ? externalLiked : localSaved) ? '#ef4444' : theme.muted}
                fill={(hasLinkedAccount ? externalLiked : localSaved) ? '#ef4444' : 'none'}
              />
            )}
            <Text style={[styles.statText, { color: theme.muted }]}>
              {formatCount(post.likeCount)}
            </Text>
          </TouchableOpacity>

          {/* External link */}
          <TouchableOpacity style={styles.stat} onPress={handleOpenExternal}>
            <ExternalLink size={16} color={theme.muted} />
          </TouchableOpacity>
        </View>

        {/* Reply input */}
        {hasLinkedAccount && showReplyInput && (
          <View style={[styles.replyInputContainer, { borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.replyInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder={`Reply on ${post.platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}...`}
              placeholderTextColor={theme.muted}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={post.platform === 'bluesky' ? 300 : 500}
            />
            <TouchableOpacity
              style={[styles.replySubmitBtn, { backgroundColor: replyText.trim() ? theme.accent : theme.bgAlt }]}
              onPress={handleExternalReply}
              disabled={!replyText.trim() || interactionLoading === 'reply'}
            >
              {interactionLoading === 'reply' ? (
                <ActivityIndicator size={16} color="#fff" />
              ) : (
                <Send size={16} color={replyText.trim() ? '#fff' : theme.muted} />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Comments section */}
        {showComments && (
          <View style={[styles.commentsSection, { borderTopColor: theme.border }]}>
            {loadingComments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={[styles.loadingText, { color: theme.muted }]}>Loading replies...</Text>
              </View>
            ) : commentsError ? (
              <Text style={[styles.errorText, { color: theme.muted }]}>Failed to load replies</Text>
            ) : comments.length > 0 ? (
              <>
                {comments.slice(0, visibleCommentCount).map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      {comment.author.avatar ? (
                        <Image source={{ uri: comment.author.avatar }} style={styles.commentAvatarImg} />
                      ) : (
                        <View style={[styles.commentAvatarImg, styles.commentAvatarPlaceholder, { backgroundColor: theme.bgAlt }]}>
                          <Text style={[styles.commentAvatarInitial, { color: theme.textSecondary }]}>
                            {comment.author.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={[styles.commentAuthor, { color: theme.text }]}>
                          {comment.author.displayName || comment.author.username}
                        </Text>
                        <Text style={[styles.commentTime, { color: theme.muted }]}>{formatRelativeTime(comment.createdAt)}</Text>
                      </View>
                      <Text style={[styles.commentText, { color: theme.textSecondary }]} numberOfLines={3}>
                        {comment.content}
                      </Text>
                    </View>
                  </View>
                ))}
                {comments.length > visibleCommentCount && (
                  <TouchableOpacity
                    style={styles.viewMoreButton}
                    onPress={() => setVisibleCommentCount(prev => prev + 5)}
                  >
                    <Text style={[styles.viewMoreText, { color: theme.accent }]}>
                      Show more replies ({comments.length - visibleCommentCount} remaining)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={[styles.noCommentsText, { color: theme.muted }]}>No replies yet</Text>
            )}
            <TouchableOpacity
              style={[styles.viewOnPlatformButton, { backgroundColor: `${theme.accent}10` }]}
              onPress={hasLinkedAccount ? () => setShowReplyInput(true) : handleOpenExternal}
            >
              {hasLinkedAccount ? (
                <>
                  <MessageSquare size={14} color={theme.accent} />
                  <Text style={[styles.viewOnPlatformText, { color: theme.accent }]}>
                    Reply on {post.platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}
                  </Text>
                </>
              ) : (
                <>
                  <ExternalLink size={14} color={theme.accent} />
                  <Text style={[styles.viewOnPlatformText, { color: theme.accent }]}>
                    Reply on {post.platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Vibe Bar — hugs bottom of card, shows aggregate reactions */}
        {localVibeAggregate && (localVibeAggregate.insightfulSum || localVibeAggregate.joySum || localVibeAggregate.fireSum || localVibeAggregate.supportSum || localVibeAggregate.shockSum || localVibeAggregate.questionableSum) ? (
          <View style={styles.vibeBarBottom}>
            <VibeBar vibeAggregate={localVibeAggregate} height={5} />
          </View>
        ) : null}
      </View>
    </View>
  );
};

// Memoize to prevent unnecessary re-renders during scroll
export const ExternalPostCard = memo(ExternalPostCardInner, (prevProps, nextProps) => {
  return prevProps.post.id === nextProps.post.id
    && prevProps.isSaved === nextProps.isSaved
    && prevProps.hasLinkedAccount === nextProps.hasLinkedAccount
    && prevProps.vibeAggregate === nextProps.vibeAggregate
    && prevProps.myReaction === nextProps.myReaction;
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  containerElevated: {
    zIndex: 10,
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
  },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
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
    flexShrink: 1,
  },
  username: {
    fontSize: 13,
    marginTop: 1,
  },
  timestamp: {
    fontSize: 12,
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
  },
  vibeBarBottom: {
    marginHorizontal: -12,
    marginBottom: -12,
    marginTop: 8,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statText: {
    fontSize: 13,
  },
  statActive: {
    // Only background changes — no padding/margin shift
  },
  statTextActive: {
  },
  commentsSection: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
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
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    padding: 12,
  },
  noCommentsText: {
    fontSize: 13,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  commentTime: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
  },
  viewMoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewOnPlatformButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 8,
  },
  viewOnPlatformText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Reply input styles
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
  },
  replySubmitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Repost menu styles
  repostMenuBackdrop: {
    position: 'fixed' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  repostMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 180,
    zIndex: 100,
    boxShadow: '0px -2px 12px rgba(0, 0, 0, 0.15)',
  },
  repostMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  repostMenuText: {
    fontSize: 13,
    fontWeight: '500',
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
