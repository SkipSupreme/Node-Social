import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, FlatList, Dimensions, Platform, Modal, TextInput, Share } from 'react-native';
import { MessageSquare, Share2, Zap, Bookmark, CornerDownRight, Minus, MoreHorizontal, Shield, ChevronDown, Hexagon, X, Ban, BellOff, Edit2, Trash2, Flag } from './Icons';
import { COLORS, ERAS, SCOPE_COLORS } from '../../constants/theme';
import { createPostReaction, savePost, muteUser, blockUser, createComment, votePoll, api, deletePost, editPost, reportContent, ReportReason } from '../../lib/api';
import { VibeRadialWheel } from '../VibeRadialWheel';
import { VibeBar, VibeAggregateData } from '../VibeBar';
import { socketManager } from '../../lib/socket';

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
    content: string;
    createdAt: string | Date;
    commentCount: number;
    expertGated?: boolean;
    vibes?: any[];
    comments?: UIComment[];
    poll?: {
        id: string;
        question: string;
        options: { id: string; text: string; _count?: { votes: number } }[];
        votes?: { optionId: string }[];
    };
    myReaction?: { [key: string]: number } | null;
    vibeAggregate?: VibeAggregateData | null;
}

interface CommentNodeProps {
    comment: UIComment;
    isLast?: boolean;
    isFirst?: boolean;
    onReply?: (comment: UIComment) => void;
    globalNodeId?: string;
}

