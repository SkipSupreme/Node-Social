import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { Clock, MessageSquare, Heart, Repeat, Bookmark, ChevronRight } from 'lucide-react-native';
import { COLORS, ERAS, TYPOGRAPHY, SPACING, RADIUS, BREAKPOINTS } from '../../constants/theme';

interface Activity {
    id: string;
    type: 'post' | 'comment' | 'reaction' | 'repost' | 'bookmark';
    title: string;
    timestamp: string;
    node?: string;
}

interface ActivityTimelineProps {
    activities: Activity[];
    eraStyle: typeof ERAS[keyof typeof ERAS];
    onActivityPress?: (activity: Activity) => void;
}

const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
        case 'post':
            return <MessageSquare size={14} color={COLORS.node.accent} />;
        case 'comment':
            return <MessageSquare size={14} color="#34d399" />;
        case 'reaction':
            return <Heart size={14} color="#f87171" />;
        case 'repost':
            return <Repeat size={14} color="#22d3ee" />;
        case 'bookmark':
            return <Bookmark size={14} color="#fbbf24" />;
        default:
            return <MessageSquare size={14} color={COLORS.node.muted} />;
    }
};

const getActivityColor = (type: Activity['type']): string => {
    switch (type) {
        case 'post':
            return COLORS.node.accent;
        case 'comment':
            return '#34d399';
        case 'reaction':
            return '#f87171';
        case 'repost':
            return '#22d3ee';
        case 'bookmark':
            return '#fbbf24';
        default:
            return COLORS.node.muted;
    }
};

const timeAgo = (date: string): string => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 7) return past.toLocaleDateString();
    if (diffDay > 0) return `${diffDay}d`;
    if (diffHour > 0) return `${diffHour}h`;
    if (diffMin > 0) return `${diffMin}m`;
    return 'now';
};

const ActivityItem: React.FC<{
    activity: Activity;
    index: number;
    isLast: boolean;
    eraStyle: typeof ERAS[keyof typeof ERAS];
    onPress?: () => void;
}> = ({ activity, index, isLast, eraStyle, onPress }) => {
    const slideAnim = useRef(new Animated.Value(30)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                damping: 15,
                stiffness: 100,
                delay: 500 + index * 80,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 300,
                delay: 500 + index * 80,
                useNativeDriver: true,
            }),
        ]).start();
    }, [index]);

    const activityColor = getActivityColor(activity.type);

    return (
        <Animated.View
            style={[
                styles.activityItem,
                {
                    opacity: opacityAnim,
                    transform: [{ translateX: slideAnim }],
                },
            ]}
        >
            {/* Timeline connector */}
            <View style={styles.timelineConnector}>
                <View style={[styles.timelineDot, { backgroundColor: activityColor }]} />
                {!isLast && <View style={styles.timelineLine} />}
            </View>

            {/* Content */}
            <TouchableOpacity
                style={styles.activityContent}
                onPress={onPress}
                activeOpacity={onPress ? 0.7 : 1}
            >
                <View style={styles.activityHeader}>
                    <View style={[styles.activityIconBadge, { backgroundColor: `${activityColor}15` }]}>
                        {getActivityIcon(activity.type)}
                    </View>
                    <Text style={styles.activityTime}>{timeAgo(activity.timestamp)}</Text>
                </View>

                <Text style={styles.activityTitle} numberOfLines={2}>
                    {activity.title}
                </Text>

                {activity.node && (
                    <View style={styles.activityMeta}>
                        <View style={[styles.nodeBadge, { borderColor: eraStyle.border }]}>
                            <Text style={[styles.nodeText, { color: eraStyle.text }]}>
                                n/{activity.node}
                            </Text>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
    activities,
    eraStyle,
    onActivityPress,
}) => {
    const { width } = useWindowDimensions();
    const isDesktop = width >= BREAKPOINTS.desktop;

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            delay: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    if (activities.length === 0) {
        return null;
    }

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {/* Glass background */}
            <View style={[styles.glassBackground, { borderColor: eraStyle.border }]} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <View style={[styles.iconBadge, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                            <Clock size={18} color={COLORS.node.muted} />
                        </View>
                        <View>
                            <Text style={styles.title}>Recent Activity</Text>
                            <Text style={styles.subtitle}>Your latest contributions</Text>
                        </View>
                    </View>
                </View>

                {/* Timeline */}
                <View style={styles.timeline}>
                    {activities.map((activity, index) => (
                        <ActivityItem
                            key={activity.id}
                            activity={activity}
                            index={index}
                            isLast={index === activities.length - 1}
                            eraStyle={eraStyle}
                            onPress={onActivityPress ? () => onActivityPress(activity) : undefined}
                        />
                    ))}
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        borderRadius: RADIUS.xl,
        overflow: 'hidden',
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: `${COLORS.node.panel}f5`,
        borderWidth: 1,
        borderRadius: RADIUS.xl,
        ...Platform.select({
            web: {
                backdropFilter: 'blur(12px)',
            },
        }),
    },
    content: {
        padding: SPACING.xl,
    },
    header: {
        marginBottom: SPACING.lg,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    iconBadge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: TYPOGRAPHY.sizes.h4,
        fontWeight: '700',
        color: COLORS.node.text,
        letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    },
    subtitle: {
        fontSize: TYPOGRAPHY.sizes.small,
        color: COLORS.node.muted,
        marginTop: 2,
    },
    timeline: {
        paddingLeft: SPACING.sm,
    },
    activityItem: {
        flexDirection: 'row',
        marginBottom: SPACING.md,
    },
    timelineConnector: {
        alignItems: 'center',
        width: 24,
        marginRight: SPACING.md,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 6,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: COLORS.node.border,
        marginTop: SPACING.xs,
    },
    activityContent: {
        flex: 1,
        paddingBottom: SPACING.md,
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.xs,
    },
    activityIconBadge: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityTime: {
        fontSize: TYPOGRAPHY.sizes.xs,
        color: COLORS.node.muted,
        fontWeight: '500',
    },
    activityTitle: {
        fontSize: TYPOGRAPHY.sizes.body,
        color: COLORS.node.text,
        lineHeight: TYPOGRAPHY.sizes.body * TYPOGRAPHY.lineHeights.normal,
    },
    activityMeta: {
        flexDirection: 'row',
        marginTop: SPACING.sm,
    },
    nodeBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
    },
    nodeText: {
        fontSize: TYPOGRAPHY.sizes.xs,
        fontWeight: '600',
    },
});

export default ActivityTimeline;
