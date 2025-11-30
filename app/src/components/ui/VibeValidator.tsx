import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import {
    Settings, TrendingUp, Clock, UserCheck, Sparkles, ChevronDown, ChevronUp,
    Zap, MessageSquare, Users, Eye, EyeOff, FileText, Image, Link2, Waypoints,
    Shuffle, Target, Award, Scale, Flame
} from './Icons';
import { COLORS } from '../../constants/theme';

// ============================================
// TYPES
// ============================================

type ValidatorMode = 'simple' | 'intermediate' | 'advanced' | 'expert';

interface Weights {
    quality: number;
    recency: number;
    engagement: number;
    personalization: number;
}

interface AdvancedSettings {
    // Quality sub-signals
    authorCredWeight: number;
    vectorQualityWeight: number;
    confidenceWeight: number;
    // Recency sub-signals
    timeDecay: number;
    velocity: number;
    freshness: number;
    halfLifeHours: number;
    decayFunction: 'exponential' | 'linear' | 'step';
    // Engagement sub-signals
    intensity: number;
    discussionDepth: number;
    shareWeight: number;
    expertCommentBonus: number;
    // Personalization sub-signals
    followingWeight: number;
    alignment: number;
    affinity: number;
    trustNetwork: number;
    // Vector overrides
    vectorMultipliers: {
        insightful: number;
        joy: number;
        fire: number;
        support: number;
        shock: number;
        questionable: number;
    };
    antiAlignmentPenalty: number;
}

interface IntermediateSettings {
    timeRange: '1h' | '6h' | '24h' | '7d' | 'all';
    discoveryRate: number;
    hideMutedWords: boolean;
    showSeenPosts: boolean;
    textOnly: boolean;
    mediaOnly: boolean;
    linksOnly: boolean;
    hasDiscussion: boolean;
}

interface ExpertSettings {
    maxPostsPerAuthor: number;
    topicClusteringPenalty: number;
    textRatio: number;
    imageRatio: number;
    videoRatio: number;
    linkRatio: number;
    explorationPool: 'global' | 'network' | 'node';
    enableExperiments: boolean;
    timeBasedProfiles: boolean;
    moodToggle: 'normal' | 'chill' | 'intense' | 'discovery';
}

export interface VibeValidatorSettings {
    preset?: string;
    weights: Weights;
    mode?: ValidatorMode;
    intermediate?: IntermediateSettings;
    advanced?: AdvancedSettings;
    expert?: ExpertSettings;
}

export interface VibeValidatorProps {
    settings: VibeValidatorSettings;
    onUpdate: (settings: VibeValidatorSettings) => void;
    onClose?: () => void; // Optional close handler - shows X button when provided
}

// ============================================
// PRESETS
// ============================================

const PRESETS = [
    {
        id: 'latest',
        name: 'Latest First',
        description: 'Newest posts at the top',
        icon: Clock,
        weights: { quality: 10, recency: 70, engagement: 10, personalization: 10 }
    },
    {
        id: 'balanced',
        name: 'Balanced',
        description: 'Mix of quality, fresh, and engaging',
        icon: Scale,
        weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 }
    },
    {
        id: 'hot',
        name: "What's Hot",
        description: 'Most engaging content right now',
        icon: Flame,
        weights: { quality: 20, recency: 25, engagement: 45, personalization: 10 }
    },
    {
        id: 'expert',
        name: 'Expert Voices',
        description: 'High-cred contributors only',
        icon: Award,
        weights: { quality: 60, recency: 15, engagement: 15, personalization: 10 }
    },
    {
        id: 'network',
        name: 'My Network',
        description: 'People you follow and trust',
        icon: Users,
        weights: { quality: 20, recency: 20, engagement: 10, personalization: 50 }
    },
];

const DEFAULT_INTERMEDIATE: IntermediateSettings = {
    timeRange: '24h',
    discoveryRate: 15,
    hideMutedWords: true,
    showSeenPosts: false,
    textOnly: false,
    mediaOnly: false,
    linksOnly: false,
    hasDiscussion: false,
};

const DEFAULT_ADVANCED: AdvancedSettings = {
    authorCredWeight: 50,
    vectorQualityWeight: 30,
    confidenceWeight: 20,
    timeDecay: 50,
    velocity: 30,
    freshness: 20,
    halfLifeHours: 24,
    decayFunction: 'exponential',
    intensity: 40,
    discussionDepth: 30,
    shareWeight: 15,
    expertCommentBonus: 15,
    followingWeight: 40,
    alignment: 25,
    affinity: 20,
    trustNetwork: 15,
    vectorMultipliers: {
        insightful: 100,
        joy: 100,
        fire: 100,
        support: 100,
        shock: 100,
        questionable: 100,
    },
    antiAlignmentPenalty: 20,
};

