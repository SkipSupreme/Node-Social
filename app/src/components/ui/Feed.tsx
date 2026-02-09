import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, FlatList, Dimensions, Platform, Modal, TextInput, Share, Linking, ActivityIndicator, StatusBar, RefreshControl, NativeSyntheticEvent, NativeScrollEvent, TextStyle, StyleProp, ViewStyle, GestureResponderEvent, ViewProps } from 'react-native';
import { MessageSquare, Share2, Zap, Bookmark, CornerDownRight, Minus, MoreHorizontal, Shield, ChevronDown, Hexagon, X, Ban, BellOff, Edit2, Trash2, Flag, Link2, RefreshCw } from './Icons';
import { Play } from 'lucide-react-native';
import { ERAS, SCOPE_COLORS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';
import { createPostReaction, savePost, muteUser, blockUser, createComment, votePoll, api, deletePost, editPost, reportContent, ReportReason, SearchUser, ExternalPost, AuthResponse, TipTapDoc, externalLike, externalUnlike, externalRepost, externalUnrepost, externalReply } from '../../lib/api';
import { ExternalPostCard } from './ExternalPostCard';
import { useLinkedAccountsStore } from '../../store/linkedAccounts';
import { showToast } from '../../lib/alert';

type CurrentUser = AuthResponse['user'];
import { VibeRadialWheel } from '../VibeRadialWheel';
import { VibeBar, VibeAggregateData } from '../VibeBar';
import { useSocket } from '../../context/SocketContext';
import { useAuthPrompt } from '../../context/AuthPromptContext';
import { TipTapContent } from './TipTapContent';
// Only import YouTube player on native platforms
const YoutubePlayer = Platform.OS !== 'web' ? require('react-native-youtube-iframe').default : null;
// Import expo-av for video playback (native only)
const Video = Platform.OS !== 'web' ? require('expo-av').Video : null;
const ResizeMode = Platform.OS !== 'web' ? require('expo-av').ResizeMode : null;

// Auto-sizing image component that maintains aspect ratio
const AutoSizeImage = memo(({ uri, maxHeight = 400 }: { uri: string; maxHeight?: number }) => {
    const [aspectRatio, setAspectRatio] = useState(16 / 9); // Default aspect ratio

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
                styles.postImage,
                {
                    aspectRatio,
                    height: undefined, // Let aspectRatio control height
                    maxHeight,
                }
            ]}
            resizeMode="contain"
        />
    );
});

// Zoomable image component - wraps image in TouchableOpacity to open modal
const ZoomableImage = memo(({ uri, maxHeight = 500 }: { uri: string; maxHeight?: number }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [aspectRatio, setAspectRatio] = useState(16 / 9);
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const openModal = useCallback(() => setModalVisible(true), []);
    const closeModal = useCallback(() => setModalVisible(false), []);

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

    const modalImageStyle = useMemo(() => ({
        width: screenWidth,
        height: screenWidth / aspectRatio,
        maxHeight: screenHeight * 0.85,
    }), [screenWidth, screenHeight, aspectRatio]);

    return (
        <>
            <TouchableOpacity onPress={openModal} activeOpacity={0.9}>
                <Image
                    source={{ uri }}
                    style={[
                        styles.postImage,
                        {
                            aspectRatio,
                            height: undefined,
                            maxHeight,
                        }
                    ]}
                    resizeMode="contain"
                />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeModal}
                statusBarTranslucent
            >
                <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
                <View style={styles.imageZoomModal}>
                    <TouchableOpacity
                        style={styles.imageZoomClose}
                        onPress={closeModal}
                    >
                        <X size={28} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.imageZoomContainer}
                        onPress={closeModal}
                    >
                        <Image
                            source={{ uri }}
                            style={modalImageStyle}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>
            </Modal>
        </>
    );
});

// Image Gallery component - displays multiple images in a horizontal scrollable carousel
const ImageGallery = memo(({ urls, maxHeight = 400 }: { urls: string[]; maxHeight?: number }) => {
    const theme = useAppTheme();
    const counterStyle = useMemo(() => [galleryStyles.counter, { color: theme.muted }], [theme.muted]);
    const [activeIndex, setActiveIndex] = useState(0);
    const screenWidth = Dimensions.get('window').width;
    const imageWidth = useMemo(() => Math.min(screenWidth - 32, 600), [screenWidth]);

    const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / imageWidth);
        setActiveIndex(index);
    }, [imageWidth]);

    const scrollViewStyle = useMemo(() => ({ width: imageWidth }), [imageWidth]);
    const imageContainerStyle = useMemo(() => ({ width: imageWidth }), [imageWidth]);

    if (urls.length === 0) return null;

    // For single images, just show the zoomable image
    if (urls.length === 1) {
        return <ZoomableImage uri={urls[0]!} maxHeight={maxHeight} />;
    }

    return (
        <View>
            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScrollEnd}
                style={scrollViewStyle}
            >
                {urls.map((url, index) => (
                    <View key={url} style={imageContainerStyle}>
                        <ZoomableImage uri={url} maxHeight={maxHeight} />
                    </View>
                ))}
            </ScrollView>
            {/* Page indicator dots */}
            <View style={galleryStyles.dotsContainer}>
                {urls.map((url, index) => (
                    <View
                        key={url}
                        style={[
                            galleryStyles.dot,
                            { backgroundColor: index === activeIndex ? theme.accent : 'rgba(255,255,255,0.3)' }
                        ]}
                    />
                ))}
            </View>
            {/* Image counter */}
            <Text style={counterStyle}>
                {activeIndex + 1} / {urls.length}
            </Text>
        </View>
    );
});

// Styles for ImageGallery (outside component to avoid recreation)
const galleryStyles = StyleSheet.create({
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 8,
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    counter: {
        textAlign: 'center',
        fontSize: 12,
        marginTop: 4,
    },
});

