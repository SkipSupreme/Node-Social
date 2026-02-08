import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Heart, Users, Shield, Flame, Star } from 'lucide-react-native';
import { ERAS, TYPOGRAPHY, SPACING, RADIUS, BREAKPOINTS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';

interface StatConfig {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    suffix?: string;
    color: string;
    gradient: string[];
}

interface StatsOrbsProps {
    postsCount: number;
    followersCount: number;
    reactionsReceived: number;
    eraStyle: typeof ERAS[keyof typeof ERAS];
}

const StatOrb: React.FC<{
    config: StatConfig;
    index: number;
    isDesktop: boolean;
}> = ({ config, index, isDesktop }) => {
    const theme = useAppTheme();
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Staggered entrance
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                damping: 12,
                stiffness: 120,
                delay: 400 + index * 100,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 400,
                delay: 400 + index * 100,
                useNativeDriver: true,
            }),
        ]).start();

        // Subtle pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 2000 + index * 500,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0,
                    duration: 2000 + index * 500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [index]);

    return (
        <Animated.View
            style={[
                styles.orbContainer,
                {
                    opacity: opacityAnim,
                    transform: [{ scale: scaleAnim }],
                },
            ]}
        >
            {/* Glow effect */}
            <Animated.View
                style={[
                    styles.orbGlow,
                    {
                        backgroundColor: config.color,
                        opacity: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.1, 0.25],
                        }),
                    },
                ]}
            />

            {/* Glass card */}
            <View style={[styles.orbCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                {/* Icon container with gradient */}
                <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
                    {config.icon}
                </View>

                {/* Value */}
                <Text style={[styles.orbValue, { color: config.color }]}>
                    {typeof config.value === 'number'
                        ? config.value.toLocaleString()
                        : config.value}
                    {config.suffix && (
                        <Text style={styles.orbSuffix}>{config.suffix}</Text>
                    )}
                </Text>

                {/* Label */}
                <Text style={[styles.orbLabel, { color: theme.muted }]}>{config.label}</Text>
            </View>
        </Animated.View>
    );
};

export const StatsOrbs: React.FC<StatsOrbsProps> = ({
    postsCount,
    followersCount,
    reactionsReceived,
    eraStyle,
}) => {
    const { width } = useWindowDimensions();
    const isTablet = width >= BREAKPOINTS.tablet;
    const isDesktop = width >= BREAKPOINTS.desktop;

    const stats: StatConfig[] = [
        {
            icon: <Flame size={22} color="#f97316" />,
            label: 'Posts',
            value: postsCount,
            color: '#f97316',
            gradient: ['#ea580c', '#f97316'],
        },
        {
            icon: <Users size={22} color="#34d399" />,
            label: 'Followers',
            value: followersCount,
            color: '#34d399',
            gradient: ['#059669', '#34d399'],
        },
        {
            icon: <Heart size={22} color="#f87171" />,
            label: 'Reactions',
            value: reactionsReceived,
            color: '#f87171',
            gradient: ['#dc2626', '#f87171'],
        },
    ];

    return (
        <View style={[
            styles.container,
            isDesktop && styles.containerDesktop,
        ]}>
            {stats.map((stat, index) => (
                <StatOrb
                    key={stat.label}
                    config={stat}
                    index={index}
                    isDesktop={isDesktop}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    containerDesktop: {
        gap: SPACING.lg,
    },
    orbContainer: {
        flex: 1,
        position: 'relative',
    },
    orbGlow: {
        position: 'absolute',
        top: -10,
        left: -10,
        right: -10,
        bottom: -10,
        borderRadius: RADIUS.xl + 10,
        // Only show glow on web where blur filter works
        // On native, this would just show a colored box which looks bad
        ...Platform.select({
            web: {
                filter: 'blur(20px)',
            },
            default: {
                display: 'none', // Hide on native platforms
            },
        }),
    },
    orbCard: {
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        // Shadow for depth
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
        ...Platform.select({
            web: {
                backdropFilter: 'blur(12px)',
            },
        }),
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    orbValue: {
        fontSize: TYPOGRAPHY.sizes.h3,
        fontWeight: '800',
        letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    },
    orbSuffix: {
        fontSize: TYPOGRAPHY.sizes.body,
        fontWeight: '600',
    },
    orbLabel: {
        fontSize: TYPOGRAPHY.sizes.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: TYPOGRAPHY.letterSpacing.caps,
        marginTop: SPACING.xs,
    },
});

export default StatsOrbs;
