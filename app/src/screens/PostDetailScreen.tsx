import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Share,
  Modal,
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MessageSquare, Share2, Bookmark, X, ImageIcon, Camera, Smile, Play } from "lucide-react-native";
import { getPost, getComments, createComment, Post, Comment, savePost } from "../lib/api";
import { COLORS } from "../constants/theme";
import { VibeBar, VibeAggregateData } from "../components/VibeBar";
import { VibeRadialWheel } from "../components/VibeRadialWheel";
// Only import YouTube player on native platforms
const YoutubePlayer = Platform.OS !== 'web' ? require('react-native-youtube-iframe').default : null;

// Helper to detect video URLs
const isVideoUrl = (url: string): boolean => {
  const videoPatterns = [
    /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i,
    /youtube\.com\/watch\?v=/i,
    /youtu\.be\//i,
    /vimeo\.com\//i,
    /tiktok\.com\//i,
  ];
  return videoPatterns.some(pattern => pattern.test(url));
};

// Helper to get YouTube video ID
const getYouTubeVideoId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
};

// Helper to get YouTube thumbnail
const getYouTubeThumbnail = (url: string): string | null => {
  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return null;
};

// YouTube Player Component - uses iframe on web, native player on mobile
const YouTubeEmbed = ({ videoId }: { videoId: string }) => {
  const [playing, setPlaying] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  const playerWidth = Math.min(screenWidth - 32, 600);
  const playerHeight = playerWidth * (9 / 16);

  // Use iframe for web
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.youtubeContainer, { width: playerWidth, height: playerHeight }]}>
        <iframe
          width={playerWidth}
          height={playerHeight}
          src={`https://www.youtube.com/embed/${videoId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ borderRadius: 12 }}
        />
      </View>
    );
  }

  // Use native player for iOS/Android
  return (
    <View style={styles.youtubeContainer}>
      {YoutubePlayer && (
        <YoutubePlayer
          height={playerHeight}
          width={playerWidth}
          play={playing}
          videoId={videoId}
          onChangeState={(state: string) => {
            if (state === 'ended') setPlaying(false);
          }}
        />
      )}
    </View>
  );
};

// Helper to check if URL is an image
const isImageUrl = (url: string): boolean => {
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
};

// Auto-sizing image component that maintains aspect ratio
const AutoSizeImage = ({ uri, maxHeight = 400 }: { uri: string; maxHeight?: number }) => {
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  useEffect(() => {
    Image.getSize(
      uri,
      (width, height) => {
        setAspectRatio(width / height);
      },
      (error) => {
        console.log('Failed to get image size:', error);
      }
    );
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={[
        styles.postMediaImage,
        {
          aspectRatio,
          maxHeight,
        }
      ]}
      resizeMode="contain"
    />
  );
};

const MAX_REPLY_LENGTH = 500;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Thread depth colors using vibe vector colors
const THREAD_COLORS = [
  '#3b82f6',  // Blue (Insightful)
  '#eab308',  // Yellow (Joy)
  '#f97316',  // Orange (Fire)
  '#ec4899',  // Pink (Support)
  '#8b5cf6',  // Violet (Shock)
  '#64748b',  // Slate (Questionable)
];

type PostDetailScreenProps = {
  postId: string;
  onBack: () => void;
  onAuthorClick?: (authorId: string) => void;
};

interface PostWithVibes extends Post {
  vibeAggregate?: VibeAggregateData | null;
  myReaction?: { [key: string]: number } | null;
}

interface CommentWithThread extends Comment {
  isLastInThread?: boolean;
  hasRepliesBelow?: boolean;
  threadDepth?: number;
}

// Helper to format relative time
const formatTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Sort comments so replies appear directly after their parent
const sortCommentsThreaded = (comments: Comment[]): CommentWithThread[] => {
  // Build a map of parentId -> children
  const childrenMap = new Map<string | null, Comment[]>();

  comments.forEach(comment => {
    const parentId = comment.parentId || null;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(comment);
  });

  // Sort children by createdAt ascending (oldest first within each group)
  childrenMap.forEach(children => {
    children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  });

  // Flatten: start with top-level, then recursively add children
  const result: CommentWithThread[] = [];

  const addWithChildren = (comment: Comment, depth: number = 0) => {
    const children = childrenMap.get(comment.id) || [];
    const hasRepliesBelow = children.length > 0;

    result.push({
      ...comment,
      hasRepliesBelow,
      threadDepth: depth,
    });

    children.forEach((child, index) => {
      addWithChildren(child, depth + 1);
    });
  };

  // Start with top-level comments (parentId is null)
  const topLevel = childrenMap.get(null) || [];
  topLevel.forEach(comment => addWithChildren(comment, 0));

  // Mark last comment in each thread chain
  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    const next = result[i + 1];

    // If next comment is top-level or doesn't exist, current is last in its thread
    if (!next || !next.parentId) {
      current.isLastInThread = true;
    } else if (current.threadDepth !== undefined && next.threadDepth !== undefined) {
      // If next is at same or lower depth, current ends its branch
      if (next.threadDepth <= current.threadDepth && !current.hasRepliesBelow) {
        current.isLastInThread = true;
      }
    }
  }

  return result;
};

export const PostDetailScreen = ({ postId, onBack, onAuthorClick }: PostDetailScreenProps) => {
  const [post, setPost] = useState<PostWithVibes | null>(null);
  const [comments, setComments] = useState<CommentWithThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Reply modal state
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [modalReplyText, setModalReplyText] = useState("");
  const [sendingModalReply, setSendingModalReply] = useState(false);

  const loadData = async () => {
    setError(null);
    setLoading(true);
    try {
      const [postData, commentsData] = await Promise.all([
        getPost(postId),
        getComments(postId, { limit: 100, all: true }),
      ]);
      setPost(postData as PostWithVibes);
      // Sort comments so replies appear after their parents
      setComments(sortCommentsThreaded(commentsData));
    } catch (err) {
      console.error("Failed to load post detail:", err);
      setError("Failed to load post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [postId]);

  const handleSendComment = async () => {
    if (!replyText.trim()) return;

    setSending(true);
    try {
      const newComment = await createComment(postId, { content: replyText.trim() });
      // Re-sort after adding
      setComments(prev => sortCommentsThreaded([newComment, ...prev]));
      setReplyText("");

      if (post) {
        setPost({ ...post, commentCount: post.commentCount + 1 });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to post comment.");
    } finally {
      setSending(false);
    }
  };

  const handleOpenReplyModal = (comment: Comment) => {
    setReplyingTo(comment);
    setModalReplyText("");
    setReplyModalVisible(true);
  };

  const handleSendModalReply = async () => {
    if (!modalReplyText.trim() || !replyingTo) return;

    setSendingModalReply(true);
    try {
      const newComment = await createComment(postId, {
        content: modalReplyText.trim(),
        parentId: replyingTo.id
      });
      // Re-sort after adding
      setComments(prev => sortCommentsThreaded([...prev, newComment]));
      setReplyModalVisible(false);
      setReplyingTo(null);
      setModalReplyText("");

      if (post) {
        setPost({ ...post, commentCount: post.commentCount + 1 });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to post reply.");
    } finally {
      setSendingModalReply(false);
    }
  };

  const handleSave = async () => {
    if (!post) return;
    try {
      await savePost(post.id);
      setIsSaved(!isSaved);
    } catch (err) {
      console.error("Failed to save post:", err);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        message: post.content || post.title || "Check out this post!",
      });
    } catch (err) {
      console.error("Failed to share:", err);
    }
  };

  const renderComment = ({ item, index }: { item: CommentWithThread; index: number }) => {
    const isReply = !!item.parentId;
    const nextComment = comments[index + 1];

    // Get depths for comparison
    const currentDepth = item.threadDepth ?? 0;
    const nextDepth = nextComment?.threadDepth ?? -1;

    // Check relationships to next comment
    const nextIsDirectReply = nextComment?.parentId === item.id;
    const nextIsSibling = nextComment?.parentId === item.parentId && !!item.parentId;
    // Key fix: detect when thread "unwinds" back to an ancestor level
    const nextIsReturningToAncestor = nextComment && nextDepth > 0 && nextDepth < currentDepth;

    // Show line down if:
    // 1. Next is our direct reply (we're parent)
    // 2. Next is our sibling (same parent)
    // 3. Next is returning to an ancestor thread (thread unwinding)
    const showLineDown = nextIsDirectReply || nextIsSibling || nextIsReturningToAncestor;

    // Get color based on thread depth (cycles through vibe colors)
    const depth = currentDepth;
    const lineColor = THREAD_COLORS[depth % THREAD_COLORS.length];

    // Parent's color (for connecting up to parent or between siblings)
    const parentDepth = Math.max(0, depth - 1);
    const parentLineColor = THREAD_COLORS[parentDepth % THREAD_COLORS.length];

    // Line DOWN color:
    // - If next is our direct reply: use OUR color (we're the parent)
    // - If next is a sibling: use PARENT's color (we share the same parent)
    // - If returning to ancestor: use the ancestor's thread color
    let lineDownColor;
    if (nextIsDirectReply) {
      lineDownColor = lineColor;
    } else if (nextIsSibling) {
      lineDownColor = parentLineColor;
    } else if (nextIsReturningToAncestor) {
      // When unwinding, color should be the thread we're returning to
      // That's the parent of the next comment, which is at nextDepth - 1
      lineDownColor = THREAD_COLORS[Math.max(0, nextDepth - 1) % THREAD_COLORS.length];
    } else {
      lineDownColor = lineColor;
    }

    return (
      <View style={styles.commentWrapper}>
        {/* Connecting line from previous comment to this avatar - uses PARENT's color */}
        {isReply && (
          <View style={[styles.connectingLineTop, { backgroundColor: parentLineColor }]} />
        )}

        {/* Connecting line going down from this avatar to next comment */}
        {showLineDown && (
          <View style={[styles.connectingLineDown, { backgroundColor: lineDownColor }]} />
        )}

        <View style={styles.commentCard}>
          {/* Avatar column */}
          <View style={styles.avatarColumn}>
            <TouchableOpacity
              onPress={() => onAuthorClick?.(item.author.id)}
            >
              {item.author.avatar ? (
                <Image source={{ uri: item.author.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {item.author.username?.[0]?.toUpperCase() || item.author.email?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.commentContent}>
            {/* Header row */}
            <View style={styles.commentHeader}>
              <TouchableOpacity onPress={() => onAuthorClick?.(item.author.id)}>
                <Text style={styles.commentAuthor}>
                  {item.author.username || item.author.email.split("@")[0]}
                </Text>
              </TouchableOpacity>
              <Text style={styles.commentDot}> · </Text>
              <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
            </View>

            {/* Comment text */}
            <Text style={styles.commentText}>{item.content}</Text>

            {/* Action bar */}
            <View style={styles.commentActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleOpenReplyModal(item)}
              >
                <MessageSquare size={16} color={COLORS.node.muted} />
                {item.replyCount > 0 && (
                  <Text style={styles.actionCount}>{item.replyCount}</Text>
                )}
              </TouchableOpacity>

              <VibeRadialWheel
                postId={item.id}
                nodeId="global"
                initialReaction={null}
                buttonLabel=""
                compact={true}
                contentType="comment"
              />

              <TouchableOpacity style={styles.actionButton}>
                <Share2 size={16} color={COLORS.node.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPostHeader = () => {
    if (!post) return null;

    return (
      <View style={styles.postContainer}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={loadData}>
              <Text style={styles.errorBannerRetry}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Post */}
        <View style={styles.postCard}>
          {/* Author row */}
          <View style={styles.postAuthorRow}>
            <TouchableOpacity
              style={styles.postAvatarTouchable}
              onPress={() => onAuthorClick?.(post.author.id)}
            >
              {post.author.avatar ? (
                <Image source={{ uri: post.author.avatar }} style={styles.postAvatar} />
              ) : (
                <View style={styles.postAvatarPlaceholder}>
                  <Text style={styles.postAvatarText}>
                    {post.author.username?.[0]?.toUpperCase() || post.author.email?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.postAuthorInfo}>
              <TouchableOpacity onPress={() => onAuthorClick?.(post.author.id)}>
                <Text style={styles.postAuthorName}>
                  {post.author.username || post.author.email.split("@")[0]}
                </Text>
              </TouchableOpacity>
              {post.node && (
                <Text style={styles.postNode}>n/{post.node.slug}</Text>
              )}
            </View>
          </View>

          {/* Post content */}
          {post.title && <Text style={styles.postTitle}>{post.title}</Text>}
          {post.content && <Text style={styles.postContent}>{post.content}</Text>}

          {/* Image/Video/Link Preview */}
          {post.linkUrl && (
            <View style={styles.postMediaContainer}>
              {isImageUrl(post.linkUrl) ? (
                <AutoSizeImage uri={post.linkUrl} maxHeight={500} />
              ) : isVideoUrl(post.linkUrl) ? (
                getYouTubeVideoId(post.linkUrl) ? (
                  <YouTubeEmbed videoId={getYouTubeVideoId(post.linkUrl)!} />
                ) : (
                  <TouchableOpacity
                    style={styles.videoPreview}
                    onPress={() => Linking.openURL(post.linkUrl!)}
                  >
                    <View style={styles.videoPlaceholder} />
                    <View style={styles.playButtonOverlay}>
                      <View style={styles.playButton}>
                        <Play size={32} color="#fff" fill="#fff" />
                      </View>
                    </View>
                    <View style={styles.videoLabel}>
                      <Text style={styles.videoLabelText}>
                        {post.linkUrl.includes('vimeo') ? 'Vimeo' :
                         post.linkUrl.includes('tiktok') ? 'TikTok' : 'Video'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              ) : post.linkMeta?.image ? (
                <TouchableOpacity
                  style={styles.linkPreview}
                  onPress={() => Linking.openURL(post.linkUrl!)}
                >
                  <Image
                    source={{ uri: post.linkMeta.image }}
                    style={styles.linkPreviewImage}
                    resizeMode="cover"
                  />
                  <View style={styles.linkPreviewContent}>
                    {post.linkMeta.title && (
                      <Text style={styles.linkPreviewTitle} numberOfLines={2}>
                        {post.linkMeta.title}
                      </Text>
                    )}
                    {post.linkMeta.description && (
                      <Text style={styles.linkPreviewDescription} numberOfLines={2}>
                        {post.linkMeta.description}
                      </Text>
                    )}
                    {post.linkMeta.domain && (
                      <Text style={styles.linkPreviewDomain}>
                        {post.linkMeta.domain}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.plainLink}
                  onPress={() => Linking.openURL(post.linkUrl!)}
                >
                  <Text style={styles.plainLinkText} numberOfLines={1}>
                    {post.linkUrl}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Timestamp */}
          <Text style={styles.postTimestamp}>
            {new Date(post.createdAt).toLocaleString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </Text>

          {/* Engagement stats */}
          <View style={styles.postStats}>
            <Text style={styles.postStatText}>
              <Text style={styles.postStatNumber}>{post.commentCount}</Text> Comments
            </Text>
          </View>

          {/* Action bar */}
          <View style={styles.postActions}>
            <VibeRadialWheel
              postId={post.id}
              nodeId={post.node?.id || "global"}
              initialReaction={post.myReaction}
              buttonLabel="Vibe"
              onComplete={(intensities) => {
                setPost(prev => prev ? {
                  ...prev,
                  myReaction: {
                    insightful: intensities.Insightful / 100,
                    joy: intensities.Joy / 100,
                    fire: intensities.Fire / 100,
                    support: intensities.Support / 100,
                    shock: intensities.Shock / 100,
                    questionable: intensities.Questionable / 100,
                  },
                  vibeAggregate: {
                    ...prev.vibeAggregate,
                    insightfulSum: (prev.vibeAggregate?.insightfulSum || 0) + intensities.Insightful / 100,
                    joySum: (prev.vibeAggregate?.joySum || 0) + intensities.Joy / 100,
                    fireSum: (prev.vibeAggregate?.fireSum || 0) + intensities.Fire / 100,
                    supportSum: (prev.vibeAggregate?.supportSum || 0) + intensities.Support / 100,
                    shockSum: (prev.vibeAggregate?.shockSum || 0) + intensities.Shock / 100,
                    questionableSum: (prev.vibeAggregate?.questionableSum || 0) + intensities.Questionable / 100,
                  }
                } : null);
              }}
            />

            <TouchableOpacity style={styles.postActionButton}>
              <MessageSquare size={20} color={COLORS.node.muted} />
              <Text style={styles.actionText}>{post.commentCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.postActionButton} onPress={handleSave}>
              <Bookmark
                size={20}
                color={isSaved ? COLORS.node.accent : COLORS.node.muted}
                fill={isSaved ? COLORS.node.accent : 'none'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.postActionButton} onPress={handleShare}>
              <Share2 size={20} color={COLORS.node.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Vibe Bar */}
        <VibeBar vibeAggregate={post.vibeAggregate} height={6} />
      </View>
    );
  };

  const renderReplyModal = () => (
    <Modal
      visible={replyModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setReplyModalVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setReplyModalVisible(false)}
            style={styles.modalCloseButton}
          >
            <X size={24} color={COLORS.node.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Reply</Text>
          <TouchableOpacity
            style={[
              styles.modalPostButton,
              (!modalReplyText.trim() || sendingModalReply) && styles.modalPostButtonDisabled
            ]}
            onPress={handleSendModalReply}
            disabled={!modalReplyText.trim() || sendingModalReply}
          >
            {sendingModalReply ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalPostButtonText}>Reply</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Replying to preview */}
        {replyingTo && (
          <View style={styles.replyingToContainer}>
            <View style={styles.replyingToLine} />
            <View style={styles.replyingToContent}>
              <View style={styles.replyingToHeader}>
                {replyingTo.author.avatar ? (
                  <Image source={{ uri: replyingTo.author.avatar }} style={styles.replyingToAvatar} />
                ) : (
                  <View style={styles.replyingToAvatarPlaceholder}>
                    <Text style={styles.replyingToAvatarText}>
                      {replyingTo.author.username?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <Text style={styles.replyingToAuthor}>
                  {replyingTo.author.username || replyingTo.author.email.split("@")[0]}
                </Text>
                <Text style={styles.replyingToTime}> · {formatTimeAgo(replyingTo.createdAt)}</Text>
              </View>
              <Text style={styles.replyingToText} numberOfLines={3}>
                {replyingTo.content}
              </Text>
            </View>
          </View>
        )}

        {/* Reply input area */}
        <View style={styles.modalInputContainer}>
          <TextInput
            style={styles.modalInput}
            placeholder="Post your reply..."
            placeholderTextColor={COLORS.node.muted}
            value={modalReplyText}
            onChangeText={(text) => {
              if (text.length <= MAX_REPLY_LENGTH) {
                setModalReplyText(text);
              }
            }}
            multiline
            autoFocus
          />
        </View>

        {/* Bottom toolbar */}
        <View style={styles.modalToolbar}>
          <View style={styles.modalToolbarIcons}>
            <TouchableOpacity style={styles.toolbarIcon}>
              <ImageIcon size={22} color={COLORS.node.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarIcon}>
              <Camera size={22} color={COLORS.node.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarIcon}>
              <Smile size={22} color={COLORS.node.accent} />
            </TouchableOpacity>
          </View>
          <Text style={[
            styles.charCounter,
            modalReplyText.length > MAX_REPLY_LENGTH * 0.9 && styles.charCounterWarning,
            modalReplyText.length >= MAX_REPLY_LENGTH && styles.charCounterError,
          ]}>
            {modalReplyText.length}/{MAX_REPLY_LENGTH}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color={COLORS.node.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={COLORS.node.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color={COLORS.node.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.node.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={styles.keyboardView}
      >
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderPostHeader}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />

        {/* Comment input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Post your reply..."
            placeholderTextColor={COLORS.node.muted}
            value={replyText}
            onChangeText={setReplyText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !replyText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendComment}
            disabled={!replyText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Reply</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {renderReplyModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.bg,
  },
  centerLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.node.panel,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.node.text,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  keyboardView: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  // Post styles
  postContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  postCard: {
    backgroundColor: COLORS.node.panel,
    padding: 16,
  },
  postAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  postAvatarTouchable: {},
  postAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  postAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.node.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  postAvatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  postAuthorInfo: {
    marginLeft: 12,
  },
  postAuthorName: {
    fontWeight: "700",
    fontSize: 16,
    color: COLORS.node.text,
  },
  postNode: {
    fontSize: 13,
    color: COLORS.node.muted,
    marginTop: 2,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.node.text,
    marginBottom: 8,
  },
  postContent: {
    fontSize: 17,
    color: COLORS.node.text,
    lineHeight: 24,
  },
  // Media styles
  postMediaContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postMediaImage: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: COLORS.node.bg,
  },
  youtubeContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignSelf: 'center',
  },
  videoPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: COLORS.node.bg,
    overflow: 'hidden',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.node.panel,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  videoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  linkPreview: {
    backgroundColor: COLORS.node.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    overflow: 'hidden',
  },
  linkPreviewImage: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.node.panel,
  },
  linkPreviewContent: {
    padding: 12,
  },
  linkPreviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.node.text,
    marginBottom: 4,
  },
  linkPreviewDescription: {
    fontSize: 13,
    color: COLORS.node.muted,
    marginBottom: 6,
    lineHeight: 18,
  },
  linkPreviewDomain: {
    fontSize: 12,
    color: COLORS.node.accent,
  },
  plainLink: {
    backgroundColor: COLORS.node.bg,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  plainLinkText: {
    fontSize: 14,
    color: COLORS.node.accent,
  },
  postTimestamp: {
    fontSize: 14,
    color: COLORS.node.muted,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
  },
  postStats: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    gap: 16,
  },
  postStatText: {
    fontSize: 14,
    color: COLORS.node.muted,
  },
  postStatNumber: {
    fontWeight: "700",
    color: COLORS.node.text,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    gap: 8,
  },
  postActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.node.bg,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: COLORS.node.muted,
  },
  // Comment styles - Bluesky flat style with connecting lines
  commentWrapper: {
    position: 'relative',
    backgroundColor: COLORS.node.panel,
  },
  connectingLineTop: {
    position: 'absolute',
    left: 35, // Center of avatar (16 padding + 20 half of 40px avatar - 1 for line width)
    top: 0,
    width: 2,
    height: 8, // Connects to top of avatar
    backgroundColor: COLORS.node.border,
  },
  commentCard: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  avatarColumn: {
    alignItems: 'center',
    width: 40,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    zIndex: 1,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.node.accent,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  connectingLineDown: {
    position: 'absolute',
    left: 35, // Same as connectingLineTop (16 padding + 20 half of avatar - 1)
    top: 48, // Below avatar (8 padding + 40 avatar)
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.node.border,
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  commentAuthor: {
    fontWeight: "700",
    fontSize: 15,
    color: COLORS.node.text,
  },
  commentDot: {
    color: COLORS.node.muted,
    fontSize: 15,
  },
  commentTime: {
    fontSize: 14,
    color: COLORS.node.muted,
  },
  commentText: {
    fontSize: 15,
    color: COLORS.node.text,
    lineHeight: 21,
  },
  commentActions: {
    flexDirection: "row",
    marginTop: 12,
    gap: 16,
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    gap: 4,
  },
  actionCount: {
    fontSize: 13,
    color: COLORS.node.muted,
  },
  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.node.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
    padding: 12,
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorBannerText: {
    color: "#EF4444",
    fontSize: 14,
    flex: 1,
  },
  errorBannerRetry: {
    color: COLORS.node.accent,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.node.muted,
    textAlign: "center",
  },
  // Input styles
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.node.panel,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.node.bg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.node.text,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: COLORS.node.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  // Reply Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.node.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    backgroundColor: COLORS.node.panel,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  modalPostButton: {
    backgroundColor: COLORS.node.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalPostButtonDisabled: {
    opacity: 0.5,
  },
  modalPostButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  replyingToContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
  },
  replyingToLine: {
    width: 2,
    backgroundColor: COLORS.node.border,
    marginLeft: 19, // Center under avatar
    marginRight: 19,
  },
  replyingToContent: {
    flex: 1,
  },
  replyingToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyingToAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  replyingToAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.node.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  replyingToAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  replyingToAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  replyingToTime: {
    fontSize: 13,
    color: COLORS.node.muted,
  },
  replyingToText: {
    fontSize: 14,
    color: COLORS.node.muted,
    lineHeight: 20,
  },
  modalInputContainer: {
    flex: 1,
    padding: 16,
  },
  modalInput: {
    flex: 1,
    fontSize: 17,
    color: COLORS.node.text,
    textAlignVertical: 'top',
    minHeight: 120,
  },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
    backgroundColor: COLORS.node.panel,
  },
  modalToolbarIcons: {
    flexDirection: 'row',
    gap: 20,
  },
  toolbarIcon: {
    padding: 4,
  },
  charCounter: {
    fontSize: 14,
    color: COLORS.node.muted,
  },
  charCounterWarning: {
    color: '#f59e0b',
  },
  charCounterError: {
    color: '#ef4444',
  },
});