const DEFAULT_EXPERT: ExpertSettings = {
    maxPostsPerAuthor: 3,
    topicClusteringPenalty: 20,
    textRatio: 25,
    imageRatio: 25,
    videoRatio: 25,
    linkRatio: 25,
    explorationPool: 'global',
    enableExperiments: false,
    timeBasedProfiles: false,
    moodToggle: 'normal',
};

// ============================================
// HELPER COMPONENTS
// ============================================

const MiniBarChart = ({ weights }: { weights: Weights }) => {
    const total = weights.quality + weights.recency + weights.engagement + weights.personalization;
    const colors = ['#00BFFF', '#FFD700', '#FF4500', '#FF69B4'];
    const values = [weights.quality, weights.recency, weights.engagement, weights.personalization];

    return (
        <View style={miniStyles.container}>
            {values.map((val, i) => (
                <View key={i} style={miniStyles.barWrapper}>
                    <View style={[miniStyles.bar, { height: `${(val / total) * 100}%`, backgroundColor: colors[i] }]} />
                </View>
            ))}
        </View>
    );
};

const miniStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        height: 32,
        gap: 3,
        alignItems: 'flex-end',
    },
    barWrapper: {
        width: 6,
        height: '100%',
        backgroundColor: COLORS.node.border,
        borderRadius: 2,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    bar: {
        width: '100%',
        borderRadius: 2,
    },
});

interface SliderRowProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    color: string;
    icon?: React.ComponentType<{ size: number; color: string }>;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
}

const SliderRow = ({ label, value, onChange, color, icon: Icon, min = 0, max = 100, step = 1, suffix = '%' }: SliderRowProps) => (
    <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {Icon && <Icon size={14} color={color} />}
                <Text style={{ color: COLORS.node.text, fontWeight: '500', fontSize: 13 }}>{label}</Text>
            </View>
            <Text style={{ color: color, fontSize: 12, fontFamily: 'monospace' }}>{value}{suffix}</Text>
        </View>
        <Slider
            style={{ width: '100%', height: 28 }}
            minimumValue={min}
            maximumValue={max}
            step={step}
            value={value}
            onValueChange={onChange}
            minimumTrackTintColor={color}
            maximumTrackTintColor={COLORS.node.border}
            thumbTintColor={color}
        />
    </View>
);

const ToggleRow = ({ label, value, onChange, icon: Icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: any }) => (
    <View style={toggleStyles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {Icon && <Icon size={14} color={COLORS.node.muted} />}
            <Text style={toggleStyles.label}>{label}</Text>
        </View>
        <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: COLORS.node.border, true: `${COLORS.node.accent}50` }}
            thumbColor={value ? COLORS.node.accent : COLORS.node.muted}
        />
    </View>
);

const toggleStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    label: {
        color: COLORS.node.text,
        fontSize: 13,
    },
});

const CollapsibleSection = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <View style={collapseStyles.container}>
            <TouchableOpacity style={collapseStyles.header} onPress={() => setOpen(!open)}>
                <Text style={collapseStyles.title}>{title}</Text>
                {open ? <ChevronUp size={16} color={COLORS.node.muted} /> : <ChevronDown size={16} color={COLORS.node.muted} />}
            </TouchableOpacity>
            {open && <View style={collapseStyles.content}>{children}</View>}
        </View>
    );
};

