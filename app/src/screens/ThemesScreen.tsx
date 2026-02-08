import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    FlatList,
    ActivityIndicator,
    TextInput,
    Platform,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Download,
    Eye,
    EyeOff,
    Palette,
    Share2,
    Check,
    Copy,
    ClipboardPaste,
    X,
} from 'lucide-react-native';
import { useAppTheme } from '../hooks/useTheme';
import { useThemeStore, type ThemeTokens } from '../store/theme';
import {
    getSharedThemes,
    installTheme,
    shareTheme,
    updateProfile,
    type SharedTheme,
} from '../lib/api';

// ── Types ──────────────────────────────────────────────────────
interface ThemesScreenProps {
    onBack: () => void;
    onEditTheme?: () => void;
}

type SortMode = 'popular' | 'newest' | 'rating';

const SORT_TABS: { key: SortMode; label: string }[] = [
    { key: 'popular', label: 'Popular' },
    { key: 'newest', label: 'Newest' },
    { key: 'rating', label: 'Top Rated' },
];

// Key colors to show in preview strip
const PREVIEW_KEYS: (keyof ThemeTokens)[] = ['bg', 'panel', 'text', 'accent', 'border'];

// ── Component ──────────────────────────────────────────────────
export const ThemesScreen = ({ onBack, onEditTheme }: ThemesScreenProps) => {
    const theme = useAppTheme();
    const { setPreviewTheme, clearPreview, setUserTheme, previewTheme } = useThemeStore();

    // ── State ─────────────────────────────────────────────────
    const [themes, setThemes] = useState<SharedTheme[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>('popular');
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [installingId, setInstallingId] = useState<string | null>(null);
    const [installedId, setInstalledId] = useState<string | null>(null);

    // Share form state
    const [showShareForm, setShowShareForm] = useState(false);
    const [shareName, setShareName] = useState('');
    const [shareDescription, setShareDescription] = useState('');
    const [sharing, setSharing] = useState(false);

    // Import / Export
    const [showImport, setShowImport] = useState(false);
    const [importJson, setImportJson] = useState('');
    const [importError, setImportError] = useState('');
    const [exportCopied, setExportCopied] = useState(false);

    // Track if previewing
    const isPreviewing = previewTheme !== null;

    // ── Fetching ──────────────────────────────────────────────
    const fetchThemes = useCallback(
        async (sort: SortMode, cursor?: string) => {
            try {
                const res = await getSharedThemes(sort, 20, cursor);
                if (cursor) {
                    setThemes((prev) => [...prev, ...res.themes]);
                } else {
                    setThemes(res.themes);
                }
                setNextCursor(res.nextCursor);
                setHasMore(res.hasMore);
            } catch (err) {
                console.error('[ThemesScreen] fetch error:', err);
            }
        },
        [],
    );

    // Initial fetch & sort change
    const lastSort = useRef<SortMode | null>(null);
    React.useEffect(() => {
        if (lastSort.current !== sortMode) {
            lastSort.current = sortMode;
            setLoading(true);
            fetchThemes(sortMode).finally(() => setLoading(false));
        }
    }, [sortMode, fetchThemes]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchThemes(sortMode);
        setRefreshing(false);
    }, [sortMode, fetchThemes]);

    const handleLoadMore = useCallback(async () => {
        if (!hasMore || loadingMore || !nextCursor) return;
        setLoadingMore(true);
        await fetchThemes(sortMode, nextCursor);
        setLoadingMore(false);
    }, [hasMore, loadingMore, nextCursor, sortMode, fetchThemes]);

    // ── Actions ───────────────────────────────────────────────
    const handleTryTheme = useCallback(
        (tokens: Record<string, unknown>) => {
            setPreviewTheme(tokens as Partial<ThemeTokens>);
        },
        [setPreviewTheme],
    );

    const handleStopPreview = useCallback(() => {
        clearPreview();
    }, [clearPreview]);

    const handleInstallTheme = useCallback(
        async (id: string, tokens: Record<string, unknown>) => {
            setInstallingId(id);
            try {
                await installTheme(id);
                setUserTheme(tokens as Partial<ThemeTokens>);
                await updateProfile({ customTheme: tokens });
                // Clear any active preview since we're committing
                clearPreview();
                setInstalledId(id);
                setTimeout(() => setInstalledId(null), 2000);
            } catch (err) {
                console.error('[ThemesScreen] install error:', err);
                if (Platform.OS === 'web') {
                    window.alert?.('Failed to install theme. Please try again.');
                } else {
                    Alert.alert('Error', 'Failed to install theme. Please try again.');
                }
            } finally {
                setInstallingId(null);
            }
        },
        [setUserTheme, clearPreview],
    );

    const handleShare = useCallback(async () => {
        if (!shareName.trim()) return;
        setSharing(true);
        try {
            const currentTheme = useThemeStore.getState().userTheme;
            const result = await shareTheme({
                name: shareName.trim(),
                description: shareDescription.trim() || undefined,
                tokens: currentTheme as unknown as Record<string, unknown>,
            });
            // Add to local list at the top
            setThemes((prev) => [result, ...prev]);
            setShowShareForm(false);
            setShareName('');
            setShareDescription('');
        } catch (err) {
            console.error('[ThemesScreen] share error:', err);
            if (Platform.OS === 'web') {
                window.alert?.('Failed to share theme. Please try again.');
            } else {
                Alert.alert('Error', 'Failed to share theme. Please try again.');
            }
        } finally {
            setSharing(false);
        }
    }, [shareName, shareDescription]);

    // ── Import / Export ───────────────────────────────────────
    const handleExport = useCallback(async () => {
        const currentTheme = useThemeStore.getState().userTheme;
        const json = JSON.stringify(currentTheme, null, 2);
        try {
            if (Platform.OS === 'web' && navigator.clipboard) {
                await navigator.clipboard.writeText(json);
            }
            setExportCopied(true);
            setTimeout(() => setExportCopied(false), 2000);
        } catch {
            console.error('[ThemesScreen] clipboard error');
        }
    }, []);

    const handleImport = useCallback(() => {
        setImportError('');
        try {
            const parsed = JSON.parse(importJson.trim());
            if (typeof parsed !== 'object' || parsed === null || !parsed.bg) {
                setImportError('Invalid theme JSON — must contain at least a "bg" key.');
                return;
            }
            setUserTheme(parsed as Partial<ThemeTokens>);
            updateProfile({ customTheme: parsed }).catch(() => {});
            setShowImport(false);
            setImportJson('');
        } catch {
            setImportError('Invalid JSON. Please check the format and try again.');
        }
    }, [importJson, setUserTheme]);

    // ── Render helpers ────────────────────────────────────────
    const renderSortTabs = useMemo(
        () => (
            <View style={[styles.sortRow, { borderBottomColor: theme.border }]}>
                {SORT_TABS.map((tab) => {
                    const active = tab.key === sortMode;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setSortMode(tab.key)}
                            style={[
                                styles.sortTab,
                                active && { borderBottomColor: theme.accent, borderBottomWidth: 2 },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.sortTabText,
                                    { color: active ? theme.accent : theme.muted },
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        ),
        [sortMode, theme.accent, theme.muted, theme.border],
    );

    const renderThemeCard = useCallback(
        ({ item }: { item: SharedTheme }) => {
            const tokens = item.tokens as Record<string, string>;
            const isInstalling = installingId === item.id;
            const justInstalled = installedId === item.id;

            return (
                <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                    {/* Color preview strip */}
                    <View style={styles.colorStrip}>
                        {PREVIEW_KEYS.map((key) => (
                            <View
                                key={key}
                                style={[
                                    styles.colorDot,
                                    { backgroundColor: tokens[key] || theme.muted },
                                ]}
                            />
                        ))}
                    </View>

                    <View style={styles.cardBody}>
                        {/* Meta */}
                        <View style={styles.cardMeta}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.themeName, { color: theme.text }]} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <Text style={[styles.authorText, { color: theme.muted }]} numberOfLines={1}>
                                    by @{item.author?.username ?? 'unknown'}
                                </Text>
                            </View>
                            <View style={styles.installBadge}>
                                <Download size={12} color={theme.muted} />
                                <Text style={[styles.installCount, { color: theme.muted }]}>
                                    {item.installs}
                                </Text>
                            </View>
                        </View>

                        {item.description ? (
                            <Text
                                style={[styles.description, { color: theme.textSecondary }]}
                                numberOfLines={2}
                            >
                                {item.description}
                            </Text>
                        ) : null}

                        {/* Action buttons */}
                        <View style={styles.actions}>
                            <Pressable
                                onPress={() => handleTryTheme(item.tokens)}
                                style={[
                                    styles.actionBtn,
                                    { backgroundColor: theme.bg, borderColor: theme.border },
                                ]}
                            >
                                <Eye size={14} color={theme.accent} />
                                <Text style={[styles.actionBtnText, { color: theme.text }]}>
                                    Try It
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => handleInstallTheme(item.id, item.tokens)}
                                disabled={isInstalling}
                                style={[
                                    styles.actionBtn,
                                    {
                                        backgroundColor: justInstalled ? '#10b981' : theme.accent,
                                        borderColor: justInstalled ? '#10b981' : theme.accent,
                                    },
                                ]}
                            >
                                {isInstalling ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : justInstalled ? (
                                    <>
                                        <Check size={14} color="#fff" />
                                        <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                                            Installed!
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Download size={14} color="#fff" />
                                        <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                                            Use This
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            );
        },
        [theme, installingId, installedId, handleTryTheme, handleInstallTheme],
    );

    const keyExtractor = useCallback((item: SharedTheme) => item.id, []);

    const ListHeader = useMemo(
        () => (
            <View>
                {/* Action bar: Share + Edit */}
                <View style={styles.actionBar}>
                    <Pressable
                        onPress={() => setShowShareForm((v) => !v)}
                        style={[styles.topBtn, { backgroundColor: theme.accent }]}
                    >
                        <Share2 size={16} color="#fff" />
                        <Text style={styles.topBtnText}>Share My Theme</Text>
                    </Pressable>

                    {onEditTheme && (
                        <Pressable
                            onPress={onEditTheme}
                            style={[styles.topBtn, { backgroundColor: theme.panel, borderColor: theme.border, borderWidth: 1 }]}
                        >
                            <Palette size={16} color={theme.accent} />
                            <Text style={[styles.topBtnText, { color: theme.text }]}>
                                Edit My Theme
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* Share form */}
                {showShareForm && (
                    <View style={[styles.shareForm, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                        <Text style={[styles.shareFormTitle, { color: theme.text }]}>
                            Share Your Theme
                        </Text>
                        <Text style={[styles.shareFormHint, { color: theme.muted }]}>
                            Your current theme will be shared to the marketplace.
                        </Text>

                        <TextInput
                            placeholder="Theme name"
                            placeholderTextColor={theme.muted}
                            value={shareName}
                            onChangeText={setShareName}
                            style={[
                                styles.input,
                                { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border },
                            ]}
                        />
                        <TextInput
                            placeholder="Description (optional)"
                            placeholderTextColor={theme.muted}
                            value={shareDescription}
                            onChangeText={setShareDescription}
                            multiline
                            style={[
                                styles.input,
                                styles.inputMultiline,
                                { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border },
                            ]}
                        />

                        <View style={styles.shareFormActions}>
                            <Pressable
                                onPress={() => setShowShareForm(false)}
                                style={[styles.cancelBtn, { borderColor: theme.border }]}
                            >
                                <Text style={{ color: theme.muted }}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleShare}
                                disabled={sharing || !shareName.trim()}
                                style={[
                                    styles.submitBtn,
                                    {
                                        backgroundColor: shareName.trim() ? theme.accent : theme.border,
                                    },
                                ]}
                            >
                                {sharing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.submitBtnText}>Share</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* Sort tabs */}
                {renderSortTabs}
            </View>
        ),
        [
            theme,
            onEditTheme,
            showShareForm,
            shareName,
            shareDescription,
            sharing,
            handleShare,
            renderSortTabs,
        ],
    );

    const ListFooter = useMemo(
        () => (
            <View style={styles.footer}>
                {loadingMore && (
                    <ActivityIndicator
                        size="small"
                        color={theme.accent}
                        style={{ marginVertical: 16 }}
                    />
                )}

                {/* Import / Export section */}
                <View style={[styles.ioSection, { borderTopColor: theme.border }]}>
                    <Text style={[styles.ioTitle, { color: theme.text }]}>
                        Import / Export
                    </Text>

                    <View style={styles.ioRow}>
                        <Pressable
                            onPress={handleExport}
                            style={[styles.ioBtn, { backgroundColor: theme.panel, borderColor: theme.border }]}
                        >
                            {exportCopied ? (
                                <Check size={16} color="#10b981" />
                            ) : (
                                <Copy size={16} color={theme.accent} />
                            )}
                            <Text style={[styles.ioBtnText, { color: theme.text }]}>
                                {exportCopied ? 'Copied!' : 'Export Theme'}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => setShowImport((v) => !v)}
                            style={[styles.ioBtn, { backgroundColor: theme.panel, borderColor: theme.border }]}
                        >
                            <ClipboardPaste size={16} color={theme.accent} />
                            <Text style={[styles.ioBtnText, { color: theme.text }]}>
                                Import Theme
                            </Text>
                        </Pressable>
                    </View>

                    {showImport && (
                        <View style={[styles.importBox, { borderColor: theme.border }]}>
                            <TextInput
                                placeholder='Paste theme JSON here...'
                                placeholderTextColor={theme.muted}
                                value={importJson}
                                onChangeText={(t) => {
                                    setImportJson(t);
                                    setImportError('');
                                }}
                                multiline
                                style={[
                                    styles.importInput,
                                    { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border },
                                ]}
                            />
                            {importError ? (
                                <Text style={styles.importError}>{importError}</Text>
                            ) : null}
                            <View style={styles.importActions}>
                                <Pressable
                                    onPress={() => {
                                        setShowImport(false);
                                        setImportJson('');
                                        setImportError('');
                                    }}
                                    style={[styles.cancelBtn, { borderColor: theme.border }]}
                                >
                                    <Text style={{ color: theme.muted }}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleImport}
                                    disabled={!importJson.trim()}
                                    style={[
                                        styles.submitBtn,
                                        {
                                            backgroundColor: importJson.trim()
                                                ? theme.accent
                                                : theme.border,
                                        },
                                    ]}
                                >
                                    <Text style={styles.submitBtnText}>Apply</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>

                <View style={{ height: isPreviewing ? 80 : 24 }} />
            </View>
        ),
        [
            loadingMore,
            theme,
            handleExport,
            exportCopied,
            showImport,
            importJson,
            importError,
            handleImport,
            isPreviewing,
        ],
    );

    // ── Render ────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.panel }]}>
                <Pressable onPress={onBack} style={[styles.backButton, { backgroundColor: theme.bg }]}>
                    <ArrowLeft color={theme.text} size={22} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Themes</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : (
                <FlatList
                    data={themes}
                    renderItem={renderThemeCard}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={ListHeader}
                    ListFooterComponent={ListFooter}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Palette size={48} color={theme.muted} />
                            <Text style={[styles.emptyText, { color: theme.muted }]}>
                                No themes shared yet.{'\n'}Be the first to share yours!
                            </Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContent}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={theme.accent}
                            colors={[theme.accent]}
                        />
                    }
                    initialNumToRender={8}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    removeClippedSubviews={Platform.OS !== 'web'}
                />
            )}

            {/* Preview floating bar */}
            {isPreviewing && (
                <View
                    style={[
                        styles.previewBar,
                        {
                            backgroundColor: theme.panel,
                            borderColor: theme.border,
                            boxShadow: '0px -2px 12px rgba(0, 0, 0, 0.4)',
                        },
                    ]}
                >
                    <View style={styles.previewBarInner}>
                        <EyeOff size={18} color={theme.accent} />
                        <Text style={[styles.previewBarText, { color: theme.text }]}>
                            Previewing theme…
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleStopPreview}
                        style={[styles.stopPreviewBtn, { backgroundColor: theme.accent }]}
                    >
                        <X size={14} color="#fff" />
                        <Text style={styles.stopPreviewText}>Stop Preview</Text>
                    </Pressable>
                </View>
            )}
        </SafeAreaView>
    );
};

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
    },

    // Action bar
    actionBar: {
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 16,
    },
    topBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    topBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },

    // Sort tabs
    sortRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginBottom: 12,
    },
    sortTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    sortTabText: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Theme card
    card: {
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
        overflow: 'hidden',
    },
    colorStrip: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    colorDot: {
        width: 24,
        height: 24,
        borderRadius: 6,
    },
    cardBody: {
        paddingHorizontal: 14,
        paddingBottom: 14,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    themeName: {
        fontSize: 16,
        fontWeight: '700',
    },
    authorText: {
        fontSize: 12,
        marginTop: 2,
    },
    installBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    installCount: {
        fontSize: 12,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 10,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Share form
    shareForm: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    shareFormTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    shareFormHint: {
        fontSize: 13,
        marginBottom: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        marginBottom: 10,
    },
    inputMultiline: {
        minHeight: 60,
        textAlignVertical: 'top',
    },
    shareFormActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 4,
    },
    cancelBtn: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    submitBtn: {
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 8,
        minWidth: 80,
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },

    // Empty state
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 16,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
    },

    // Footer / IO section
    footer: {},
    ioSection: {
        borderTopWidth: 1,
        paddingTop: 20,
        marginTop: 12,
    },
    ioTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    ioRow: {
        flexDirection: 'row',
        gap: 10,
    },
    ioBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    ioBtnText: {
        fontWeight: '600',
        fontSize: 14,
    },
    importBox: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginTop: 12,
    },
    importInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 13,
        minHeight: 100,
        textAlignVertical: 'top',
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    },
    importError: {
        color: '#ef4444',
        fontSize: 12,
        marginTop: 6,
    },
    importActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 10,
    },

    // Preview bar
    previewBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
    },
    previewBarInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    previewBarText: {
        fontWeight: '600',
        fontSize: 14,
    },
    stopPreviewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    stopPreviewText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
});
