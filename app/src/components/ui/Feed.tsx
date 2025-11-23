import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageSquare, Share2, Zap, Bookmark, CornerDownRight, Minus, MoreHorizontal, Shield, ChevronDown } from './Icons';
import { RadialMenu } from './RadialMenu';
import { COLORS, ERAS, SCOPE_COLORS } from '../../constants/theme';
import { createPostReaction } from '../../lib/api';

// Define types for the UI components
interface UIAuthor {
    username: string;
    avatar: string;
    era: string;
    connoisseurCred: number;
}

interface UIComment {
    id: string;
    author: UIAuthor;
    content: string;
    timestamp: Date;
    depth: number;
    replies?: UIComment[];
}

function timeAgo(date: Date | string) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHour > 0) return `${diffHour}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'Just now';
}

interface UIPost {
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
}

interface CommentNodeProps {
    comment: UIComment;
    isLast?: boolean;
    isFirst?: boolean;
}

const CommentNode = ({ comment, isLast = false, isFirst = false }: CommentNodeProps) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const incomingColor = SCOPE_COLORS[(comment.depth - 1) % SCOPE_COLORS.length];
    const connectorColor = SCOPE_COLORS[comment.depth % SCOPE_COLORS.length];
    const eraStyle = ERAS[comment.author.era] || ERAS['Default'];

    /* !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
       !!! GOD MATH - DO NOT TOUCH UNDER ANY CIRCUMSTANCES WITHOUT PERMISSION !!!
       !!! THIS GEOMETRY IS FIXED AND DIVINE. DO NOT REFACTOR.                !!!
       !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! */
    const lastChildHeight = isFirst ? 11 : 7; // *** THIS HAS TO BE FUCKING 7PX ***

    return (
        <View style={{ position: 'relative' }}>

            {/* --- CHILD CONNECTORS --- */}
            {comment.depth > 0 && (
                <>
                    {/* 
             !!! GOD MATH: ELBOW LEFT -21 !!! 
          */}
                    <View style={[styles.connectorElbow, { borderColor: incomingColor }]} />

                    {/* 
             !!! GOD MATH: SPINE LEFT -21 !!! 
          */}
                    <View style={[
                        styles.connectorSpine,
                        {
                            backgroundColor: incomingColor,
                            top: isFirst ? 0 : -2,
                            height: isLast ? lastChildHeight : '100%',
                            // Ensure full connectivity for non-last items
                            bottom: isLast ? undefined : -8
                        }
                    ]} />
                </>
            )}

            {/* --- CONTENT CONTAINER --- */}
            <View style={{ position: 'relative', zIndex: 10 }}>

                {/* 
            !!! GOD MATH: BRIDGE LEFT 7 !!! 
        */}
                {!isCollapsed && comment.replies && comment.replies.length > 0 && (
                    <View style={[styles.bridgeLine, { backgroundColor: connectorColor }]} />
                )}

                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={styles.avatarSmallContainer}>
                        <Image source={{ uri: comment.author.avatar }} style={styles.avatarImage} />
                    </View>

                    <View style={styles.userInfoRow}>
                        <Text style={styles.usernameSmall}>{comment.author.username}</Text>

                        <View style={[styles.badge, { backgroundColor: COLORS.node.border }]}>
                            <Text style={styles.badgeText}>{comment.author.connoisseurCred} Cred</Text>
                        </View>

                        <View style={[styles.badge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border, borderWidth: 1 }]}>
                            <Text style={[styles.badgeText, { color: eraStyle.text }]}>{comment.author.era}</Text>
                        </View>

                        <Text style={styles.timestamp}>12:45 PM</Text>

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
                            <TouchableOpacity style={styles.actionBtnText}>
                                <Zap size={12} color={COLORS.node.muted} />
                                <Text style={styles.actionLabel}>Vibe</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtnText}>
                                <Text style={styles.actionLabel}>Reply</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* REPLIES: Padding Left 32 (Matches Web: pl-8) */}
            {!isCollapsed && comment.replies && comment.replies.length > 0 && (
                <View style={{ paddingLeft: 32, gap: 8 }}>
                    {comment.replies.map((reply, idx) => (
                        <CommentNode
                            key={reply.id}
                            comment={reply}
                            isFirst={idx === 0}
                            isLast={idx === (comment.replies?.length || 0) - 1}
                        />
                    ))}
                </View>
            )}

        </View>
    );
};

interface PostCardProps {
    post: UIPost;
}

const PostCard = ({ post }: PostCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const eraStyle = ERAS[post.author.era] || ERAS['Default'];

    return (
        <View style={styles.card}>
            <TouchableOpacity activeOpacity={0.9} style={styles.cardContent} onPress={() => setIsExpanded(!isExpanded)}>

                <View style={styles.postHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.avatarContainer}>
                            <Image source={{ uri: post.author.avatar }} style={styles.avatarImage} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={styles.usernameLarge}>{post.author.username}</Text>
                                <View style={[styles.badge, { backgroundColor: COLORS.node.border }]}>
                                    <Text style={styles.badgeText}>{post.author.connoisseurCred} Cred</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: eraStyle.bg, borderColor: eraStyle.border, borderWidth: 1 }]}>
                                    <Text style={[styles.badgeText, { color: eraStyle.text }]}>{post.author.era}</Text>
                                </View>
                            </View>
                            <Text style={styles.subtext}>{post.node.name} • {timeAgo(post.createdAt)}</Text>
                        </View>
                    </View>
                    <MoreHorizontal size={16} color={COLORS.node.muted} />
                </View>

                <View style={{ paddingLeft: 4, marginBottom: 8 }}>
                    <Text style={styles.title}>
                        {post.expertGated && <Shield size={12} color="#f87171" style={{ marginRight: 4 }} />}
                        {post.title}
                    </Text>

                    <View style={{ maxHeight: isExpanded ? undefined : 80, overflow: 'hidden' }}>
                        <Text style={styles.bodyText}>
                            {post.content}
                        </Text>
                        {!isExpanded && post.content.length > 300 && (
                            <LinearGradient
                                colors={['transparent', COLORS.node.panel]}
                                style={styles.fadeOverlay}
                            />
                        )}
                    </View>
                    {!isExpanded && post.content.length > 300 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Text style={{ color: COLORS.node.accent, fontSize: 12, fontWeight: '700' }}>Continue Reading</Text>
                            <ChevronDown size={12} color={COLORS.node.accent} />
                        </View>
                    )}
                </View>

                <View style={styles.cardActions}>
                    <RadialMenu onComplete={async (intensities) => {
                        try {
                            // Convert 0-100 to 0.0-1.0
                            const normalized: Record<string, number> = {};
                            Object.entries(intensities).forEach(([k, v]) => {
                                if (v > 0) normalized[k.toLowerCase()] = v / 100;
                            });

                            if (Object.keys(normalized).length > 0) {
                                // Use "global" as default nodeId if missing
                                await createPostReaction(post.id, {
                                    nodeId: post.node?.id || 'global', // Prefer actual node ID if available
                                    intensities: normalized
                                });
                                console.log('Reaction sent:', normalized);
                            }
                        } catch (e) {
                            console.error('Failed to send reaction:', e);
                        }
                    }} />

                    <TouchableOpacity
                        style={[styles.pillBtn, showComments && { borderColor: COLORS.node.accent, backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}
                        onPress={() => setShowComments(!showComments)}
                    >
                        <MessageSquare size={20} color={showComments ? COLORS.node.accent : COLORS.node.muted} />
                        <Text style={[styles.pillText, showComments && { color: '#fff' }]}>{post.commentCount}</Text>
                    </TouchableOpacity>



                    <TouchableOpacity style={styles.pillBtn}>
                        <Bookmark size={20} color={COLORS.node.muted} />
                        <Text style={[styles.pillText, { display: 'none' }]}>Save</Text>
                        {/* Hidden text for mobile optimization request */}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.pillBtn}>
                        <Share2 size={20} color={COLORS.node.muted} />
                        <Text style={[styles.pillText, { display: 'none' }]}>Share</Text>
                        {/* Hidden text for mobile optimization request */}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {showComments && (
                <View style={styles.commentsSection}>
                    {post.comments && post.comments.map((c, i) => (
                        <CommentNode
                            key={c.id}
                            comment={c}
                            isFirst={i === 0}
                            isLast={i === (post.comments?.length || 0) - 1}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

interface FeedProps {
    posts: UIPost[];
}

export const Feed = ({ posts }: FeedProps) => {
    return (
        <ScrollView style={{ flex: 1, backgroundColor: COLORS.node.bg }} contentContainerStyle={{ paddingBottom: 80, padding: 8 }}>
            {posts.map(p => <PostCard key={p.id} post={p} />)}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    /* !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
       !!! GOD MATH STYLES - DO NOT TOUCH                           !!! 
       !!! ELBOW: LEFT -21 | SPINE: LEFT -21 | BRIDGE: LEFT 7       !!!
       !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! */
    connectorElbow: {
        position: 'absolute',
        left: -21, // *** GOD MATH: 21PX FROM LEFT ***
        top: 0,
        width: 24,
        height: 11,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderBottomLeftRadius: 12,
        zIndex: 0
    },
    connectorSpine: {
        position: 'absolute',
        left: -21, // *** GOD MATH: 21PX FROM LEFT ***
        width: 2,
        zIndex: 0
    },
    bridgeLine: {
        position: 'absolute',
        left: 7, // *** GOD MATH: 7PX FROM LEFT ***
        top: 0,
        bottom: 0,
        width: 2,
        zIndex: 0,
        opacity: 0.5
    },
    /* !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! */

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
    }
});