// Reddit Video Player component - handles v.redd.it URLs
const RedditVideoPlayer = ({ url }: { url: string }) => {
    const theme = useAppTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const videoRef = useRef<any>(null);
    const screenWidth = Dimensions.get('window').width;
    const playerWidth = Math.min(screenWidth - 32, 600);
    const playerHeight = playerWidth * (9 / 16);

    // Reddit videos need their HLS/DASH URL resolved
    useEffect(() => {
        const resolveRedditVideo = async () => {
            try {
                // v.redd.it URLs need to be fetched to get the actual video URL
                // Try the DASH playlist first, fallback to direct mp4
                const videoId = url.match(/v\.redd\.it\/([a-zA-Z0-9]+)/)?.[1];
                if (videoId) {
                    // Try HLS playlist (most reliable for mobile)
                    const hlsUrl = `https://v.redd.it/${videoId}/HLSPlaylist.m3u8`;
                    setVideoUrl(hlsUrl);
                } else {
                    setVideoUrl(url);
                }
                setLoading(false);
            } catch (err) {
                console.error('Failed to resolve Reddit video:', err);
                setError(true);
                setLoading(false);
            }
        };
        resolveRedditVideo();
    }, [url]);

    // Web - Reddit videos require auth so we show a "Watch on Reddit" button
    // Reddit's DASH URLs return 403 when accessed directly from browser
    // Opening the v.redd.it URL directly will redirect to the Reddit post
    if (Platform.OS === 'web') {
        return (
            <TouchableOpacity
                style={[styles.videoPreview, { width: playerWidth, height: playerHeight }]}
                onPress={() => Linking.openURL(url)}
            >
                <View style={[styles.videoPlaceholder, { backgroundColor: '#1a1a2e' }]} />
                <View style={styles.playButtonOverlay}>
                    <View style={[styles.playButton, { backgroundColor: 'rgba(255, 69, 0, 0.9)' }]}>
                        <Play size={32} color="#fff" fill="#fff" />
                    </View>
                </View>
                <View style={styles.videoLabel}>
                    <Text style={styles.videoLabelText}>Watch on Reddit</Text>
                </View>
            </TouchableOpacity>
        );
    }

    if (loading) {
        return (
            <View style={[styles.videoPreview, { width: playerWidth, height: playerHeight, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    if (error || !videoUrl || !Video) {
        return (
            <TouchableOpacity
                style={[styles.videoPreview, { width: playerWidth, height: playerHeight }]}
                onPress={() => Linking.openURL(url)}
            >
                <View style={styles.videoPlaceholder} />
                <View style={styles.playButtonOverlay}>
                    <View style={styles.playButton}>
                        <Play size={32} color="#fff" fill="#fff" />
                    </View>
                </View>
                <View style={styles.videoLabel}>
                    <Text style={styles.videoLabelText}>Open on Reddit</Text>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View style={[styles.videoContainer, { width: playerWidth, height: playerHeight }]}>
            <Video
                ref={videoRef}
                source={{ uri: videoUrl }}
                style={{ width: playerWidth, height: playerHeight, borderRadius: 12 }}
                useNativeControls
                resizeMode={ResizeMode?.CONTAIN || 'contain'}
                isLooping
                shouldPlay={false}
                onError={(err: unknown) => {
                    console.error('Video playback error:', err);
                    setError(true);
                }}
            />
        </View>
    );
};

// Generic Video Player for direct mp4/webm URLs
const GenericVideoPlayer = ({ url }: { url: string }) => {
    const videoRef = useRef<any>(null);
    const screenWidth = Dimensions.get('window').width;
    const playerWidth = Math.min(screenWidth - 32, 600);
    const playerHeight = playerWidth * (9 / 16);

    // Web fallback
    if (Platform.OS === 'web') {
        return (
            <View style={[styles.videoContainer, { width: playerWidth, height: playerHeight }]}>
                <video
                    src={url}
                    controls
                    style={{ width: playerWidth, height: playerHeight, borderRadius: 12 }}
                />
            </View>
        );
    }

    if (!Video) {
        return (
            <TouchableOpacity
                style={[styles.videoPreview, { width: playerWidth, height: playerHeight }]}
                onPress={() => Linking.openURL(url)}
            >
                <View style={styles.videoPlaceholder} />
                <View style={styles.playButtonOverlay}>
                    <View style={styles.playButton}>
                        <Play size={32} color="#fff" fill="#fff" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View style={[styles.videoContainer, { width: playerWidth, height: playerHeight }]}>
            <Video
                ref={videoRef}
                source={{ uri: url }}
                style={{ width: playerWidth, height: playerHeight, borderRadius: 12 }}
                useNativeControls
                resizeMode={ResizeMode?.CONTAIN || 'contain'}
                isLooping
                shouldPlay={false}
            />
        </View>
    );
};

// Helper to check if URL is a Reddit video
const isRedditVideo = (url: string): boolean => {
    return /v\.redd\.it\//i.test(url);
};

// Helper to check if URL is a direct video file
const isDirectVideoUrl = (url: string): boolean => {
    return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
};

// Helper to detect video URLs
const isVideoUrl = (url: string): boolean => {
    const videoPatterns = [
        /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i,
        /youtube\.com\/watch\?v=/i,
        /youtu\.be\//i,
        /vimeo\.com\//i,
        /v\.redd\.it\//i,  // Reddit hosted videos
        /imgur\.com\/.*\.gifv/i,  // Imgur gifv
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
    const playerWidth = Math.min(screenWidth - 32, 600); // Max 600px, account for padding
    const playerHeight = playerWidth * (9 / 16); // 16:9 aspect ratio

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

// Helper to extract clean domain from URL (e.g., "techcrunch.com" from "https://techcrunch.com/2025/...")
const getDomain = (url: string): string => {
    try {
        const hostname = new URL(url).hostname;
        // Remove 'www.' prefix for cleaner display
        return hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

// Helper to check if URL is an image
const isImageUrl = (url: string): boolean => {
    if (!url) return false;
    // Direct image extensions
    if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) return true;
    // Reddit image hosting
    if (/i\.redd\.it\//i.test(url)) return true;
    // Imgur direct images
    if (/i\.imgur\.com\//i.test(url) && !/\.gifv/i.test(url)) return true;
    // Preview.redd.it images (Reddit's preview server)
    if (/preview\.redd\.it\//i.test(url)) return true;
    // External preview URLs (often have format=jpg or similar)
    if (/external-preview\.redd\.it\//i.test(url)) return true;
    // Bluesky CDN images (uses @jpeg/@png format instead of .jpeg/.png)
    if (/cdn\.bsky\.app\/img\//i.test(url)) return true;
    return false;
};

// Formatted content component - handles headers, bold, italic, and cleans up line breaks
interface FormattedContentProps {
    content: string;
    style?: StyleProp<ViewStyle>;
}

const FormattedContent = ({ content, style }: FormattedContentProps) => {
    const theme = useAppTheme();

    // Memoize themed style overrides to avoid per-render allocations on web
    const ts = useMemo(() => ({
        linkStyle: { color: theme.accent, textDecorationLine: 'underline' as const } as TextStyle,
        textColor: theme.text,
        mutedColor: theme.muted,
    }), [theme]);

    // Clean up excessive line breaks and normalize whitespace
    const cleanContent = content
        // Normalize line endings
        .replace(/\r\n/g, '\n')
        // Remove excessive blank lines (more than 2 newlines -> 2 newlines)
        .replace(/\n{3,}/g, '\n\n')
        // Remove trailing spaces on each line
        .replace(/[ \t]+\n/g, '\n')
        // Clean up lines that are just whitespace
        .replace(/\n[ \t]+\n/g, '\n\n')
        .trim();

    // Split into paragraphs/blocks
    const blocks = cleanContent.split(/\n\n+/);

    const renderTextWithFormatting = (text: string, baseStyle: TextStyle) => {
        // Parse inline formatting: **bold**, *italic*, `code`, [text](url)
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let key = 0;

        while (remaining.length > 0) {
            // Check for markdown links [text](url) - render as clickable link
            const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                const linkText = linkMatch[1];
                const linkUrl = linkMatch[2];
                parts.push(
                    <Text
                        key={key++}
                        style={[baseStyle, ts.linkStyle]}
                        onPress={() => Linking.openURL(linkUrl)}
                    >
                        {linkText}
                    </Text>
                );
                remaining = remaining.slice(linkMatch[0].length);
                continue;
            }

            // Check for bold **text**
            const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
            if (boldMatch) {
                parts.push(
                    <Text key={key++} style={[baseStyle, { fontWeight: '700' }]}>
                        {boldMatch[1]}
                    </Text>
                );
                remaining = remaining.slice(boldMatch[0].length);
                continue;
            }

            // Check for italic *text* (but not **)
            const italicMatch = remaining.match(/^\*([^*]+?)\*/);
            if (italicMatch) {
                parts.push(
                    <Text key={key++} style={[baseStyle, { fontStyle: 'italic' }]}>
                        {italicMatch[1]}
                    </Text>
                );
                remaining = remaining.slice(italicMatch[0].length);
                continue;
            }

            // Check for inline code `code`
            const codeMatch = remaining.match(/^`([^`]+?)`/);
            if (codeMatch) {
                parts.push(
                    <Text key={key++} style={[baseStyle, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4 }]}>
                        {codeMatch[1]}
                    </Text>
                );
                remaining = remaining.slice(codeMatch[0].length);
                continue;
            }

            // Find next special character or take the rest
            const nextSpecial = remaining.search(/\[|\*|`/);
            if (nextSpecial === -1) {
                parts.push(<Text key={key++} style={baseStyle}>{remaining}</Text>);
                break;
            } else if (nextSpecial === 0) {
                // Special char that didn't match patterns, treat as literal
                parts.push(<Text key={key++} style={baseStyle}>{remaining[0]}</Text>);
                remaining = remaining.slice(1);
            } else {
                parts.push(<Text key={key++} style={baseStyle}>{remaining.slice(0, nextSpecial)}</Text>);
                remaining = remaining.slice(nextSpecial);
            }
        }

        return parts.length === 1 ? parts[0] : <Text style={baseStyle}>{parts}</Text>;
    };

    return (
        <View style={style}>
            {blocks.map((block, index) => {
                const trimmedBlock = block.trim();

                // Check for headers (# Header, ## Subheader, etc.)
                const headerMatch = trimmedBlock.match(/^(#{1,6})\s+(.+)$/);
                if (headerMatch) {
                    const level = headerMatch[1].length;
                    const headerText = headerMatch[2];
                    const headerStyles: { [key: number]: TextStyle } = {
                        1: { fontSize: 20, fontWeight: '700', color: ts.textColor, marginTop: index > 0 ? 16 : 0, marginBottom: 8 },
                        2: { fontSize: 18, fontWeight: '700', color: ts.textColor, marginTop: index > 0 ? 14 : 0, marginBottom: 6 },
                        3: { fontSize: 16, fontWeight: '600', color: ts.textColor, marginTop: index > 0 ? 12 : 0, marginBottom: 4 },
                        4: { fontSize: 15, fontWeight: '600', color: ts.mutedColor, marginTop: index > 0 ? 10 : 0, marginBottom: 4 },
                        5: { fontSize: 14, fontWeight: '600', color: ts.mutedColor, marginTop: index > 0 ? 8 : 0, marginBottom: 2 },
                        6: { fontSize: 13, fontWeight: '600', color: ts.mutedColor, marginTop: index > 0 ? 6 : 0, marginBottom: 2 },
                    };
                    return (
                        <Text key={index} style={headerStyles[level]}>
                            {headerText}
                        </Text>
                    );
                }

                // Check for bullet points
                if (trimmedBlock.match(/^[-*•]\s/)) {
                    const lines = trimmedBlock.split('\n');
                    return (
                        <View key={index} style={{ marginTop: index > 0 ? 8 : 0 }}>
                            {lines.map((line, lineIndex) => {
                                const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
                                if (bulletMatch) {
                                    return (
                                        <View key={lineIndex} style={{ flexDirection: 'row', marginBottom: 4 }}>
                                            <Text style={[styles.bodyText, { marginRight: 8 }]}>•</Text>
                                            <Text style={[styles.bodyText, { flex: 1 }]}>
                                                {renderTextWithFormatting(bulletMatch[1], styles.bodyText)}
                                            </Text>
                                        </View>
                                    );
                                }
                                return (
                                    <Text key={lineIndex} style={styles.bodyText}>
                                        {renderTextWithFormatting(line, styles.bodyText)}
                                    </Text>
                                );
                            })}
                        </View>
                    );
                }

                // Regular paragraph - join lines with spaces to avoid hard wraps
                const paragraphText = trimmedBlock.replace(/\n/g, ' ').replace(/\s+/g, ' ');
                return (
                    <Text key={index} style={[styles.bodyText, { marginTop: index > 0 ? 12 : 0 }]}>
                        {renderTextWithFormatting(paragraphText, styles.bodyText)}
                    </Text>
                );
            })}
        </View>
    );
};

export interface UIAuthor {
    id: string;
    username: string;
    avatar: string;
    era: string;
    cred: number;
}

export interface UIComment {
    id: string;
    author: UIAuthor;
    content: string;
    timestamp: Date;
    depth: number;
    replies?: UIComment[];
    myReaction?: { [key: string]: number } | null;
}

function timeAgo(date: Date | string) {
    if (!date) return 'Just now';
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();

    // Handle future dates (clock skew) or very small diffs
    if (diffMs < 0) return 'Just now';
    if (diffMs < 1000) return 'Just now';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 7) return past.toLocaleDateString();
    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHour > 0) return `${diffHour}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return `${diffSec}s ago`;
}

export interface UIPost {
    id: string;
    node: { id?: string; name: string; color?: string };
    author: UIAuthor;
    title: string;
    content?: string | null; // Optional for poll-only or link-only posts
    contentJson?: TipTapDoc | null; // TipTap JSON content
    contentFormat?: 'markdown' | 'tiptap'; // Content format type
    createdAt: string | Date;
    commentCount: number;
    expertGated?: boolean;
    vibes?: string[];
    comments?: UIComment[];
    poll?: {
        id: string;
        question: string;
        options: { id: string; text: string; _count?: { votes: number } }[];
        votes?: { optionId: string }[];
    };
    myReaction?: { [key: string]: number } | null;
    vibeAggregate?: VibeAggregateData | null;
    linkUrl?: string | null;
    mediaUrl?: string | null; // Direct image/video URL from Reddit etc.
    galleryUrls?: string[]; // For Reddit galleries and multi-image posts
    linkMeta?: {
        id: string;
        url: string;
        title?: string | null;
        description?: string | null;
        image?: string | null;
        domain?: string | null;
    } | null;
    isSaved?: boolean;
}

interface CommentNodeProps {
    comment: UIComment;
    isLast?: boolean;
    isFirst?: boolean;
    onReply?: (comment: UIComment) => void;
    globalNodeId?: string;
    onAuthorClick?: (authorId: string) => void;
}

const CommentNode = ({ comment, isLast = false, isFirst = false, onReply, globalNodeId, onAuthorClick }: CommentNodeProps) => {
    const theme = useAppTheme();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const incomingColor = SCOPE_COLORS[(comment.depth - 1) % SCOPE_COLORS.length];
    const connectorColor = SCOPE_COLORS[comment.depth % SCOPE_COLORS.length];
    const eraStyle = ERAS[comment.author.era] || ERAS['Default'];

    // Memoize themed style overrides — CommentNode is recursive, so this prevents
    // O(n) inline object allocations across the comment tree.
    const ts = useMemo(() => StyleSheet.create({
        avatarSmall: { borderColor: theme.border, backgroundColor: theme.panel },
        accentBgCenter: { backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center' },
        textColor: { color: theme.text },
        mutedColor: { color: theme.muted },
        badgeBg: { backgroundColor: theme.border },
    }), [theme]);


    const lastChildHeight = isFirst ? 14 : 10;

    return (
        <View style={styles.commentWrapper}>

            {/* Child Connectors */}
            {comment.depth > 0 && (
                <>
                    <View style={[styles.connectorElbow, { borderColor: incomingColor }]} />
                    <View style={[
                        styles.connectorSpine,
                        {
                            backgroundColor: incomingColor,
                            top: isFirst ? -3 : -5,
                            height: isLast ? lastChildHeight : '100%',
                            bottom: isLast ? undefined : -5
                        }
                    ]} />
                </>
            )}

            {/* Content Container */}
            <View style={styles.commentInner}>
                {/* Bridge line connecting to replies */}
                {!isCollapsed && comment.replies && comment.replies.length > 0 && (
                    <View style={[styles.bridgeLine, { backgroundColor: connectorColor }]} />
                )}

                {/* Header */}
                <View style={styles.headerRow}>
                    <TouchableOpacity style={[styles.avatarSmallContainer, ts.avatarSmall]} onPress={() => onAuthorClick?.(comment.author.id)}>
                        {comment.author.avatar ? (
                            <Image source={{ uri: comment.author.avatar }} style={styles.avatarImage} />
                        ) : (
                            <View style={[styles.avatarImage, ts.accentBgCenter]}>
                                <Text style={styles.avatarInitialSmallWhite}>
                                    {comment.author.username?.[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.userInfoRow}>
                        <TouchableOpacity onPress={() => onAuthorClick?.(comment.author.id)}>
                            <Text style={[styles.usernameSmall, ts.textColor]}>{comment.author.username}</Text>
                        </TouchableOpacity>

                        <View style={[styles.badge, ts.badgeBg]}>
                            <Text style={[styles.badgeText, ts.textColor]}>{comment.author.cred} Cred</Text>
                        </View>

                        <View style={[styles.badge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border, borderWidth: 1 }]}>
                            <Text style={[styles.badgeText, { color: eraStyle.text }]}>{comment.author.era}</Text>
                        </View>

                        <Text style={[styles.timestamp, ts.mutedColor]}>{timeAgo(comment.timestamp)}</Text>

                        <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.collapseBtn}>
                            {isCollapsed ? <CornerDownRight size={12} color={theme.muted} /> : <Minus size={12} color={theme.muted} />}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Body */}
                {!isCollapsed && (
                    <View style={styles.commentBody}>
                        <Text style={styles.commentText}>{comment.content}</Text>

                        <View style={styles.actionRow}>
                            <VibeRadialWheel
                                key={`${comment.id}-${comment.myReaction ? 'reacted' : 'none'}`}
                                contentId={comment.id}
                                nodeId={globalNodeId}
                                initialReaction={comment.myReaction}
                                buttonLabel=""
                                compact={true}
                                contentType="comment"
                            />
                            <TouchableOpacity style={styles.actionBtnText} onPress={() => onReply && onReply(comment)}>
                                <Text style={[styles.actionLabel, ts.mutedColor]}>Reply</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Replies */}
            {!isCollapsed && comment.replies && comment.replies.length > 0 && (
                <View style={styles.repliesContainer}>
                    {comment.replies.map((reply, idx) => (
                        <CommentNode
                            key={reply.id}
                            comment={reply}
                            isFirst={idx === 0}
                            isLast={idx === (comment.replies?.length || 0) - 1}
                            onReply={onReply}
                            globalNodeId={globalNodeId}
                            onAuthorClick={onAuthorClick}
                        />
                    ))}
                </View>
            )}

        </View>
    );
};

interface PostCardProps {
    post: UIPost;
    currentUser?: CurrentUser | null;
    onPostAction?: (postId: string, action: 'mute' | 'block' | 'delete') => void;
    onVibeCheck?: (post: UIPost) => void;
    onPress?: (post: UIPost) => void;
    onEdit?: (post: UIPost) => void;
    onAuthorClick?: (authorId: string) => void;
    onSaveToggle?: (postId: string, saved: boolean) => void;
    globalNodeId?: string;
}

const PostCardInner = ({ post: initialPost, currentUser, onPostAction, onVibeCheck, onPress, onEdit, onAuthorClick, onSaveToggle, globalNodeId }: PostCardProps) => {
    const theme = useAppTheme();
    const { requireAuth } = useAuthPrompt();
    const [post, setPost] = useState(initialPost);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [isSaved, setIsSaved] = useState(initialPost.isSaved ?? false);
    const [commentText, setCommentText] = useState('');
    const [replyingTo, setReplyingTo] = useState<UIComment | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const eraStyle = ERAS[post.author.era] || ERAS['Default'];

    // Pre-compute themed style overrides — stable identity unless theme changes.
    // On mobile web, React Native Web re-hashes inline style objects every render;
    // memoizing avoids ~60 fresh allocations per PostCard mount/render.
    const ts = useMemo(() => StyleSheet.create({
        card: { backgroundColor: theme.panel, borderColor: theme.border },
        avatarBorder: { borderColor: theme.accent },
        accentBgCenter: { backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center' },
        textColor: { color: theme.text },
        mutedColor: { color: theme.muted },
        accentColor: { color: theme.accent },
        badgeBg: { backgroundColor: theme.border },
        linkPreview: { backgroundColor: theme.bg, borderColor: theme.border },
        linkPreviewImage: { backgroundColor: theme.panel },
        pollContainer: { backgroundColor: theme.panel, borderColor: theme.border },
        pollOption: { backgroundColor: theme.bg, borderColor: theme.border },
        pollOptionSelected: { borderColor: theme.accent },
        pillBtn: { backgroundColor: theme.panel, borderColor: theme.border },
        pillBtnActive: { borderColor: theme.accent, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
        commentsSection: { borderTopColor: theme.border },
        sortChip: { backgroundColor: theme.bg, borderColor: theme.border },
        sortChipSelected: { borderColor: theme.accent },
        avatarSmall: { borderColor: theme.border, backgroundColor: theme.panel },
        commentInput: { backgroundColor: theme.bg, borderColor: theme.border },
        menuContainer: { backgroundColor: theme.panel, borderColor: theme.border },
        reportMenu: { backgroundColor: theme.panel, borderColor: theme.border, maxWidth: 350 },
        reportOption: { backgroundColor: theme.bg },
        continueReading: { color: theme.accent, fontSize: 12, fontWeight: '700' },
        replyingTo: { color: theme.muted, fontSize: 12 },
        pillTextHidden: { color: theme.muted, display: 'none' as const },
    }), [theme]);

    // Check if current user is the author
    const isOwnPost = currentUser?.id === post.author.id;

    const [localPoll, setLocalPoll] = useState(post.poll);
    const [localComments, setLocalComments] = useState<UIComment[]>(post.comments || []);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    const [commentSort, setCommentSort] = useState<string>('newest');

    // Sync local state when initialPost prop changes (e.g., from socket updates or refetch)
    useEffect(() => {
        setPost(initialPost);
        setLocalPoll(initialPost.poll);
        setLocalComments(initialPost.comments || []);
        setIsSaved(initialPost.isSaved ?? false);
    }, [initialPost]);

    const fetchComments = async () => {
        // if (commentsLoaded) return; // Allow reload if sort changes
        try {
            interface ApiComment {
                id: string;
                author: { id: string; username?: string; avatar?: string; era?: string; cred?: number };
                content: string;
                createdAt: string;
                parentId?: string | null;
                myReaction?: { [key: string]: number } | null;
            }
            const res = await api.get<ApiComment[]>(`/posts/${post.id}/comments?all=true&limit=100&sortBy=${commentSort}`);

            // Build Tree
            const commentMap = new Map();
            const roots: UIComment[] = [];

            // First pass: create nodes
            res.forEach((c: ApiComment) => {
                commentMap.set(c.id, {
                    id: c.id,
                    author: {
                        id: c.author.id,
                        username: c.author.username || 'User',
                        avatar: c.author.avatar,
                        era: c.author.era || 'Lurker Era',
                        cred: c.author.cred || 0
                    },
                    content: c.content,
                    timestamp: new Date(c.createdAt),
                    depth: 0,
                    replies: [],
                    parentId: c.parentId,
                    myReaction: c.myReaction || null
                });
            });

            // Second pass: link children to parents (don't set depth yet)
            commentMap.forEach(node => {
                if (node.parentId && commentMap.has(node.parentId)) {
                    const parent = commentMap.get(node.parentId);
                    parent.replies.push(node);
                } else {
                    roots.push(node);
                }
            });

            // Third pass: recursively calculate correct depths
            const setDepths = (nodes: UIComment[], depth: number) => {
                nodes.forEach(node => {
                    node.depth = depth;
                    if (node.replies && node.replies.length > 0) {
                        setDepths(node.replies, depth + 1);
                    }
                });
            };
            setDepths(roots, 0);

            // Sort by timestamp ONLY if sort is newest
            const sortComments = (nodes: UIComment[]) => {
                if (commentSort === 'newest') {
                    nodes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                }
                // If not newest, rely on API order (which is by score)
                // But we still need to recurse
                nodes.forEach(n => {
                    if (n.replies && n.replies.length > 0) sortComments(n.replies);
                });
            };
            sortComments(roots);

            setLocalComments(roots);
            setCommentsLoaded(true);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        }
    };

    // Fetch comments when showComments becomes true or sort changes
    React.useEffect(() => {
        if (showComments) {
            fetchComments();
        }
    }, [showComments, commentSort]);

    // Sync localPoll with post.poll when it changes (e.g. on refresh)
    React.useEffect(() => {
        setLocalPoll(post.poll);
    }, [post.poll]);

    // Socket.io Real-time Updates
    const { subscribeToPost } = useSocket();
    React.useEffect(() => {
        // Subscribe to updates for this post via context
        const unsubscribe = subscribeToPost(post.id, (data) => {
            // Update local post state with new metrics/aggregates
            if (data.metrics) {
                // Update engagement score or other metrics if we displayed them
            }
            if (data.vibeAggregate) {
                // Real-time vibe aggregate updates - update live counts
                setPost(prev => ({
                    ...prev,
                    vibeAggregate: data.vibeAggregate as VibeAggregateData
                }));
            }
        });

        return () => {
            unsubscribe?.();
        };
    }, [post.id]); // subscribeToPost is stable (uses refs internally)

    // Don't render if deleted (after all hooks)
    if (isDeleted) return null;

    const handleVote = async (optionId: string) => {
        if (!localPoll) return;
        // Require auth to vote
        if (!requireAuth('Sign in to vote on polls')) return;

        // Check if already voted (any option)
        // We check both the optimistic local state AND the original post state to be safe
        const hasVotedLocally = localPoll.votes && localPoll.votes.length > 0;
        if (hasVotedLocally) return;

        // Save previous state for revert (deep copy)
        const previousPoll = {
            ...localPoll,
            options: localPoll.options.map(opt => ({
                ...opt,
                _count: opt._count ? { ...opt._count } : undefined
            })),
            votes: [...(localPoll.votes || [])]
        };

        // Deep copy for optimistic update
        const newPoll = {
            ...localPoll,
            options: localPoll.options.map(opt => ({
                ...opt,
                _count: opt._count ? { ...opt._count } : undefined
            })),
            votes: [...(localPoll.votes || [])]
        };
        const optionIndex = newPoll.options.findIndex(o => o.id === optionId);
        if (optionIndex === -1) return;

        // Update counts
        newPoll.options[optionIndex]._count = { votes: (newPoll.options[optionIndex]._count?.votes || 0) + 1 };
        newPoll.votes = [{ optionId }]; // Set user's vote
        setLocalPoll(newPoll);

        try {
            await votePoll(post.id, optionId);
        } catch (error) {
            console.error('Failed to vote:', error);
            // Revert to previous localPoll state (not post.poll which could be stale)
            setLocalPoll(previousPoll);
        }
    };

    const totalVotes = localPoll?.options.reduce((acc, opt) => acc + (opt._count?.votes || 0), 0) || 0;

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this post on NodeSocial: ${post.title}`,
                url: `https://nodesocial.app/post/${post.id}`, // Mock URL
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleSave = async () => {
        // Require auth to save
        if (!requireAuth('Sign in to save posts')) return;

        // Optimistic update - toggle immediately for responsiveness
        const newSavedState = !isSaved;
        setIsSaved(newSavedState);

        try {
            const res = await savePost(post.id);
            // Sync with server response (in case of race conditions)
            setIsSaved(res.saved);
            // Notify parent of save state change
            onSaveToggle?.(post.id, res.saved);
        } catch (error) {
            // Revert on error
            setIsSaved(!newSavedState);
            console.error('Failed to save post:', error);
        }
    };

    const handleMute = async () => {
        if (!requireAuth('Sign in to mute users')) {
            setMenuVisible(false);
            return;
        }
        try {
            await muteUser(post.author.id);
            setMenuVisible(false);
            showToast(`@${post.author.username} muted`, 'success');
            onPostAction && onPostAction(post.id, 'mute');
        } catch (error) {
            console.error('Failed to mute user:', error);
            showToast('Failed to mute user', 'error');
        }
    };

    const handleBlock = async () => {
        if (!requireAuth('Sign in to block users')) {
            setMenuVisible(false);
            return;
        }
        try {
            await blockUser(post.author.id);
            setMenuVisible(false);
            showToast(`@${post.author.username} blocked`, 'success');
            onPostAction && onPostAction(post.id, 'block');
        } catch (error) {
            console.error('Failed to block user:', error);
            showToast('Failed to block user', 'error');
        }
    };

    const handleDelete = async () => {
        try {
            await deletePost(post.id);
            setMenuVisible(false);
            setIsDeleted(true);
            showToast('Post deleted', 'success');
            onPostAction && onPostAction(post.id, 'delete');
        } catch (error) {
            console.error('Failed to delete post:', error);
            showToast('Failed to delete post', 'error');
        }
    };

    const handleEdit = () => {
        setMenuVisible(false);
        onEdit && onEdit(post);
    };

    const handleReport = async (reason: ReportReason) => {
        if (!requireAuth('Sign in to report content')) {
            setShowReportModal(false);
            return;
        }
        setReportSubmitting(true);
        try {
            await reportContent('post', post.id, reason);
            setShowReportModal(false);
            setMenuVisible(false);
            showToast('Report submitted. Thank you!', 'success');
        } catch (error: unknown) {
            console.error('Failed to report post:', error);
            showToast('Failed to submit report', 'error');
        } finally {
            setReportSubmitting(false);
        }
    };

    const handleCopyLink = async () => {
        const postUrl = `https://node-social.com/post/${post.id}`;
        setMenuVisible(false);

        if (Platform.OS === 'web') {
            // Use browser clipboard API on web
            try {
                await navigator.clipboard.writeText(postUrl);
                showToast('Link copied!', 'success');
            } catch (err) {
                // Fallback to Share API
                await Share.share({ message: postUrl });
            }
        } else {
            // On native, use Share API (more useful than just copying)
            await Share.share({
                message: postUrl,
                url: postUrl, // iOS uses this
            });
        }
    };

    const handleSubmitComment = async () => {
        if (!commentText.trim()) return;
        // Require auth to comment
        if (!requireAuth('Sign in to join the conversation')) return;

        setSubmitting(true);
        try {
            const newCommentData = await createComment(post.id, { content: commentText, parentId: replyingTo?.id });

            // Create UIComment object from response
            const newComment: UIComment = {
                id: newCommentData.id,
                author: {
                    id: currentUser?.id || 'temp',
                    username: currentUser?.username || 'You',
                    avatar: currentUser?.avatar || '',
                    era: currentUser?.era || 'Builder Era',
                    cred: currentUser?.cred || 0
                },
                content: newCommentData.content,
                timestamp: new Date(newCommentData.createdAt),
                depth: replyingTo ? replyingTo.depth + 1 : 0,
                replies: []
            };

            // Update local state
            if (replyingTo) {
                // Recursive update to find parent and add reply
                const addReply = (comments: UIComment[]): UIComment[] => {
                    return comments.map(c => {
                        if (c.id === replyingTo.id) {
                            return { ...c, replies: [...(c.replies || []), newComment] };
                        }
                        if (c.replies && c.replies.length > 0) {
                            return { ...c, replies: addReply(c.replies) };
                        }
                        return c;
                    });
                };
                setLocalComments(prev => addReply(prev));
            } else {
                // Top level comment
                setLocalComments(prev => [newComment, ...prev]);
            }

            setCommentText('');
            setReplyingTo(null);

        } catch (error) {
            console.error('Failed to submit comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleExpand = useCallback(() => setIsExpanded(v => !v), []);
    const handleAuthorClick = useCallback(() => onAuthorClick?.(post.author.id), [onAuthorClick, post.author.id]);
    const handlePostPress = useCallback(() => onPress?.(post), [onPress, post]);
    const handleShowMenu = useCallback(() => setMenuVisible(true), []);
    const handleToggleComments = useCallback(() => setShowComments(v => !v), []);
    const handleVibeComplete = useCallback((intensities: Record<string, number>) => {
        setPost(prev => ({
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
        }));
    }, []);
    const handleOpenLink = useCallback(() => {
        if (post.linkUrl) Linking.openURL(post.linkUrl);
    }, [post.linkUrl]);

    // Memoize content height style to avoid inline object creation during render
    const contentHeightStyle = useMemo(() => {
        const isLong = (post.content?.length || 0) > 6000;
        if (!isLong) return undefined;
        return isExpanded ? undefined : { maxHeight: 400, overflow: 'hidden' as const };
    }, [isExpanded, post.content?.length]);

    return (
        <View style={[styles.card, ts.card]}>
            <TouchableOpacity activeOpacity={0.9} style={styles.cardContent} onPress={handleToggleExpand}>

                <View style={styles.postHeader}>
                    <View style={styles.headerAuthorRow}>
                        <TouchableOpacity onPress={handleAuthorClick} style={[styles.avatarContainer, ts.avatarBorder]}>
                            {post.author.avatar ? (
                                <Image source={{ uri: post.author.avatar }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarImage, ts.accentBgCenter]}>
                                    <Text style={styles.avatarInitialWhite}>
                                        {post.author.username?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <View style={styles.flexOne}>
                            <View style={styles.authorBadgeRow}>
                                <TouchableOpacity onPress={handleAuthorClick}>
                                    <Text style={[styles.usernameLarge, ts.textColor]}>{post.author.username}</Text>
                                </TouchableOpacity>
                                <View style={[styles.badge, ts.badgeBg]}>
                                    <Text style={[styles.badgeText, ts.textColor]}>{post.author.cred} Cred</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border, borderWidth: 1 }]}>
                                    <Text style={[styles.badgeText, { color: eraStyle.text }]}>{post.author.era}</Text>
                                </View>
                            </View>
                            <Text style={[styles.subtext, ts.mutedColor]}>{post.node.name} • {timeAgo(post.createdAt)}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={handleShowMenu} style={styles.moreBtn}>
                        <MoreHorizontal size={16} color={theme.muted} />
                    </TouchableOpacity>
                </View>

                <View style={styles.contentPadding}>
                    <TouchableOpacity onPress={handlePostPress} activeOpacity={0.7}>
                        <Text style={styles.title}>
                            {post.expertGated && <Shield size={12} color="#f87171" style={{ marginRight: 4 }} />}
                            {post.title}
                        </Text>
                    </TouchableOpacity>

                    {/* Render content based on format */}
                    {(post.content || post.contentJson) && (
                        <View style={contentHeightStyle}>
                            {post.contentFormat === 'tiptap' && post.contentJson ? (
                                <TipTapContent content={post.contentJson} />
                            ) : post.content ? (
                                <FormattedContent content={post.content} />
                            ) : null}
                            {!isExpanded && (post.content?.length || 0) > 6000 && (
                                <View
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        height: 80,
                                    }}
                                />
                            )}
                        </View>
                    )}
                    {(post.content || post.contentJson) && !isExpanded && (post.content?.length || 0) > 6000 && (
                        <View style={styles.continueReadingRow}>
                            <Text style={ts.continueReading}>Continue Reading</Text>
                            <ChevronDown size={12} color={theme.accent} />
                        </View>
                    )}

                    {/* Image/Video/Link Preview Rendering */}
                    {/* For galleries (Reddit multi-image posts), show all images */}
                    {post.galleryUrls && post.galleryUrls.length > 0 ? (
                        <View style={styles.linkPreviewContainer}>
                            <ImageGallery urls={post.galleryUrls} maxHeight={500} />
                        </View>
                    ) : post.linkUrl && isVideoUrl(post.linkUrl) ? (
                        /* For videos (YouTube, Reddit, etc), ALWAYS show the player */
                        <View style={styles.linkPreviewContainer}>
                            {getYouTubeVideoId(post.linkUrl) ? (
                                <YouTubeEmbed videoId={getYouTubeVideoId(post.linkUrl)!} />
                            ) : isRedditVideo(post.linkUrl) ? (
                                <RedditVideoPlayer url={post.linkUrl} />
                            ) : isDirectVideoUrl(post.linkUrl) ? (
                                <GenericVideoPlayer url={post.linkUrl} />
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
                            )}
                        </View>
                    ) : post.mediaUrl && isImageUrl(post.mediaUrl) ? (
                        /* Show mediaUrl image (from Reddit preview etc.) if not a video */
                        <View style={styles.linkPreviewContainer}>
                            <ZoomableImage uri={post.mediaUrl} maxHeight={500} />
                        </View>
                    ) : post.linkUrl ? (
                        <View style={styles.linkPreviewContainer}>
                            {/* Check if it's a direct image URL - now zoomable! */}
                            {isImageUrl(post.linkUrl) ? (
                                <ZoomableImage uri={post.linkUrl} maxHeight={500} />
                            ) : post.linkMeta?.image ? (
                                /* Link with preview image */
                                <View style={[styles.linkPreview, ts.linkPreview]}>
                                    <ZoomableImage uri={post.linkMeta.image} maxHeight={500} />
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL(post.linkUrl!)}
                                    >
                                        <View style={styles.linkPreviewContent}>
                                            {post.linkMeta.title && (
                                                <Text style={[styles.linkPreviewTitle, ts.textColor]} numberOfLines={2}>
                                                    {post.linkMeta.title}
                                                </Text>
                                            )}
                                            {post.linkMeta.description && (
                                                <Text style={[styles.linkPreviewDescription, ts.mutedColor]} numberOfLines={2}>
                                                    {post.linkMeta.description}
                                                </Text>
                                            )}
                                            {post.linkMeta.domain && (
                                                <Text style={[styles.linkPreviewDomain, ts.accentColor]}>
                                                    {post.linkMeta.domain}
                                                </Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            ) : post.linkMeta && (post.linkMeta.title || post.linkMeta.description) ? (
                                /* Link with metadata but no image (e.g. Bluesky/Mastodon reposts) */
                                <TouchableOpacity
                                    style={[styles.linkPreview, ts.linkPreview]}
                                    onPress={() => Linking.openURL(post.linkUrl!)}
                                >
                                    <View style={styles.linkPreviewContent}>
                                        {post.linkMeta.title && (
                                            <Text style={[styles.linkPreviewTitle, ts.textColor]} numberOfLines={2}>
                                                {post.linkMeta.title}
                                            </Text>
                                        )}
                                        {post.linkMeta.description && (
                                            <Text style={[styles.linkPreviewDescription, ts.mutedColor]} numberOfLines={3}>
                                                {post.linkMeta.description}
                                            </Text>
                                        )}
                                        {post.linkMeta.domain && (
                                            <Text style={[styles.linkPreviewDomain, ts.accentColor]}>
                                                {post.linkMeta.domain}
                                            </Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ) : null /* Plain links handled by inline pill button in cardActions */}
                        </View>
                    ) : null}

                    {/* Poll Rendering */}
                    {localPoll && (
                        <View style={[styles.pollContainer, ts.pollContainer]}>
                            <Text style={[styles.pollQuestion, ts.textColor]}>{localPoll.question}</Text>
                            {localPoll.options.map((opt) => {
                                const votes = opt._count?.votes || 0;
                                const percent = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                const isVoted = localPoll.votes?.some(v => v.optionId === opt.id);

                                return (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[styles.pollOption, ts.pollOption, isVoted && [styles.pollOptionSelected, ts.pollOptionSelected]]}
                                        onPress={() => handleVote(opt.id)}
                                        disabled={!!localPoll.votes?.length}
                                    >
                                        <View style={[styles.pollBar, { width: `${percent}%` }]} />
                                        <View style={styles.pollContent}>
                                            <Text style={[styles.pollText, ts.textColor]}>{opt.text}</Text>
                                            <Text style={[styles.pollPercent, ts.mutedColor]}>{Math.round(percent)}%</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            <Text style={[styles.pollTotal, ts.mutedColor]}>{totalVotes} votes • {timeAgo(post.createdAt)} left</Text>
                        </View>
                    )}
                </View>

                <View style={styles.cardActions}>
                    {/* Comments button - shows full comments section */}
                    <TouchableOpacity
                        style={[styles.pillBtn, ts.pillBtn, showComments && ts.pillBtnActive]}
                        onPress={handleToggleComments}
                    >
                        <MessageSquare size={20} color={showComments ? theme.accent : theme.muted} />
                        <Text style={[styles.pillText, ts.mutedColor, showComments && { color: '#fff' }]}>{post.commentCount}</Text>
                    </TouchableOpacity>

                    {/* Vibe button with radial wheel */}
                    <VibeRadialWheel
                        contentId={post.id}
                        nodeId={post.node.id || globalNodeId}
                        initialReaction={post.myReaction}
                        buttonLabel="Vibe"
                        onComplete={handleVibeComplete}
                    />

                    <TouchableOpacity style={[styles.pillBtn, ts.pillBtn]} onPress={handleSave}>
                        <Bookmark size={20} color={isSaved ? theme.accent : theme.muted} fill={isSaved ? theme.accent : 'none'} />
                        <Text style={[styles.pillText, ts.pillTextHidden]}>Save</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.pillBtn, ts.pillBtn]} onPress={handleShare}>
                        <Share2 size={20} color={theme.muted} />
                        <Text style={[styles.pillText, ts.pillTextHidden]}>Share</Text>
                    </TouchableOpacity>

                    {/* Compact link button - shows domain for ALL posts with links */}
                    {post.linkUrl && (
                        <TouchableOpacity
                            style={[styles.linkPillBtn, ts.pillBtn]}
                            onPress={handleOpenLink}
                        >
                            <Link2 size={14} color={theme.muted} />
                            <Text style={[styles.linkPillText, ts.mutedColor]} numberOfLines={1}>
                                {getDomain(post.linkUrl)}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>

            {/* Vibe Bar - Hugs bottom of card, shows aggregate reactions */}
            <VibeBar vibeAggregate={post.vibeAggregate} height={5} />

            {showComments && (
                <View style={[styles.commentsSection, ts.commentsSection]}>
                    {/* Sort Controls */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSortRow} contentContainerStyle={styles.scrollSortContent}>
                        {['newest', 'insightful', 'joy', 'fire', 'support', 'shock', 'questionable'].map(sort => (
                            <TouchableOpacity
                                key={sort}
                                onPress={() => setCommentSort(sort)}
                                style={[styles.sortChip, ts.sortChip, commentSort === sort && [styles.sortChipSelected, ts.sortChipSelected]]}
                            >
                                <Text style={[styles.sortChipText, ts.mutedColor, commentSort === sort && [styles.sortChipTextSelected, ts.accentColor]]}>
                                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Comment Input */}
                    <View style={styles.commentInputRow}>
                        <View style={[styles.avatarSmallContainer, ts.avatarSmall]}>
                            {currentUser?.avatar ? (
                                <Image source={{ uri: currentUser.avatar }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarImage, ts.accentBgCenter]}>
                                    <Text style={styles.avatarInitialSmallWhite}>
                                        {currentUser?.username?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.flexOne}>
                            {replyingTo && (
                                <View style={styles.replyRow}>
                                    <Text style={ts.replyingTo}>Replying to @{replyingTo.author.username}</Text>
                                    <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.cancelReplyBtn}>
                                        <X size={12} color={theme.muted} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <TextInput
                                placeholder="Add a comment..."
                                placeholderTextColor={theme.muted}
                                style={[styles.commentInput, ts.commentInput]}
                                value={commentText}
                                onChangeText={setCommentText}
                                onSubmitEditing={handleSubmitComment}
                            />
                        </View>
                        <TouchableOpacity style={styles.sendBtn} onPress={handleSubmitComment} disabled={submitting}>
                            <CornerDownRight size={16} color={submitting ? theme.muted : theme.accent} />
                        </TouchableOpacity>
                    </View>

                    {localComments.map((c, i) => (
                        <CommentNode
                            key={c.id}
                            comment={c}
                            isFirst={i === 0}
                            isLast={i === localComments.length - 1}
                            onReply={(comment) => setReplyingTo(comment)}
                            globalNodeId={globalNodeId}
                            onAuthorClick={onAuthorClick}
                        />
                    ))}
                </View>
            )}

            {/* Post Menu Modal — lazy-mounted to avoid invisible subtree cost per card */}
            {menuVisible && (
            <Modal visible transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={[styles.menuContainer, ts.menuContainer]}>
                        {/* Copy Link - available for everyone */}
                        <TouchableOpacity style={styles.menuItem} onPress={handleCopyLink}>
                            <Link2 size={20} color={theme.text} />
                            <Text style={[styles.menuText, ts.textColor]}>Copy Link</Text>
                        </TouchableOpacity>

                        {isOwnPost ? (
                            <>
                                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                                    <Edit2 size={20} color={theme.text} />
                                    <Text style={[styles.menuText, ts.textColor]}>Edit Post</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                                    <Trash2 size={20} color="#ef4444" />
                                    <Text style={[styles.menuText, { color: '#ef4444' }]}>Delete Post</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity style={styles.menuItem} onPress={handleMute}>
                                    <BellOff size={20} color={theme.text} />
                                    <Text style={[styles.menuText, ts.textColor]}>Mute @{post.author.username}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
                                    <Ban size={20} color="#ef4444" />
                                    <Text style={[styles.menuText, { color: '#ef4444' }]}>Block @{post.author.username}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setShowReportModal(true); }}>
                                    <Flag size={20} color="#f97316" />
                                    <Text style={[styles.menuText, { color: '#f97316' }]}>Report Post</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                            <X size={20} color={theme.muted} />
                            <Text style={[styles.menuText, ts.textColor]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            )}

            {/* Report Modal — lazy-mounted */}
            {showReportModal && (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportModal(false)}>
                    <View style={[styles.menuContainer, ts.reportMenu]}>
                        <Text style={[styles.reportTitle, ts.textColor]}>Report Post</Text>
                        <Text style={[styles.reportSubtitle, ts.mutedColor]}>Why are you reporting this post?</Text>

                        {([
                            { reason: 'spam' as ReportReason, label: 'Spam or misleading' },
                            { reason: 'harassment' as ReportReason, label: 'Harassment or bullying' },
                            { reason: 'hate_speech' as ReportReason, label: 'Hate speech' },
                            { reason: 'misinformation' as ReportReason, label: 'Misinformation' },
                            { reason: 'violence' as ReportReason, label: 'Violence or threats' },
                            { reason: 'other' as ReportReason, label: 'Other' },
                        ]).map(({ reason, label }) => (
                            <TouchableOpacity
                                key={reason}
                                style={[styles.reportOption, ts.reportOption]}
                                onPress={() => handleReport(reason)}
                                disabled={reportSubmitting}
                            >
                                <Text style={[styles.reportOptionText, ts.textColor]}>{label}</Text>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity style={[styles.menuItem, styles.reportCancelItem]} onPress={() => setShowReportModal(false)}>
                            <X size={20} color={theme.muted} />
                            <Text style={[styles.menuText, ts.textColor]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            )}
        </View>
    );
};

// Memoize PostCard to prevent unnecessary re-renders during scroll
export const PostCard = memo(PostCardInner, (prevProps, nextProps) => {
    // Only re-render if the post data or key callbacks change
    return (
        prevProps.post.id === nextProps.post.id &&
        prevProps.post.isSaved === nextProps.post.isSaved &&
        prevProps.post.commentCount === nextProps.post.commentCount &&
        prevProps.post.myReaction === nextProps.post.myReaction &&
        prevProps.currentUser?.id === nextProps.currentUser?.id
    );
});

interface FeedProps {
    posts: UIPost[];
    externalPosts?: ExternalPost[];
    currentUser?: CurrentUser | null;
    onPostAction?: (postId: string, action: 'mute' | 'block' | 'delete') => void;
    onVibeCheck?: (post: UIPost) => void;
    onPostClick?: (post: UIPost) => void;
    onEdit?: (post: UIPost) => void;
    onAuthorClick?: (authorId: string) => void;
    onSaveToggle?: (postId: string, saved: boolean) => void;
    globalNodeId?: string;
    onScroll?: (scrollY: number) => void;
    headerOffset?: number;
    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
    searchUserResults?: SearchUser[];
    onUserClick?: (userId: string) => void;
    onRefresh?: () => void;
    refreshing?: boolean;
    onQuoteExternalPost?: (post: ExternalPost) => void;
    onSaveExternalPost?: (post: ExternalPost) => void;
}

// Type for unified feed items
type FeedItem = { type: 'node'; data: UIPost } | { type: 'external'; data: ExternalPost };

export const Feed = ({ posts, externalPosts = [], currentUser, onPostAction, onVibeCheck, onPostClick, onEdit, onAuthorClick, onSaveToggle, globalNodeId, onScroll, headerOffset = 0, onLoadMore, hasMore = true, loadingMore = false, searchUserResults = [], onUserClick, onRefresh, refreshing = false, onQuoteExternalPost, onSaveExternalPost }: FeedProps) => {
    const theme = useAppTheme();
    const { hasLinkedAccount, fetchAccounts } = useLinkedAccountsStore();

    // Fetch linked accounts on mount so we know which platforms are connected
    useEffect(() => {
        if (currentUser) fetchAccounts();
    }, [currentUser, fetchAccounts]);

    const handleExternalLike = useCallback(async (post: ExternalPost) => {
        const result = await externalLike(post.platform, post.externalId, post.cid, post.platformStatusId);
        return { recordUri: result.recordUri };
    }, []);

    const handleExternalUnlike = useCallback(async (post: ExternalPost, recordUri?: string) => {
        await externalUnlike(post.platform, post.externalId, recordUri, post.platformStatusId);
    }, []);

    const handleExternalRepost = useCallback(async (post: ExternalPost) => {
        const result = await externalRepost(post.platform, post.externalId, post.cid, post.platformStatusId);
        return { recordUri: result.recordUri };
    }, []);

    const handleExternalUnrepost = useCallback(async (post: ExternalPost, recordUri?: string) => {
        await externalUnrepost(post.platform, post.externalId, recordUri, post.platformStatusId);
    }, []);

    const handleExternalReply = useCallback(async (post: ExternalPost, text: string) => {
        await externalReply(post.platform, post.externalId, text, post.cid, post.platformStatusId);
    }, []);

    // Memoize themed style overrides for Feed-level elements
    const ts = useMemo(() => StyleSheet.create({
        flatList: { backgroundColor: theme.bg },
        userResultsSection: { backgroundColor: theme.panel, borderColor: theme.border },
        userResultItem: { borderBottomColor: theme.border },
        userResultAvatarPlaceholder: { backgroundColor: theme.accent },
        userResultUsername: { color: theme.text },
        userResultName: { color: theme.muted },
        mutedColor: { color: theme.muted },
        refreshingText: { color: theme.muted },
    }), [theme]);

    const prefetchedRef = useRef<Set<string>>(new Set());
    const flatListRef = useRef<FlatList<FeedItem>>(null);

    // Web pull-to-refresh state
    const [webPullDistance, setWebPullDistance] = useState(0);
    const [isWebPulling, setIsWebPulling] = useState(false);
    const webStartY = useRef(0);
    const webScrollTop = useRef(0);
    const PULL_THRESHOLD = 80;

    // Web pull-to-refresh handlers
    const handleWebTouchStart = useCallback((e: { touches?: Array<{ clientY: number }>; clientY?: number }) => {
        if (Platform.OS !== 'web' || refreshing) return;
        webStartY.current = e.touches?.[0]?.clientY || e.clientY || 0;
    }, [refreshing]);

    const handleWebTouchMove = useCallback((e: { touches?: Array<{ clientY: number }>; clientY?: number; preventDefault?: () => void }) => {
        if (Platform.OS !== 'web' || refreshing) return;
        if (webScrollTop.current > 0) return; // Not at top

        const currentY = e.touches?.[0]?.clientY || e.clientY || 0;
        const diff = currentY - webStartY.current;

        if (diff > 0) {
            e.preventDefault?.();
            setIsWebPulling(true);
            setWebPullDistance(Math.min(diff * 0.4, 100));
        }
    }, [refreshing]);

    const handleWebTouchEnd = useCallback(() => {
        if (Platform.OS !== 'web' || refreshing) return;

        if (webPullDistance >= PULL_THRESHOLD && onRefresh) {
            onRefresh();
        }

        setWebPullDistance(0);
        setIsWebPulling(false);
    }, [refreshing, webPullDistance, onRefresh]);

    // Track scroll position for web pull-to-refresh
    const handleScrollWithTracking = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const scrollY = e.nativeEvent.contentOffset.y;
        webScrollTop.current = scrollY;
        onScroll?.(scrollY);
    }, [onScroll]);

    // Memoized combined and sorted feed data
    const feedData = useMemo((): FeedItem[] => {
        if (externalPosts.length > 0) {
            // Both lists arrive pre-sorted by the backend's scoring algorithm.
            // Interleave proportionally to preserve each list's ranking order.
            const nodeItems: FeedItem[] = posts.map(p => ({ type: 'node' as const, data: p }));
            const extItems: FeedItem[] = externalPosts.map(p => ({ type: 'external' as const, data: p }));
            const total = nodeItems.length + extItems.length;
            const merged: FeedItem[] = [];
            let ni = 0, ei = 0;

            for (let i = 0; i < total; i++) {
                // Pick from whichever list is "behind" its target proportion
                const nodeTarget = (nodeItems.length / total) * (i + 1);
                const extTarget = (extItems.length / total) * (i + 1);

                if (ni < nodeItems.length && (ei >= extItems.length || ni < nodeTarget)) {
                    merged.push(nodeItems[ni]!);
                    ni++;
                } else if (ei < extItems.length) {
                    merged.push(extItems[ei]!);
                    ei++;
                }
            }
            return merged;
        }
        return posts.map(p => ({ type: 'node' as const, data: p }));
    }, [posts, externalPosts]);

    // Prefetch images for smoother scrolling
    useEffect(() => {
        if (posts.length === 0) return;

        const imagesToPrefetch: string[] = [];

        posts.forEach(post => {
            if (prefetchedRef.current.has(post.id)) return;
            prefetchedRef.current.add(post.id);

            if (post.mediaUrl) imagesToPrefetch.push(post.mediaUrl);
            if (post.linkMeta?.image) imagesToPrefetch.push(post.linkMeta.image);
            if (post.author?.avatar) imagesToPrefetch.push(post.author.avatar);
        });

        imagesToPrefetch.forEach(url => {
            Image.prefetch(url).catch(() => {});
        });
    }, [posts]);

    const handleEndReached = useCallback(() => {
        if (hasMore && !loadingMore && onLoadMore) {
            onLoadMore();
        }
    }, [hasMore, loadingMore, onLoadMore]);

    const renderItem = useCallback(({ item }: { item: FeedItem }) => {
        if (item.type === 'node') {
            return (
                <PostCard
                    post={item.data}
                    currentUser={currentUser}
                    onPostAction={onPostAction}
                    onVibeCheck={onVibeCheck}
                    onPress={onPostClick}
                    onEdit={onEdit}
                    onAuthorClick={onAuthorClick}
                    onSaveToggle={onSaveToggle}
                    globalNodeId={globalNodeId}
                />
            );
        }
        return (
            <ExternalPostCard
                post={item.data}
                onRepostToNode={onQuoteExternalPost}
                onSaveToNode={onSaveExternalPost}
                hasLinkedAccount={hasLinkedAccount(item.data.platform)}
                onExternalLike={handleExternalLike}
                onExternalUnlike={handleExternalUnlike}
                onExternalRepost={handleExternalRepost}
                onExternalUnrepost={handleExternalUnrepost}
                onExternalReply={handleExternalReply}
                vibeAggregate={item.data.vibeAggregate}
                myReaction={item.data.myReaction}
                globalNodeId={globalNodeId}
            />
        );
    }, [currentUser, onPostAction, onVibeCheck, onPostClick, onEdit, onAuthorClick, onSaveToggle, globalNodeId, onQuoteExternalPost, onSaveExternalPost, hasLinkedAccount, handleExternalLike, handleExternalUnlike, handleExternalRepost, handleExternalUnrepost, handleExternalReply]);

    const keyExtractor = useCallback((item: FeedItem) => item.data.id, []);

    const ListHeader = useMemo(() => {
        const hasUserResults = searchUserResults.length > 0;

        if (!hasUserResults) return null;

        return (
            <View>
                {hasUserResults && (
                    <View style={[feedStyles.userResultsSection, ts.userResultsSection]}>
                        <Text style={[feedStyles.userResultsTitle, ts.mutedColor]}>Users</Text>
                        {searchUserResults.map(user => (
                    <TouchableOpacity
                        key={user.id}
                        style={[feedStyles.userResultItem, ts.userResultItem]}
                        onPress={() => onUserClick?.(user.id)}
                    >
                        {user.avatar ? (
                            <Image source={{ uri: user.avatar }} style={feedStyles.userResultAvatar} />
                        ) : (
                            <View style={[feedStyles.userResultAvatarPlaceholder, ts.userResultAvatarPlaceholder]}>
                                <Text style={feedStyles.userResultAvatarText}>
                                    {user.username?.[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        <View style={feedStyles.userResultInfo}>
                            <Text style={[feedStyles.userResultUsername, ts.userResultUsername]}>@{user.username}</Text>
                            {(user.firstName || user.lastName) && (
                                <Text style={[feedStyles.userResultName, ts.userResultName]}>
                                    {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                                </Text>
                            )}
                        </View>
                        {user.isBot && (
                            <View style={feedStyles.botBadge}>
                                <Text style={feedStyles.botBadgeText}>BOT</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    }, [searchUserResults, onUserClick, ts]);

    const ListFooter = useMemo(() => {
        if (loadingMore) {
            return (
                <View style={feedStyles.listFooter}>
                    <ActivityIndicator size="small" color={theme.accent} />
                    <Text style={[feedStyles.listFooterText, ts.mutedColor]}>Loading more...</Text>
                </View>
            );
        }
        if (!hasMore && posts.length > 0) {
            return (
                <View style={feedStyles.listFooter}>
                    <Text style={[feedStyles.endText, ts.mutedColor]}>You've reached the end</Text>
                </View>
            );
        }
        return null;
    }, [loadingMore, hasMore, posts.length, ts, theme.accent]);

    // Web pull-to-refresh indicator (memoized)
    const WebPullIndicator = useMemo(() => {
        if (Platform.OS !== 'web' || !onRefresh) return null;

        return (
            <View
                style={[
                    feedStyles.webPullIndicator,
                    {
                        top: headerOffset,
                        transform: [{ translateY: webPullDistance - 50 }],
                        opacity: refreshing ? 1 : Math.min(webPullDistance / PULL_THRESHOLD, 1),
                    }
                ]}
            >
                <View
                    style={{
                        transform: [{ rotate: refreshing ? '0deg' : `${(webPullDistance / PULL_THRESHOLD) * 180}deg` }],
                    }}
                >
                    <RefreshCw
                        size={24}
                        color={theme.accent}
                        style={refreshing ? feedStyles.refreshingIcon : undefined}
                    />
                </View>
                {refreshing && (
                    <Text style={[feedStyles.refreshingText, ts.refreshingText]}>Refreshing...</Text>
                )}
            </View>
        );
    }, [headerOffset, webPullDistance, refreshing, onRefresh, theme.accent, ts]);

    // Memoized touch props for web pull-to-refresh
    const webTouchProps = useMemo((): Partial<ViewProps> => {
        if (Platform.OS !== 'web' || !onRefresh) return {};
        // On web, touch events have DOM-compatible shape (touches[].clientY, etc.)
        // Cast to ViewProps since these are only active on web platform
        return {
            onTouchStart: handleWebTouchStart as ViewProps['onTouchStart'],
            onTouchMove: handleWebTouchMove as ViewProps['onTouchMove'],
            onTouchEnd: handleWebTouchEnd,
        };
    }, [onRefresh, handleWebTouchStart, handleWebTouchMove, handleWebTouchEnd]);

    // Memoized content container style (depends on headerOffset)
    const contentContainerStyle = useMemo(() => ({
        paddingBottom: 80,
        padding: 8,
        paddingTop: headerOffset + 8,
    }), [headerOffset]);

    // Memoized transform style for web pull animation
    const pullTransformStyle = useMemo(() => {
        if (Platform.OS !== 'web' || (!isWebPulling && !refreshing)) return feedStyles.flexOne;
        return {
            flex: 1,
            transform: [{ translateY: refreshing ? 40 : webPullDistance }],
        };
    }, [isWebPulling, refreshing, webPullDistance]);

    return (
        <View style={feedStyles.feedContainer} {...webTouchProps}>
            {WebPullIndicator}
            <View style={pullTransformStyle}>
                <FlatList
                    ref={flatListRef}
                    data={feedData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    style={[feedStyles.flatList, ts.flatList]}
                    contentContainerStyle={contentContainerStyle}
                    onScroll={handleScrollWithTracking}
                    scrollEventThrottle={Platform.OS === 'web' ? 32 : 16}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    ListHeaderComponent={ListHeader}
                    ListFooterComponent={ListFooter}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        Platform.OS !== 'web' && onRefresh ? (
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={theme.accent}
                                colors={[theme.accent]}
                                progressViewOffset={headerOffset}
                            />
                        ) : undefined
                    }
                    // Virtualization optimizations
                    windowSize={5}
                    maxToRenderPerBatch={Platform.OS === 'web' ? 4 : 8}
                    initialNumToRender={6}
                    removeClippedSubviews={Platform.OS !== 'web'}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    connectorElbow: {
        position: 'absolute',
        left: -22,
        top: -3,
        width: 25,
        height: 14,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderBottomLeftRadius: 12,
        zIndex: 0
    },
    connectorSpine: {
        position: 'absolute',
        left: -22,
        width: 2,
        zIndex: 0
    },
    bridgeLine: {
        position: 'absolute',
        left: 10,
        top: 0,
        bottom: 0,
        width: 2,
        zIndex: 0,
        opacity: 1
    },

    avatarSmallContainer: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1,
        overflow: 'hidden',
        zIndex: 10
    },
    avatarImage: { width: '100%', height: '100%', borderRadius: 8 },
    avatarContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 2,
        overflow: 'hidden',
    },
    usernameSmall: { fontSize: 14, fontWeight: 'bold' },
    usernameLarge: { fontSize: 16, fontWeight: 'bold' },
    timestamp: { fontSize: 10 },
    commentText: { fontSize: 14, color: 'rgba(226, 232, 240, 0.9)', lineHeight: 20 },
    title: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 4 },
    bodyText: { fontSize: 14, color: '#e2e8f0', lineHeight: 22 },
    subtext: { fontSize: 11 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    commentBody: { marginLeft: 28, paddingBottom: 4 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 6, opacity: 0.6 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 9, fontWeight: '500' },
    actionBtnText: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionLabel: { fontSize: 10, fontWeight: 'bold' },
    card: {
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 8,
        overflow: 'hidden'
    },
    cardContent: { padding: 8 },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    fadeOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40 },
    cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    pillBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderRadius: 8
    },
    pillText: { fontSize: 14, fontWeight: '500' },
    linkPillBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
        borderWidth: 1, borderRadius: 6, maxWidth: 160,
    },
    linkPillText: { fontSize: 12, fontWeight: '500' },
    commentsSection: {
        borderTopWidth: 1, backgroundColor: 'rgba(15, 17, 21, 0.3)',
        paddingHorizontal: 8, paddingTop: 16, paddingBottom: 16
    },
    pollContainer: {
        marginTop: 12,
        gap: 8,
        maxWidth: Platform.OS === 'web' ? 400 : '100%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    pollQuestion: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    pollOption: {
        borderRadius: 8,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative'
    },
    pollOptionSelected: { borderWidth: 2 },
    pollBar: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderRadius: 6,
    },
    pollContent: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 14
    },
    pollText: { fontSize: 14, fontWeight: '500' },
    pollPercent: { fontSize: 13, fontWeight: '600', fontFamily: 'monospace' },
    pollTotal: { fontSize: 12, marginTop: 8 },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'
    },
    menuContainer: {
        width: 280, borderRadius: 12, padding: 8,
        borderWidth: 1,
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
        borderRadius: 8
    },
    menuText: { fontSize: 16, fontWeight: '500' },
    reportTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
        textAlign: 'center',
    },
    reportSubtitle: {
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    reportOption: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    reportOptionText: {
        fontSize: 15,
        fontWeight: '500',
    },
    // Static layout helpers (extracted from inline objects for perf)
    headerAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatarInitialWhite: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    avatarInitialSmallWhite: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
    flexOne: { flex: 1 },
    authorBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    moreBtn: { padding: 8 },
    contentPadding: { paddingHorizontal: 4, marginBottom: 8 },
    continueReadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    scrollSortRow: { marginBottom: 12 },
    scrollSortContent: { gap: 8 },
    replyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    cancelReplyBtn: { marginLeft: 8 },
    reportCancelItem: { marginTop: 8 },
    // CommentNode static layout helpers
    commentWrapper: { position: 'relative' },
    commentInner: { position: 'relative', zIndex: 10 },
    collapseBtn: { padding: 2 },
    repliesContainer: { paddingLeft: 32, gap: 8 },
    commentInputRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
        paddingHorizontal: 8
    },
    commentInput: {
        flex: 1, borderRadius: 20,
        paddingHorizontal: 16, paddingVertical: 8, color: '#fff',
        borderWidth: 1,
    },
    sendBtn: {
        padding: 8, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 20
    },
    sortChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
        borderWidth: 1,
    },
    sortChipSelected: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    sortChipText: { fontSize: 12 },
    sortChipTextSelected: { fontWeight: '600' },
    // Image/Link Preview styles
    linkPreviewContainer: {
        marginTop: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    postImage: {
        width: '100%',
        borderRadius: 12,
    },
    // YouTube embed styles
    youtubeContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        alignSelf: 'center',
    },
    // Video styles
    videoPreview: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
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
        paddingLeft: 4, // Offset play icon to center visually
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
    // Video container for expo-av player
    videoContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        alignSelf: 'center',
    },
    // Image zoom modal styles
    imageZoomModal: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageZoomClose: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        right: 20,
        zIndex: 10,
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
    },
    imageZoomContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    linkPreview: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    linkPreviewImage: {
        width: '100%',
        maxHeight: 500,
    },
    linkPreviewContent: {
        padding: 12,
    },
    linkPreviewTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    linkPreviewDescription: {
        fontSize: 13,
        marginBottom: 6,
        lineHeight: 18,
    },
    linkPreviewDomain: {
        fontSize: 12,
    },
    plainLink: {
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
    },
    plainLinkText: {
        fontSize: 14,
    },
});

// Feed-level styles for user search results
const feedStyles = StyleSheet.create({
    userResultsSection: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginBottom: 12,
    },
    userResultsTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    userResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    userResultAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    userResultAvatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userResultAvatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    userResultInfo: {
        flex: 1,
        marginLeft: 12,
    },
    userResultUsername: {
        fontSize: 15,
        fontWeight: '600',
    },
    userResultName: {
        fontSize: 13,
        marginTop: 2,
    },
    botBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    botBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff',
    },
    externalDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        paddingHorizontal: 8,
    },
    externalDividerLine: {
        flex: 1,
        height: 1,
    },
    externalDividerText: {
        fontSize: 12,
        fontWeight: '500',
        paddingHorizontal: 12,
    },
    feedContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    flatList: {
        flex: 1,
    },
    flexOne: {
        flex: 1,
    },
    webPullIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    refreshingIcon: {
        opacity: 0.7,
    },
    refreshingText: {
        fontSize: 12,
        marginTop: 4,
    },
    listFooter: {
        padding: 20,
        alignItems: 'center',
    },
    listFooterText: {
        marginTop: 8,
        fontSize: 12,
    },
    endText: {
        fontSize: 12,
    },
});