const CommentNode = ({ comment, isLast = false, isFirst = false, onReply, globalNodeId }: CommentNodeProps) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const incomingColor = SCOPE_COLORS[(comment.depth - 1) % SCOPE_COLORS.length];
    const connectorColor = SCOPE_COLORS[comment.depth % SCOPE_COLORS.length];
    const eraStyle = ERAS[comment.author.era] || ERAS['Default'];


    const lastChildHeight = isFirst ? 14 : 10;

    return (
        <View style={{ position: 'relative' }}>

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
            <View style={{ position: 'relative', zIndex: 10 }}>
                {/* Bridge line connecting to replies */}
                {!isCollapsed && comment.replies && comment.replies.length > 0 && (
                    <View style={[styles.bridgeLine, { backgroundColor: connectorColor }]} />
                )}

                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={styles.avatarSmallContainer}>
                        {comment.author.avatar ? (
                            <Image source={{ uri: comment.author.avatar }} style={styles.avatarImage} />
                        ) : (
                            <View style={[styles.avatarImage, { backgroundColor: COLORS.node.accent, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>
                                    {comment.author.username?.[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.userInfoRow}>
                        <Text style={styles.usernameSmall}>{comment.author.username}</Text>

                        <View style={[styles.badge, { backgroundColor: COLORS.node.border }]}>
                            <Text style={styles.badgeText}>{comment.author.cred} Cred</Text>
                        </View>

                        <View style={[styles.badge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border, borderWidth: 1 }]}>
                            <Text style={[styles.badgeText, { color: eraStyle.text }]}>{comment.author.era}</Text>
                        </View>

                        <Text style={styles.timestamp}>{timeAgo(comment.timestamp)}</Text>

                        <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={{ padding: 2 }}>
                            {isCollapsed ? <CornerDownRight size={12} color={COLORS.node.muted} /> : <Minus size={12} color={COLORS.node.muted} />}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Body */}
                {!isCollapsed && (
                    <View style={styles.commentBody}>
                        <Text style={styles.commentText}>{comment.content}</Text>

                        <View style={styles.actionRow}>
                            <VibeRadialWheel
                                postId={comment.id}
                                nodeId={globalNodeId}
                                buttonLabel=""
                                compact={true}
                                contentType="comment"
                            />
                            <TouchableOpacity style={styles.actionBtnText} onPress={() => onReply && onReply(comment)}>
                                <Text style={styles.actionLabel}>Reply</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Replies */}
            {!isCollapsed && comment.replies && comment.replies.length > 0 && (
                <View style={{ paddingLeft: 32, gap: 8 }}>
                    {comment.replies.map((reply, idx) => (
                        <CommentNode
                            key={reply.id}
                            comment={reply}
                            isFirst={idx === 0}
                            isLast={idx === (comment.replies?.length || 0) - 1}
                            onReply={onReply}
                            globalNodeId={globalNodeId}
                        />
                    ))}
                </View>
            )}

        </View>
    );
};

interface PostCardProps {
    post: UIPost;
    currentUser?: any;
    onPostAction?: (postId: string, action: 'mute' | 'block' | 'delete') => void;
    onVibeCheck?: (post: UIPost) => void;
    onPress?: (post: UIPost) => void;
    onEdit?: (post: UIPost) => void;
    globalNodeId?: string;
}

export const PostCard = ({ post: initialPost, currentUser, onPostAction, onVibeCheck, onPress, onEdit, globalNodeId }: PostCardProps) => {
    const [post, setPost] = useState(initialPost);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [replyingTo, setReplyingTo] = useState<UIComment | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const eraStyle = ERAS[post.author.era] || ERAS['Default'];

    // Check if current user is the author
    const isOwnPost = currentUser?.id === post.author.id;

    const [localPoll, setLocalPoll] = useState(post.poll);
    const [localComments, setLocalComments] = useState<UIComment[]>(post.comments || []);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    const [commentSort, setCommentSort] = useState<string>('newest');

    const fetchComments = async () => {
        // if (commentsLoaded) return; // Allow reload if sort changes
        try {
            const res = await api.get<any[]>(`/posts/${post.id}/comments?all=true&limit=100&sortBy=${commentSort}`);

            // Build Tree
            const commentMap = new Map();
            const roots: UIComment[] = [];

            // First pass: create nodes
            res.forEach((c: any) => {
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
                    parentId: c.parentId
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
    React.useEffect(() => {
        // Connect socket if not connected
        socketManager.connect();

        // Subscribe to updates for this post
        const unsubscribe = socketManager.subscribeToPost(post.id, (data) => {
            // Update local post state with new metrics/aggregates
            if (data.metrics) {
                // Update engagement score or other metrics if we displayed them
            }
            if (data.vibeAggregate) {
                // Real-time vibe aggregate updates - can be used to update live counts
            }
        });

        return () => {
            unsubscribe?.();
        };
    }, [post.id]);

    // Don't render if deleted (after all hooks)
    if (isDeleted) return null;

    const handleVote = async (optionId: string) => {
        if (!localPoll) return;

        // Check if already voted (any option)
        // We check both the optimistic local state AND the original post state to be safe
        const hasVotedLocally = localPoll.votes && localPoll.votes.length > 0;
        if (hasVotedLocally) return;

        // Optimistic update
        const newPoll = { ...localPoll };
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
            // Revert on failure
            setLocalPoll(post.poll);
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
        try {
            const res = await savePost(post.id);
            setIsSaved(res.saved);
        } catch (error) {
            console.error('Failed to save post:', error);
        }
    };

    const handleMute = async () => {
        try {
            await muteUser(post.author.id);
            setMenuVisible(false);
            onPostAction && onPostAction(post.id, 'mute');
        } catch (error) {
            console.error('Failed to mute user:', error);
        }
    };

    const handleBlock = async () => {
        try {
            await blockUser(post.author.id);
            setMenuVisible(false);
            onPostAction && onPostAction(post.id, 'block');
        } catch (error) {
            console.error('Failed to block user:', error);
        }
    };

    const handleDelete = async () => {
        try {
            await deletePost(post.id);
            setMenuVisible(false);
            setIsDeleted(true);
            onPostAction && onPostAction(post.id, 'delete');
        } catch (error) {
            console.error('Failed to delete post:', error);
        }
    };

    const handleEdit = () => {
        setMenuVisible(false);
        onEdit && onEdit(post);
    };

    const handleReport = async (reason: ReportReason) => {
        setReportSubmitting(true);
        try {
            await reportContent('post', post.id, reason);
            setShowReportModal(false);
            setMenuVisible(false);
            // Show success feedback (could use a toast/alert in the future)
        } catch (error: any) {
            console.error('Failed to report post:', error);
            // Could show error message to user
        } finally {
            setReportSubmitting(false);
        }
    };

    const handleSubmitComment = async () => {
        if (!commentText.trim()) return;
        setSubmitting(true);
        try {
            const newCommentData = await createComment(post.id, { content: commentText, parentId: replyingTo?.id });

            // Create UIComment object from response
            const newComment: UIComment = {
                id: newCommentData.id,
                author: {
                    id: currentUser?.id || 'temp',
                    username: currentUser?.username || 'You',
                    avatar: currentUser?.avatar || undefined,
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

    return (
        <View style={styles.card}>
            <TouchableOpacity activeOpacity={0.9} style={styles.cardContent} onPress={() => setIsExpanded(!isExpanded)}>

                <View style={styles.postHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.avatarContainer}>
                            {post.author.avatar ? (
                                <Image source={{ uri: post.author.avatar }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarImage, { backgroundColor: COLORS.node.accent, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                                        {post.author.username?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={styles.usernameLarge}>{post.author.username}</Text>
                                <View style={[styles.badge, { backgroundColor: COLORS.node.border }]}>
                                    <Text style={styles.badgeText}>{post.author.cred} Cred</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border, borderWidth: 1 }]}>
                                    <Text style={[styles.badgeText, { color: eraStyle.text }]}>{post.author.era}</Text>
                                </View>
                            </View>
                            <Text style={styles.subtext}>{post.node.name} • {timeAgo(post.createdAt)}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 4 }}>
                        <MoreHorizontal size={16} color={COLORS.node.muted} />
                    </TouchableOpacity>
                </View>

                <View style={{ paddingLeft: 4, marginBottom: 8 }}>
                    <TouchableOpacity onPress={() => onPress?.(post)} activeOpacity={0.7}>
                        <Text style={styles.title}>
                            {post.expertGated && <Shield size={12} color="#f87171" style={{ marginRight: 4 }} />}
                            {post.title}
                        </Text>
                    </TouchableOpacity>

                    <View style={{ maxHeight: isExpanded ? undefined : 80, overflow: 'hidden' }}>
                        <Text style={styles.bodyText}>
                            {post.content}
                        </Text>
                        {!isExpanded && post.content.length > 300 && (
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
                    {!isExpanded && post.content.length > 300 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Text style={{ color: COLORS.node.accent, fontSize: 12, fontWeight: '700' }}>Continue Reading</Text>
                            <ChevronDown size={12} color={COLORS.node.accent} />
                        </View>
                    )}

                    {/* Poll Rendering */}
                    {localPoll && (
                        <View style={styles.pollContainer}>
                            <Text style={styles.pollQuestion}>{localPoll.question}</Text>
                            {localPoll.options.map((opt) => {
                                const votes = opt._count?.votes || 0;
                                const percent = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                const isVoted = localPoll.votes?.some(v => v.optionId === opt.id);

                                return (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[styles.pollOption, isVoted && styles.pollOptionSelected]}
                                        onPress={() => handleVote(opt.id)}
                                        disabled={!!localPoll.votes?.length}
                                    >
                                        <View style={[styles.pollBar, { width: `${percent}%` }]} />
                                        <View style={styles.pollContent}>
                                            <Text style={styles.pollText}>{opt.text}</Text>
                                            <Text style={styles.pollPercent}>{Math.round(percent)}%</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            <Text style={styles.pollTotal}>{totalVotes} votes • {timeAgo(post.createdAt)} left</Text>
                        </View>
                    )}
                </View>

                <View style={styles.cardActions}>
                    <VibeRadialWheel
                        postId={post.id}
                        nodeId={post.node.id || globalNodeId}
                        initialReaction={post.myReaction}
                        buttonLabel="Vibe"
                        onComplete={(intensities) => {
                            // Update local vibeAggregate optimistically
                            // Convert 0-100 intensities to sum format for display
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
                        }}
                    />

                    <TouchableOpacity
                        style={[styles.pillBtn, showComments && { borderColor: COLORS.node.accent, backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}
                        onPress={() => setShowComments(!showComments)}
                    >
                        <MessageSquare size={20} color={showComments ? COLORS.node.accent : COLORS.node.muted} />
                        <Text style={[styles.pillText, showComments && { color: '#fff' }]}>{post.commentCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.pillBtn} onPress={handleSave}>
                        <Bookmark size={20} color={isSaved ? COLORS.node.accent : COLORS.node.muted} fill={isSaved ? COLORS.node.accent : 'none'} />
                        <Text style={[styles.pillText, { display: 'none' }]}>Save</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.pillBtn} onPress={handleShare}>
                        <Share2 size={20} color={COLORS.node.muted} />
                        <Text style={[styles.pillText, { display: 'none' }]}>Share</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Vibe Bar - Hugs bottom of card, shows aggregate reactions */}
            <VibeBar vibeAggregate={post.vibeAggregate} height={5} />

            {showComments && (
                <View style={styles.commentsSection}>
                    {/* Sort Controls */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                        {['newest', 'insightful', 'joy', 'fire', 'support', 'shock', 'questionable'].map(sort => (
                            <TouchableOpacity
                                key={sort}
                                onPress={() => setCommentSort(sort)}
                                style={[styles.sortChip, commentSort === sort && styles.sortChipSelected]}
                            >
                                <Text style={[styles.sortChipText, commentSort === sort && styles.sortChipTextSelected]}>
                                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Comment Input */}
                    <View style={styles.commentInputRow}>
                        <View style={styles.avatarSmallContainer}>
                            {currentUser?.avatar ? (
                                <Image source={{ uri: currentUser.avatar }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarImage, { backgroundColor: COLORS.node.accent, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>
                                        {currentUser?.username?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            {replyingTo && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ color: COLORS.node.muted, fontSize: 12 }}>Replying to @{replyingTo.author.username}</Text>
                                    <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 8 }}>
                                        <X size={12} color={COLORS.node.muted} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <TextInput
                                placeholder="Add a comment..."
                                placeholderTextColor={COLORS.node.muted}
                                style={styles.commentInput}
                                value={commentText}
                                onChangeText={setCommentText}
                                onSubmitEditing={handleSubmitComment}
                            />
                        </View>
                        <TouchableOpacity style={styles.sendBtn} onPress={handleSubmitComment} disabled={submitting}>
                            <CornerDownRight size={16} color={submitting ? COLORS.node.muted : COLORS.node.accent} />
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
                        />
                    ))}
                </View>
            )}

            {/* Post Menu Modal */}
            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={styles.menuContainer}>
                        {isOwnPost ? (
                            <>
                                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                                    <Edit2 size={20} color={COLORS.node.text} />
                                    <Text style={styles.menuText}>Edit Post</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                                    <Trash2 size={20} color="#ef4444" />
                                    <Text style={[styles.menuText, { color: '#ef4444' }]}>Delete Post</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity style={styles.menuItem} onPress={handleMute}>
                                    <BellOff size={20} color={COLORS.node.text} />
                                    <Text style={styles.menuText}>Mute @{post.author.username}</Text>
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
                            <X size={20} color={COLORS.node.muted} />
                            <Text style={styles.menuText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Report Modal */}
            <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportModal(false)}>
                    <View style={[styles.menuContainer, { maxWidth: 350 }]}>
                        <Text style={styles.reportTitle}>Report Post</Text>
                        <Text style={styles.reportSubtitle}>Why are you reporting this post?</Text>

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
                                style={styles.reportOption}
                                onPress={() => handleReport(reason)}
                                disabled={reportSubmitting}
                            >
                                <Text style={styles.reportOptionText}>{label}</Text>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity style={[styles.menuItem, { marginTop: 8 }]} onPress={() => setShowReportModal(false)}>
                            <X size={20} color={COLORS.node.muted} />
                            <Text style={styles.menuText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

interface FeedProps {
    posts: UIPost[];
    currentUser?: any;
    onPostAction?: (postId: string, action: 'mute' | 'block' | 'delete') => void;
    onVibeCheck?: (post: UIPost) => void;
    onPostClick?: (post: UIPost) => void;
    onEdit?: (post: UIPost) => void;
    globalNodeId?: string;
}

export const Feed = ({ posts, currentUser, onPostAction, onVibeCheck, onPostClick, onEdit, globalNodeId }: FeedProps) => {
    return (
        <ScrollView style={{ flex: 1, backgroundColor: COLORS.node.bg }} contentContainerStyle={{ paddingBottom: 80, padding: 8 }}>
            {posts.map(p => <PostCard key={p.id} post={p} currentUser={currentUser} onPostAction={onPostAction} onVibeCheck={onVibeCheck} onPress={onPostClick} onEdit={onEdit} globalNodeId={globalNodeId} />)}
        </ScrollView>
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
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        backgroundColor: COLORS.node.panel,
        overflow: 'hidden',
        zIndex: 10
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.node.accent,
        padding: 1,
        overflow: 'hidden'
    },
    usernameSmall: { fontSize: 14, fontWeight: 'bold', color: COLORS.node.text },
    usernameLarge: { fontSize: 16, fontWeight: 'bold', color: COLORS.node.text },
    timestamp: { fontSize: 10, color: COLORS.node.muted },
    commentText: { fontSize: 14, color: 'rgba(226, 232, 240, 0.9)', lineHeight: 20 },
    title: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 4 },
    bodyText: { fontSize: 14, color: COLORS.node.muted, lineHeight: 22 },
    subtext: { fontSize: 11, color: COLORS.node.muted },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    commentBody: { marginLeft: 28, paddingBottom: 4 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 6, opacity: 0.6 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 9, fontWeight: '500', color: COLORS.node.text },
    actionBtnText: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionLabel: { fontSize: 10, fontWeight: 'bold', color: COLORS.node.muted },
    card: {
        backgroundColor: COLORS.node.panel,
        borderColor: COLORS.node.border,
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
        flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8,
        backgroundColor: COLORS.node.panel, borderWidth: 1, borderColor: COLORS.node.border, borderRadius: 999
    },
    pillText: { fontSize: 14, fontWeight: '500', color: COLORS.node.muted },
    commentsSection: {
        borderTopWidth: 1, borderTopColor: COLORS.node.border, backgroundColor: 'rgba(15, 17, 21, 0.3)',
        paddingHorizontal: 8, paddingTop: 16, paddingBottom: 16
    },
    pollContainer: {
        marginTop: 12,
        gap: 8,
        maxWidth: Platform.OS === 'web' ? 400 : '100%',
        backgroundColor: COLORS.node.panel,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    pollQuestion: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.node.text,
        marginBottom: 8,
    },
    pollOption: {
        backgroundColor: COLORS.node.bg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        height: 44,
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative'
    },
    pollOptionSelected: { borderColor: COLORS.node.accent, borderWidth: 2 },
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
    pollText: { fontSize: 14, color: COLORS.node.text, fontWeight: '500' },
    pollPercent: { fontSize: 13, color: COLORS.node.muted, fontWeight: '600', fontFamily: 'monospace' },
    pollTotal: { fontSize: 12, color: COLORS.node.muted, marginTop: 8 },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'
    },
    menuContainer: {
        width: 280, backgroundColor: COLORS.node.panel, borderRadius: 12, padding: 8,
        borderWidth: 1, borderColor: COLORS.node.border
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
        borderRadius: 8
    },
    menuText: { fontSize: 16, color: COLORS.node.text, fontWeight: '500' },
    reportTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.node.text,
        marginBottom: 4,
        textAlign: 'center',
    },
    reportSubtitle: {
        fontSize: 14,
        color: COLORS.node.muted,
        marginBottom: 16,
        textAlign: 'center',
    },
    reportOption: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: COLORS.node.bg,
        marginBottom: 8,
    },
    reportOptionText: {
        fontSize: 15,
        color: COLORS.node.text,
        fontWeight: '500',
    },
    commentInputRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
        paddingHorizontal: 8
    },
    commentInput: {
        flex: 1, backgroundColor: COLORS.node.bg, borderRadius: 20,
        paddingHorizontal: 16, paddingVertical: 8, color: '#fff',
        borderWidth: 1, borderColor: COLORS.node.border
    },
    sendBtn: {
        padding: 8, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 20
    },
    sortChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
        backgroundColor: COLORS.node.bg, borderWidth: 1, borderColor: COLORS.node.border
    },
    sortChipSelected: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)', borderColor: COLORS.node.accent
    },
    sortChipText: { fontSize: 12, color: COLORS.node.muted },
    sortChipTextSelected: { color: COLORS.node.accent, fontWeight: '600' }
});