const collapseStyles = StyleSheet.create({
    container: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    title: {
        color: COLORS.node.text,
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
});

// ============================================
// MODE COMPONENTS
// ============================================

const SimpleMode = ({ settings, onUpdate, activePreset, setActivePreset }: {
    settings: VibeValidatorSettings;
    onUpdate: (s: VibeValidatorSettings) => void;
    activePreset: string | null;
    setActivePreset: (p: string | null) => void;
}) => {
    const selectPreset = (preset: typeof PRESETS[0]) => {
        setActivePreset(preset.id);
        onUpdate({ ...settings, preset: preset.id, weights: preset.weights });
    };

    return (
        <View style={simpleStyles.container}>
            <View style={simpleStyles.grid}>
                {PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isActive = activePreset === preset.id;
                    return (
                        <TouchableOpacity
                            key={preset.id}
                            style={[simpleStyles.card, isActive && simpleStyles.cardActive]}
                            onPress={() => selectPreset(preset)}
                            activeOpacity={0.7}
                        >
                            <View style={[simpleStyles.iconCircle, isActive && simpleStyles.iconCircleActive]}>
                                <Icon size={20} color={isActive ? '#fff' : COLORS.node.accent} />
                            </View>
                            <View style={simpleStyles.cardContent}>
                                <Text style={[simpleStyles.cardTitle, isActive && simpleStyles.cardTitleActive]}>
                                    {preset.name}
                                </Text>
                                <Text style={simpleStyles.cardDesc}>{preset.description}</Text>
                            </View>
                            <MiniBarChart weights={preset.weights} />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const simpleStyles = StyleSheet.create({
    container: {
        padding: 16,
    },
    hint: {
        color: COLORS.node.muted,
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
    },
    grid: {
        gap: 10,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.node.bg,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        gap: 12,
    },
    cardActive: {
        borderColor: COLORS.node.accent,
        backgroundColor: `${COLORS.node.accent}15`,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: `${COLORS.node.accent}20`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleActive: {
        backgroundColor: COLORS.node.accent,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        color: COLORS.node.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    cardTitleActive: {
        color: COLORS.node.accent,
    },
    cardDesc: {
        color: COLORS.node.muted,
        fontSize: 11,
    },
});

const IntermediateMode = ({ settings, onUpdate }: {
    settings: VibeValidatorSettings;
    onUpdate: (s: VibeValidatorSettings) => void;
}) => {
    const weights = settings.weights;
    const intermediate = settings.intermediate || DEFAULT_INTERMEDIATE;

    const updateWeight = (key: keyof Weights, val: number) => {
        onUpdate({ ...settings, preset: 'custom', weights: { ...weights, [key]: val } });
    };

    const updateIntermediate = (key: keyof IntermediateSettings, val: any) => {
        onUpdate({ ...settings, intermediate: { ...intermediate, [key]: val } });
    };

    const timeRanges: IntermediateSettings['timeRange'][] = ['1h', '6h', '24h', '7d', 'all'];

    return (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Main Sliders */}
            <View style={intStyles.section}>
                <Text style={intStyles.sectionTitle}>Weight Distribution</Text>
                <SliderRow label="Quality" value={weights.quality} onChange={(v) => updateWeight('quality', v)} color="#00BFFF" icon={Sparkles} />
                <SliderRow label="Recency" value={weights.recency} onChange={(v) => updateWeight('recency', v)} color="#FFD700" icon={Clock} />
                <SliderRow label="Engagement" value={weights.engagement} onChange={(v) => updateWeight('engagement', v)} color="#FF4500" icon={TrendingUp} />
                <SliderRow label="Personalization" value={weights.personalization} onChange={(v) => updateWeight('personalization', v)} color="#FF69B4" icon={UserCheck} />
            </View>

            {/* Time Range */}
            <View style={intStyles.section}>
                <Text style={intStyles.sectionTitle}>Time Range</Text>
                <View style={intStyles.pillRow}>
                    {timeRanges.map((range) => (
                        <TouchableOpacity
                            key={range}
                            style={[intStyles.pill, intermediate.timeRange === range && intStyles.pillActive]}
                            onPress={() => updateIntermediate('timeRange', range)}
                        >
                            <Text style={[intStyles.pillText, intermediate.timeRange === range && intStyles.pillTextActive]}>
                                {range === 'all' ? 'All Time' : range}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Discovery Rate */}
            <View style={intStyles.section}>
                <SliderRow
                    label="Discovery Rate"
                    value={intermediate.discoveryRate}
                    onChange={(v) => updateIntermediate('discoveryRate', v)}
                    color={COLORS.node.accent}
                    icon={Shuffle}
                />
                <Text style={intStyles.hint}>Higher = more content outside your usual preferences</Text>
            </View>

            {/* Quick Toggles */}
            <View style={intStyles.section}>
                <Text style={intStyles.sectionTitle}>Quick Filters</Text>
                <ToggleRow label="Hide muted words" value={intermediate.hideMutedWords} onChange={(v) => updateIntermediate('hideMutedWords', v)} icon={EyeOff} />
                <ToggleRow label="Show seen posts" value={intermediate.showSeenPosts} onChange={(v) => updateIntermediate('showSeenPosts', v)} icon={Eye} />
                <ToggleRow label="Text only" value={intermediate.textOnly} onChange={(v) => updateIntermediate('textOnly', v)} icon={FileText} />
                <ToggleRow label="Media only" value={intermediate.mediaOnly} onChange={(v) => updateIntermediate('mediaOnly', v)} icon={Image} />
                <ToggleRow label="Links only" value={intermediate.linksOnly} onChange={(v) => updateIntermediate('linksOnly', v)} icon={Link2} />
                <ToggleRow label="Has discussion" value={intermediate.hasDiscussion} onChange={(v) => updateIntermediate('hasDiscussion', v)} icon={MessageSquare} />
            </View>
        </ScrollView>
    );
};

const intStyles = StyleSheet.create({
    section: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    sectionTitle: {
        color: COLORS.node.muted,
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    pillRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: COLORS.node.bg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    pillActive: {
        borderColor: COLORS.node.accent,
        backgroundColor: `${COLORS.node.accent}20`,
    },
    pillText: {
        color: COLORS.node.muted,
        fontSize: 13,
    },
    pillTextActive: {
        color: COLORS.node.accent,
        fontWeight: '600',
    },
    hint: {
        color: COLORS.node.muted,
        fontSize: 11,
        marginTop: 4,
    },
});

const AdvancedMode = ({ settings, onUpdate }: {
    settings: VibeValidatorSettings;
    onUpdate: (s: VibeValidatorSettings) => void;
}) => {
    const advanced = settings.advanced || DEFAULT_ADVANCED;

    const updateAdvanced = (key: keyof AdvancedSettings, val: any) => {
        onUpdate({ ...settings, advanced: { ...advanced, [key]: val } });
    };

    const updateVectorMultiplier = (vector: keyof AdvancedSettings['vectorMultipliers'], val: number) => {
        onUpdate({
            ...settings,
            advanced: {
                ...advanced,
                vectorMultipliers: { ...advanced.vectorMultipliers, [vector]: val }
            }
        });
    };

    return (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <CollapsibleSection title="Quality Sub-Signals" defaultOpen>
                <SliderRow label="Author Cred Weight" value={advanced.authorCredWeight} onChange={(v) => updateAdvanced('authorCredWeight', v)} color="#00BFFF" />
                <SliderRow label="Vector Quality Weight" value={advanced.vectorQualityWeight} onChange={(v) => updateAdvanced('vectorQualityWeight', v)} color="#00BFFF" />
                <SliderRow label="Confidence Weight" value={advanced.confidenceWeight} onChange={(v) => updateAdvanced('confidenceWeight', v)} color="#00BFFF" />
            </CollapsibleSection>

            <CollapsibleSection title="Recency Sub-Signals">
                <SliderRow label="Time Decay" value={advanced.timeDecay} onChange={(v) => updateAdvanced('timeDecay', v)} color="#FFD700" />
                <SliderRow label="Velocity" value={advanced.velocity} onChange={(v) => updateAdvanced('velocity', v)} color="#FFD700" />
                <SliderRow label="Freshness" value={advanced.freshness} onChange={(v) => updateAdvanced('freshness', v)} color="#FFD700" />
                <SliderRow label="Half-life (hours)" value={advanced.halfLifeHours} onChange={(v) => updateAdvanced('halfLifeHours', v)} color="#FFD700" min={1} max={168} suffix="h" />
            </CollapsibleSection>

            <CollapsibleSection title="Engagement Sub-Signals">
                <SliderRow label="Intensity" value={advanced.intensity} onChange={(v) => updateAdvanced('intensity', v)} color="#FF4500" />
                <SliderRow label="Discussion Depth" value={advanced.discussionDepth} onChange={(v) => updateAdvanced('discussionDepth', v)} color="#FF4500" />
                <SliderRow label="Share Weight" value={advanced.shareWeight} onChange={(v) => updateAdvanced('shareWeight', v)} color="#FF4500" />
                <SliderRow label="Expert Comment Bonus" value={advanced.expertCommentBonus} onChange={(v) => updateAdvanced('expertCommentBonus', v)} color="#FF4500" />
            </CollapsibleSection>

            <CollapsibleSection title="Personalization Sub-Signals">
                <SliderRow label="Following Weight" value={advanced.followingWeight} onChange={(v) => updateAdvanced('followingWeight', v)} color="#FF69B4" />
                <SliderRow label="Alignment" value={advanced.alignment} onChange={(v) => updateAdvanced('alignment', v)} color="#FF69B4" />
                <SliderRow label="Affinity" value={advanced.affinity} onChange={(v) => updateAdvanced('affinity', v)} color="#FF69B4" />
                <SliderRow label="Trust Network" value={advanced.trustNetwork} onChange={(v) => updateAdvanced('trustNetwork', v)} color="#FF69B4" />
            </CollapsibleSection>

            <CollapsibleSection title="Vector Multipliers">
                <SliderRow label="Insightful" value={advanced.vectorMultipliers.insightful} onChange={(v) => updateVectorMultiplier('insightful', v)} color="#00BFFF" max={200} />
                <SliderRow label="Joy" value={advanced.vectorMultipliers.joy} onChange={(v) => updateVectorMultiplier('joy', v)} color="#FFD700" max={200} />
                <SliderRow label="Fire" value={advanced.vectorMultipliers.fire} onChange={(v) => updateVectorMultiplier('fire', v)} color="#FF4500" max={200} />
                <SliderRow label="Support" value={advanced.vectorMultipliers.support} onChange={(v) => updateVectorMultiplier('support', v)} color="#FF69B4" max={200} />
                <SliderRow label="Shock" value={advanced.vectorMultipliers.shock} onChange={(v) => updateVectorMultiplier('shock', v)} color="#32CD32" max={200} />
                <SliderRow label="Questionable" value={advanced.vectorMultipliers.questionable} onChange={(v) => updateVectorMultiplier('questionable', v)} color="#9370DB" max={200} />
            </CollapsibleSection>

            <View style={{ padding: 16 }}>
                <SliderRow label="Anti-Alignment Penalty" value={advanced.antiAlignmentPenalty} onChange={(v) => updateAdvanced('antiAlignmentPenalty', v)} color={COLORS.node.accent} />
                <Text style={intStyles.hint}>Penalize content too similar to what you usually engage with</Text>
            </View>
        </ScrollView>
    );
};

const ExpertMode = ({ settings, onUpdate }: {
    settings: VibeValidatorSettings;
    onUpdate: (s: VibeValidatorSettings) => void;
}) => {
    const expert = settings.expert || DEFAULT_EXPERT;

    const updateExpert = (key: keyof ExpertSettings, val: any) => {
        onUpdate({ ...settings, expert: { ...expert, [key]: val } });
    };

    const pools: ExpertSettings['explorationPool'][] = ['global', 'network', 'node'];
    const moods: ExpertSettings['moodToggle'][] = ['normal', 'chill', 'intense', 'discovery'];

    return (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <CollapsibleSection title="Diversity Controls" defaultOpen>
                <SliderRow label="Max Posts Per Author" value={expert.maxPostsPerAuthor} onChange={(v) => updateExpert('maxPostsPerAuthor', v)} color={COLORS.node.accent} min={1} max={10} suffix="" />
                <SliderRow label="Topic Clustering Penalty" value={expert.topicClusteringPenalty} onChange={(v) => updateExpert('topicClusteringPenalty', v)} color={COLORS.node.accent} />
            </CollapsibleSection>

            <CollapsibleSection title="Content Type Targeting">
                <SliderRow label="Text Ratio" value={expert.textRatio} onChange={(v) => updateExpert('textRatio', v)} color="#00BFFF" icon={FileText} />
                <SliderRow label="Image Ratio" value={expert.imageRatio} onChange={(v) => updateExpert('imageRatio', v)} color="#FFD700" icon={Image} />
                <SliderRow label="Video Ratio" value={expert.videoRatio} onChange={(v) => updateExpert('videoRatio', v)} color="#FF4500" />
                <SliderRow label="Link Ratio" value={expert.linkRatio} onChange={(v) => updateExpert('linkRatio', v)} color="#FF69B4" icon={Link2} />
            </CollapsibleSection>

            <CollapsibleSection title="Exploration Pool">
                <View style={intStyles.pillRow}>
                    {pools.map((pool) => (
                        <TouchableOpacity
                            key={pool}
                            style={[intStyles.pill, expert.explorationPool === pool && intStyles.pillActive]}
                            onPress={() => updateExpert('explorationPool', pool)}
                        >
                            <Text style={[intStyles.pillText, expert.explorationPool === pool && intStyles.pillTextActive]}>
                                {pool.charAt(0).toUpperCase() + pool.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </CollapsibleSection>

            <CollapsibleSection title="Mood Toggles">
                <View style={intStyles.pillRow}>
                    {moods.map((mood) => (
                        <TouchableOpacity
                            key={mood}
                            style={[intStyles.pill, expert.moodToggle === mood && intStyles.pillActive]}
                            onPress={() => updateExpert('moodToggle', mood)}
                        >
                            <Text style={[intStyles.pillText, expert.moodToggle === mood && intStyles.pillTextActive]}>
                                {mood.charAt(0).toUpperCase() + mood.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={[intStyles.hint, { marginTop: 8 }]}>Temporary algorithm shift based on your current mood</Text>
            </CollapsibleSection>

            <View style={{ padding: 16 }}>
                <ToggleRow label="Enable A/B Experiments" value={expert.enableExperiments} onChange={(v) => updateExpert('enableExperiments', v)} icon={Zap} />
                <ToggleRow label="Time-based Profiles" value={expert.timeBasedProfiles} onChange={(v) => updateExpert('timeBasedProfiles', v)} icon={Clock} />
            </View>

            <View style={expertStyles.warningBox}>
                <Text style={expertStyles.warningTitle}>Expert Mode</Text>
                <Text style={expertStyles.warningText}>
                    These settings give you fine-grained control over your feed algorithm.
                    Changes here can significantly affect your experience.
                </Text>
            </View>
        </ScrollView>
    );
};

const expertStyles = StyleSheet.create({
    warningBox: {
        margin: 16,
        padding: 16,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    warningTitle: {
        color: '#fbbf24',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    warningText: {
        color: COLORS.node.muted,
        fontSize: 12,
        lineHeight: 18,
    },
});

// ============================================
// MAIN COMPONENT
// ============================================

export const VibeValidator = ({ settings, onUpdate, onClose }: VibeValidatorProps) => {
    const [mode, setMode] = useState<ValidatorMode>(settings.mode || 'simple');
    const [activePreset, setActivePreset] = useState<string | null>(settings.preset || 'balanced');

    const modes: { id: ValidatorMode; label: string; users: string }[] = [
        { id: 'simple', label: 'Simple', users: '90%' },
        { id: 'intermediate', label: 'Tuner', users: '8%' },
        { id: 'advanced', label: 'Advanced', users: '1.5%' },
        { id: 'expert', label: 'Expert', users: '0.5%' },
    ];

    const handleModeChange = (newMode: ValidatorMode) => {
        setMode(newMode);
        onUpdate({ ...settings, mode: newMode });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Waypoints size={20} color={COLORS.node.accent} />
                        <Text style={styles.title}>Vibe Validator</Text>
                    </View>
                    {onClose && (
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeX}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={styles.subtitle}>Control your feed algorithm</Text>
            </View>

            {/* Mode Tabs */}
            <View style={styles.modeTabs}>
                {modes.map((m) => (
                    <TouchableOpacity
                        key={m.id}
                        style={[styles.modeTab, mode === m.id && styles.modeTabActive]}
                        onPress={() => handleModeChange(m.id)}
                    >
                        <Text style={[styles.modeTabText, mode === m.id && styles.modeTabTextActive]}>
                            {m.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Mode Content */}
            <View style={{ flex: 1 }}>
                {mode === 'simple' && (
                    <SimpleMode
                        settings={settings}
                        onUpdate={onUpdate}
                        activePreset={activePreset}
                        setActivePreset={setActivePreset}
                    />
                )}
                {mode === 'intermediate' && (
                    <IntermediateMode settings={settings} onUpdate={onUpdate} />
                )}
                {mode === 'advanced' && (
                    <AdvancedMode settings={settings} onUpdate={onUpdate} />
                )}
                {mode === 'expert' && (
                    <ExpertMode settings={settings} onUpdate={onUpdate} />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.node.panel,
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: COLORS.node.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeX: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.node.text,
        lineHeight: 22,
    },
    title: {
        color: COLORS.node.text,
        fontSize: 18,
        fontWeight: '700',
    },
    subtitle: {
        color: COLORS.node.muted,
        fontSize: 12,
        marginTop: 4,
    },
    modeTabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    modeTab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    modeTabActive: {
        borderBottomColor: COLORS.node.accent,
    },
    modeTabText: {
        color: COLORS.node.muted,
        fontSize: 12,
        fontWeight: '500',
    },
    modeTabTextActive: {
        color: COLORS.node.accent,
        fontWeight: '600',
    },
});
