import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, ChevronRight, Zap, TrendingUp } from 'lucide-react-native';
import { COLORS, ERAS, TYPOGRAPHY, SPACING, RADIUS, BREAKPOINTS } from '../../constants/theme';

interface CredBreakdown {
    nodeId: string;
    nodeName: string;
    nodeSlug: string;
    cred: number;
}

interface CredDashboardProps {
    totalCred: number;
    credBreakdown: CredBreakdown[];
    eraStyle: typeof ERAS[keyof typeof ERAS];
    onViewHistory?: () => void;
}

// Animated number counter
const AnimatedCounter: React.FC<{ value: number; duration?: number; style?: any }> = ({
    value,
    duration = 1500,
    style,
}) => {
    const [displayValue, setDisplayValue] = useState(0);
    const animationRef = useRef<any>(null);

    useEffect(() => {
        let startTime: number;
        let startValue = displayValue;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            // Easing function for smooth deceleration
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);

            setDisplayValue(currentValue);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [value]);

    return <Text style={style}>{displayValue.toLocaleString()}</Text>;
};

export const CredDashboard: React.FC<CredDashboardProps> = ({
    totalCred,
    credBreakdown,
    eraStyle,
    onViewHistory,
}) => {
    const { width } = useWindowDimensions();
    const isTablet = width >= BREAKPOINTS.tablet;
    const isDesktop = width >= BREAKPOINTS.desktop;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                delay: 300,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                damping: 20,
                stiffness: 100,
                delay: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const maxNodeCred = credBreakdown.length > 0
        ? Math.max(...credBreakdown.map(n => n.cred))
        : 1;

    // Progress bar animation refs
    const barAnims = useRef(credBreakdown.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        // Staggered bar animations
        const animations = barAnims.map((anim, i) =>
            Animated.timing(anim, {
                toValue: 1,
                duration: 800,
                delay: 500 + i * 100,
                useNativeDriver: false, // width animation can't use native driver
            })
        );
        Animated.parallel(animations).start();
    }, [credBreakdown]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            {/* Glass background */}
            <View style={[styles.glassBackground, { borderColor: eraStyle.border }]} />

            <View style={styles.content}>
                {/* Header row */}
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <View style={[styles.iconBadge, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                            <Award size={20} color="#fbbf24" />
                        </View>
                        <View>
                            <Text style={styles.title}>Reputation</Text>
                            <Text style={styles.subtitle}>Your earned credibility</Text>
                        </View>
                    </View>

                    {/* Large cred display */}
                    <View style={styles.credDisplay}>
                        <Zap size={16} color="#fbbf24" style={{ marginRight: 4 }} />
                        <AnimatedCounter value={totalCred} style={styles.credValue} />
                    </View>
                </View>

                {/* Node breakdown */}
                {credBreakdown.length > 0 && (
                    <View style={styles.breakdown}>
                        <View style={styles.breakdownHeader}>
                            <Text style={styles.breakdownTitle}>Top Communities</Text>
                            <TrendingUp size={14} color={COLORS.node.muted} />
                        </View>

                        <View style={styles.nodeList}>
                            {credBreakdown.map((node, idx) => {
                                const percentage = (node.cred / maxNodeCred) * 100;
                                const barAnim = barAnims[idx];

                                return (
                                    <View key={node.nodeId} style={styles.nodeRow}>
                                        <View style={styles.nodeLeft}>
                                            <View style={[
                                                styles.rankBadge,
                                                idx === 0 && styles.rankBadgeGold,
                                                idx === 1 && styles.rankBadgeSilver,
                                                idx === 2 && styles.rankBadgeBronze,
                                            ]}>
                                                <Text style={[
                                                    styles.rankText,
                                                    idx === 0 && styles.rankTextGold,
                                                ]}>
                                                    {idx + 1}
                                                </Text>
                                            </View>
                                            <Text style={styles.nodeName} numberOfLines={1}>
                                                n/{node.nodeSlug}
                                            </Text>
                                        </View>

                                        <View style={styles.nodeRight}>
                                            <View style={styles.barContainer}>
                                                <View style={styles.barBg}>
                                                    <Animated.View
                                                        style={[
                                                            styles.barFill,
                                                            {
                                                                width: barAnim.interpolate({
                                                                    inputRange: [0, 1],
                                                                    outputRange: ['0%', `${percentage}%`],
                                                                }),
                                                                backgroundColor: idx === 0
                                                                    ? '#fbbf24'
                                                                    : eraStyle.text,
                                                            },
                                                        ]}
                                                    />
                                                </View>
                                            </View>
                                            <Text style={styles.nodeCredValue}>{node.cred}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* View history CTA */}
                {onViewHistory && (
                    <TouchableOpacity style={styles.viewHistory} onPress={onViewHistory}>
                        <Text style={[styles.viewHistoryText, { color: eraStyle.text }]}>
                            View Full History
                        </Text>
                        <ChevronRight size={16} color={eraStyle.text} />
                    </TouchableOpacity>
                )}
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
        backgroundColor: COLORS.node.panel, // Solid background for better visibility on dark theme
        borderWidth: 1,
        borderRadius: RADIUS.xl,
        // Shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.xl,
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
    credDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    credValue: {
        fontSize: TYPOGRAPHY.sizes.statLarge,
        fontWeight: '800',
        color: '#fbbf24',
        letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    },
    breakdown: {
        marginTop: SPACING.md,
    },
    breakdownHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    breakdownTitle: {
        fontSize: TYPOGRAPHY.sizes.xs,
        fontWeight: '600',
        color: COLORS.node.muted,
        textTransform: 'uppercase',
        letterSpacing: TYPOGRAPHY.letterSpacing.caps,
    },
    nodeList: {
        gap: SPACING.md,
    },
    nodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    nodeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        flex: 1,
        minWidth: 0,
    },
    rankBadge: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: COLORS.node.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankBadgeGold: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
    },
    rankBadgeSilver: {
        backgroundColor: 'rgba(148, 163, 184, 0.2)',
    },
    rankBadgeBronze: {
        backgroundColor: 'rgba(180, 83, 9, 0.2)',
    },
    rankText: {
        fontSize: TYPOGRAPHY.sizes.xs,
        fontWeight: '700',
        color: COLORS.node.text,
    },
    rankTextGold: {
        color: '#fbbf24',
    },
    nodeName: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '500',
        color: COLORS.node.text,
        flex: 1,
    },
    nodeRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        width: 140,
    },
    barContainer: {
        flex: 1,
    },
    barBg: {
        height: 6,
        backgroundColor: COLORS.node.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 3,
    },
    nodeCredValue: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '700',
        color: COLORS.node.text,
        width: 44,
        textAlign: 'right',
    },
    viewHistory: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: SPACING.xl,
        paddingTop: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.node.border,
    },
    viewHistoryText: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '600',
    },
});

export default CredDashboard;
