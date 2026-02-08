import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions
} from 'react-native';
import { X, Image as ImageIcon, BarChart2, Trash2, ChevronDown, Check, Search, Hash, ExternalLink } from 'lucide-react-native';
import { RADIUS, SHADOWS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';
import { createPost, Node, getLinkPreview, TipTapDoc, ExternalPost } from '../../lib/api';
import { LinkPreviewCard } from '../LinkPreviewCard';
import { RichTextEditor, RichTextEditorRef, SelectionState } from './RichTextEditor';
import { EditorToolbar } from './EditorToolbar';

interface CreatePostModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    nodes: Node[];
    initialNodeId?: string | null;
    quotedExternalPost?: ExternalPost | null;
}

// Default empty selection state
const defaultSelectionState: SelectionState = {
    isBold: false,
    isItalic: false,
    isStrike: false,
    isCode: false,
    isLink: false,
    isHeading: false,
    headingLevel: null,
    isBulletList: false,
    isOrderedList: false,
    isCodeBlock: false,
    isBlockquote: false,
};

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
    visible,
    onClose,
    onSuccess,
    nodes,
    initialNodeId,
    quotedExternalPost
}) => {
    const theme = useAppTheme();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    // Rich text editor state
    const editorRef = useRef<RichTextEditorRef>(null);
    const [contentJson, setContentJson] = useState<TipTapDoc | null>(null);
    const [plainText, setPlainText] = useState('');
    const [selectionState, setSelectionState] = useState<SelectionState>(defaultSelectionState);

    const [title, setTitle] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Node picker state
    const [showNodePicker, setShowNodePicker] = useState(false);
    const [nodeSearch, setNodeSearch] = useState('');

    // Link Preview State
    interface LinkPreview {
        url: string;
        title?: string;
        description?: string;
        image?: string;
        domain?: string;
    }
    const [linkUrl, setLinkUrl] = useState<string | null>(null);
    const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Poll State
    const [showPoll, setShowPoll] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);

    // Image State
    const [showImageInput, setShowImageInput] = useState(false);
    const [imageUrl, setImageUrl] = useState('');

    // Get selected node info
    const selectedNode = useMemo(() => {
        if (!selectedNodeId) return null;
        return nodes.find(n => n.id === selectedNodeId) || null;
    }, [selectedNodeId, nodes]);

    // Filter nodes by search
    const filteredNodes = useMemo(() => {
        if (!nodeSearch.trim()) return nodes;
        const search = nodeSearch.toLowerCase();
        return nodes.filter(n =>
            n.name.toLowerCase().includes(search) ||
            n.slug.toLowerCase().includes(search)
        );
    }, [nodes, nodeSearch]);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setContentJson(null);
            setPlainText('');
            setTitle('');
            setSelectedNodeId(initialNodeId || null);
            setError(null);
            setLinkUrl(null);
            setLinkPreview(null);
            setShowPoll(false);
            setPollQuestion('');
            setPollOptions(['', '']);
            setShowImageInput(false);
            setImageUrl('');
            setShowNodePicker(false);
            setNodeSearch('');
            setSelectionState(defaultSelectionState);
            // Clear editor content when modal reopens
            setTimeout(() => {
                editorRef.current?.clear();
            }, 100);
        }
    }, [visible, initialNodeId]);

    // Detect URLs in content for link preview
    useEffect(() => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = plainText.match(urlRegex);

        if (match && match[0] !== linkUrl) {
            const url = match[0];
            setLinkUrl(url);
            fetchPreview(url);
        } else if (!match && linkUrl) {
            setLinkUrl(null);
            setLinkPreview(null);
        }
    }, [plainText, linkUrl]);

    const fetchPreview = async (url: string) => {
        setLoadingPreview(true);
        try {
            const preview = await getLinkPreview(url);
            setLinkPreview(preview);
        } catch (err) {
            console.log('Failed to fetch preview', err);
        } finally {
            setLoadingPreview(false);
        }
    };

    // Handle content changes from editor
    const handleContentChange = useCallback((json: TipTapDoc, html: string, text: string) => {
        setContentJson(json);
        setPlainText(text);
    }, []);

    // Handle selection state changes for toolbar
    const handleSelectionChange = useCallback((state: SelectionState) => {
        setSelectionState(state);
    }, []);

    const handleAddOption = () => {
        if (pollOptions.length < 4) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const handleRemoveOption = (index: number) => {
        if (pollOptions.length > 2) {
            const newOptions = [...pollOptions];
            newOptions.splice(index, 1);
            setPollOptions(newOptions);
        }
    };

    const handleOptionChange = (text: string, index: number) => {
        const newOptions = [...pollOptions];
        newOptions[index] = text;
        setPollOptions(newOptions);
    };

    const handleSelectNode = (nodeId: string | null) => {
        setSelectedNodeId(nodeId);
        setShowNodePicker(false);
        setNodeSearch('');
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            let pollData;
            if (showPoll) {
                const trimmedQuestion = pollQuestion.trim();
                if (!trimmedQuestion) {
                    throw new Error('Poll question is required');
                }
                const validOptions = pollOptions.filter(o => o.trim().length > 0);
                if (validOptions.length < 2) {
                    throw new Error('Poll must have at least 2 options');
                }
                pollData = {
                    question: trimmedQuestion,
                    options: validOptions,
                    duration: 3
                };
            }

            const finalTitle = title.trim() || (showPoll && pollData ? pollData.question : undefined);
            if (!finalTitle) {
                throw new Error('Title is required');
            }

            // Check if we have rich content
            const hasRichContent = contentJson && contentJson.content && contentJson.content.length > 0;
            const hasText = plainText.trim().length > 0;

            await createPost({
                // Send TipTap JSON if we have rich content
                contentJson: hasRichContent ? contentJson : undefined,
                // Fallback to plain text content for backwards compatibility
                content: !hasRichContent && hasText ? plainText.trim() : undefined,
                title: finalTitle,
                nodeId: selectedNodeId || undefined,
                // If quoting an external post, use its URL; otherwise use linkUrl/imageUrl
                linkUrl: quotedExternalPost?.externalUrl || linkUrl || imageUrl || undefined,
                // Pass external post metadata directly (Bluesky is a SPA with no OG tags)
                linkMetaData: quotedExternalPost ? {
                    title: `${quotedExternalPost.author.displayName} (@${quotedExternalPost.author.username})`,
                    description: quotedExternalPost.content?.substring(0, 1000),
                    image: quotedExternalPost.mediaUrls?.[0] || quotedExternalPost.author.avatar || undefined,
                } : undefined,
                poll: pollData
            });
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create post');
        } finally {
            setLoading(false);
        }
    };

    const hasTitle = !!title.trim();
    const hasValidPoll = showPoll && !!pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2;
    const canSubmit = hasTitle || hasValidPoll;

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={[styles.container, { backgroundColor: theme.bg }, isDesktop && styles.containerDesktop]}>
                    {/* Minimal Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={theme.muted} size={22} />
                        </TouchableOpacity>

                        {/* Publishing context - where you're posting */}
                        <TouchableOpacity
                            style={styles.nodeContext}
                            onPress={() => setShowNodePicker(true)}
                        >
                            <View style={[
                                styles.nodeContextDot,
                                { backgroundColor: selectedNode?.color || theme.accent }
                            ]} />
                            <Text style={[styles.nodeContextText, { color: theme.textSecondary }]} numberOfLines={1}>
                                {selectedNode ? `n/${selectedNode.slug}` : 'General'}
                            </Text>
                            <ChevronDown size={14} color={theme.muted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.publishBtn, { backgroundColor: theme.accent }, !canSubmit && styles.publishBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={!canSubmit || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.publishBtnText}>Publish</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Editor Area - focused writing experience */}
                    <ScrollView
                        style={styles.editor}
                        contentContainerStyle={[
                            styles.editorContent,
                            isDesktop && styles.editorContentDesktop
                        ]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Large Title Input */}
                        <TextInput
                            style={[styles.titleInput, { color: theme.text }, isDesktop && styles.titleInputDesktop]}
                            placeholder="Title"
                            placeholderTextColor={theme.muted}
                            value={title}
                            onChangeText={setTitle}
                            maxLength={300}
                            autoFocus
                            multiline
                        />

                        {/* Rich Text Editor */}
                        <RichTextEditor
                            ref={editorRef}
                            placeholder="Tell your story..."
                            onContentChange={handleContentChange}
                            onSelectionChange={handleSelectionChange}
                            minHeight={200}
                            style={[styles.richEditor, isDesktop && styles.richEditorDesktop]}
                        />

                        {/* Image/Video URL Input */}
                        {showImageInput && (
                            <View style={[styles.attachmentSection, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                                <View style={styles.attachmentHeader}>
                                    <ImageIcon size={16} color={theme.accent} />
                                    <Text style={[styles.attachmentTitle, { color: theme.text }]}>Media URL</Text>
                                    <TouchableOpacity onPress={() => setShowImageInput(false)} style={styles.attachmentClose}>
                                        <X size={16} color={theme.muted} />
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={[styles.attachmentInput, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                                    placeholder="Paste image or video URL"
                                    placeholderTextColor={theme.muted}
                                    value={imageUrl}
                                    onChangeText={setImageUrl}
                                />
                            </View>
                        )}

                        {/* Poll Creator */}
                        {showPoll && (
                            <View style={[styles.attachmentSection, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                                <View style={styles.attachmentHeader}>
                                    <BarChart2 size={16} color={theme.accent} />
                                    <Text style={[styles.attachmentTitle, { color: theme.text }]}>Poll</Text>
                                    <TouchableOpacity onPress={() => setShowPoll(false)} style={styles.attachmentClose}>
                                        <X size={16} color={theme.muted} />
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    style={[styles.pollQuestion, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                                    placeholder="Ask a question..."
                                    placeholderTextColor={theme.muted}
                                    value={pollQuestion}
                                    onChangeText={setPollQuestion}
                                />

                                {pollOptions.map((option, index) => (
                                    <View key={index} style={styles.pollOptionRow}>
                                        <TextInput
                                            style={[styles.pollOptionInput, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                                            placeholder={`Option ${index + 1}`}
                                            placeholderTextColor={theme.muted}
                                            value={option}
                                            onChangeText={(text) => handleOptionChange(text, index)}
                                        />
                                        {pollOptions.length > 2 && (
                                            <TouchableOpacity onPress={() => handleRemoveOption(index)} style={styles.pollOptionRemove}>
                                                <Trash2 size={16} color={theme.muted} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}

                                {pollOptions.length < 4 && (
                                    <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
                                        <Text style={[styles.addOptionText, { color: theme.accent }]}>+ Add option</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {loadingPreview && (
                            <View style={styles.previewLoading}>
                                <ActivityIndicator color={theme.accent} size="small" />
                                <Text style={[styles.previewLoadingText, { color: theme.muted }]}>Loading preview...</Text>
                            </View>
                        )}

                        {linkPreview && (
                            <View style={styles.previewContainer}>
                                <LinkPreviewCard metadata={linkPreview} />
                            </View>
                        )}

                        {/* Quoted External Post Preview */}
                        {quotedExternalPost && (
                            <View style={styles.quotedPostContainer}>
                                <View style={styles.quotedPostHeader}>
                                    <Text style={[styles.quotedPostLabel, { color: theme.muted }]}>
                                        Quoting from {quotedExternalPost.platform === 'bluesky' ? '🦋 Bluesky' : '🦣 Mastodon'}
                                    </Text>
                                </View>
                                <View style={[styles.quotedPostCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                                    <View style={styles.quotedPostAuthor}>
                                        <Text style={[styles.quotedPostDisplayName, { color: theme.text }]}>
                                            {quotedExternalPost.author.displayName}
                                        </Text>
                                        <Text style={[styles.quotedPostUsername, { color: theme.muted }]}>
                                            @{quotedExternalPost.author.username}
                                        </Text>
                                    </View>
                                    <Text style={[styles.quotedPostContent, { color: theme.textSecondary }]} numberOfLines={3}>
                                        {quotedExternalPost.content}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.quotedPostLink}
                                        onPress={() => {/* Could open in browser */}}
                                    >
                                        <ExternalLink size={12} color={theme.accent} />
                                        <Text style={[styles.quotedPostLinkText, { color: theme.accent }]}>View original</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Rich Text Formatting Toolbar */}
                    <EditorToolbar
                        editorRef={editorRef}
                        selectionState={selectionState}
                        onImagePress={() => setShowImageInput(!showImageInput)}
                        onPollPress={() => setShowPoll(!showPoll)}
                        showPoll={showPoll}
                    />
                </View>

                {/* Node Picker Modal */}
                <Modal
                    visible={showNodePicker}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowNodePicker(false)}
                >
                    <TouchableOpacity
                        style={styles.pickerOverlay}
                        activeOpacity={1}
                        onPress={() => setShowNodePicker(false)}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={e => e.stopPropagation()}
                            style={[styles.pickerContainer, { backgroundColor: theme.panel }, isDesktop && styles.pickerContainerDesktop]}
                        >
                            <View style={[styles.pickerHeader, { borderBottomColor: theme.border }]}>
                                <Text style={[styles.pickerTitle, { color: theme.text }]}>Post to</Text>
                                <TouchableOpacity onPress={() => setShowNodePicker(false)}>
                                    <X size={20} color={theme.muted} />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.searchContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                                <Search size={18} color={theme.muted} />
                                <TextInput
                                    style={[styles.searchInput, { color: theme.text }]}
                                    placeholder="Search communities..."
                                    placeholderTextColor={theme.muted}
                                    value={nodeSearch}
                                    onChangeText={setNodeSearch}
                                    autoFocus
                                />
                                {nodeSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setNodeSearch('')}>
                                        <X size={16} color={theme.muted} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <ScrollView style={styles.nodeList} showsVerticalScrollIndicator={false}>
                                <TouchableOpacity
                                    style={[styles.nodeOption, !selectedNodeId && [styles.nodeOptionSelected, { backgroundColor: `${theme.accent}12` }]]}
                                    onPress={() => handleSelectNode(null)}
                                >
                                    <View style={[styles.nodeColorDot, { backgroundColor: theme.accent }]} />
                                    <View style={styles.nodeOptionInfo}>
                                        <Text style={[styles.nodeOptionName, { color: theme.text }]}>General</Text>
                                        <Text style={[styles.nodeOptionDesc, { color: theme.muted }]}>Visible to everyone</Text>
                                    </View>
                                    {!selectedNodeId && <Check size={18} color={theme.accent} />}
                                </TouchableOpacity>

                                <View style={[styles.pickerDivider, { backgroundColor: theme.border }]} />

                                {filteredNodes.map(node => (
                                    <TouchableOpacity
                                        key={node.id}
                                        style={[styles.nodeOption, selectedNodeId === node.id && [styles.nodeOptionSelected, { backgroundColor: `${theme.accent}12` }]]}
                                        onPress={() => handleSelectNode(node.id)}
                                    >
                                        <View style={[styles.nodeColorDot, { backgroundColor: node.color || theme.accent }]} />
                                        <View style={styles.nodeOptionInfo}>
                                            <Text style={[styles.nodeOptionName, { color: theme.text }]}>n/{node.slug}</Text>
                                            {node.name !== node.slug && (
                                                <Text style={[styles.nodeOptionDesc, { color: theme.muted }]} numberOfLines={1}>{node.name}</Text>
                                            )}
                                        </View>
                                        {selectedNodeId === node.id && <Check size={18} color={theme.accent} />}
                                    </TouchableOpacity>
                                ))}

                                {filteredNodes.length === 0 && nodeSearch.length > 0 && (
                                    <View style={styles.noResults}>
                                        <Hash size={24} color={theme.muted} />
                                        <Text style={[styles.noResultsText, { color: theme.muted }]}>No communities found</Text>
                                    </View>
                                )}
                            </ScrollView>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    container: {
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        height: '92%',
        width: '100%',
        overflow: 'hidden',
    },
    containerDesktop: {
        width: 680,
        height: '88%',
        maxHeight: 860,
        alignSelf: 'center',
        borderRadius: RADIUS.xl,
        marginBottom: '4%',
        ...SHADOWS.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        gap: 12,
    },
    closeBtn: {
        padding: 8,
    },
    nodeContext: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nodeContextDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    nodeContextText: {
        fontSize: 14,
        fontWeight: '500',
    },
    publishBtn: {
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: RADIUS.full,
    },
    publishBtnDisabled: {
        opacity: 0.35,
    },
    publishBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12,
        marginHorizontal: 20,
        marginTop: 12,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    errorText: {
        color: '#EF4444',
        textAlign: 'center',
        fontSize: 14,
    },
    editor: {
        flex: 1,
    },
    editorContent: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40,
    },
    editorContentDesktop: {
        paddingHorizontal: 48,
        paddingTop: 32,
    },
    titleInput: {
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 12,
        lineHeight: 28,
    },
    titleInputDesktop: {
        fontSize: 24,
        lineHeight: 30,
        marginBottom: 16,
    },
    richEditor: {
        minHeight: 200,
    },
    richEditorDesktop: {
        minHeight: 300,
    },
    attachmentSection: {
        borderRadius: RADIUS.lg,
        padding: 16,
        marginTop: 24,
        borderWidth: 1,
    },
    attachmentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 8,
    },
    attachmentTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    attachmentClose: {
        padding: 4,
    },
    attachmentInput: {
        borderRadius: RADIUS.md,
        padding: 14,
        borderWidth: 1,
        fontSize: 15,
    },
    pollQuestion: {
        borderRadius: RADIUS.md,
        padding: 14,
        borderWidth: 1,
        marginBottom: 12,
        fontSize: 15,
    },
    pollOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    pollOptionInput: {
        flex: 1,
        borderRadius: RADIUS.md,
        padding: 12,
        borderWidth: 1,
        fontSize: 15,
    },
    pollOptionRemove: {
        padding: 8,
    },
    addOptionBtn: {
        padding: 12,
        alignItems: 'center',
    },
    addOptionText: {
        fontWeight: '600',
        fontSize: 14,
    },
    previewLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 24,
    },
    previewLoadingText: {
        fontSize: 14,
    },
    previewContainer: {
        marginTop: 24,
    },
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        width: '90%',
        maxWidth: 400,
        maxHeight: '65%',
        borderRadius: RADIUS.xl,
        overflow: 'hidden',
        ...SHADOWS.lg,
    },
    pickerContainerDesktop: {
        maxWidth: 420,
        maxHeight: 480,
    },
    pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    pickerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        margin: 12,
        borderRadius: RADIUS.lg,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        padding: 0,
    },
    nodeList: {
        flex: 1,
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    nodeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: RADIUS.lg,
        marginBottom: 2,
    },
    nodeOptionSelected: {
    },
    nodeColorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    nodeOptionInfo: {
        flex: 1,
    },
    nodeOptionName: {
        fontSize: 15,
        fontWeight: '500',
    },
    nodeOptionDesc: {
        fontSize: 13,
        marginTop: 2,
    },
    pickerDivider: {
        height: 1,
        marginVertical: 8,
        marginHorizontal: 12,
    },
    noResults: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    noResultsText: {
        fontSize: 14,
    },
    quotedPostContainer: {
        marginTop: 16,
    },
    quotedPostHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    quotedPostLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    quotedPostCard: {
        borderRadius: RADIUS.lg,
        padding: 12,
        borderWidth: 1,
    },
    quotedPostAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    quotedPostDisplayName: {
        fontSize: 14,
        fontWeight: '600',
    },
    quotedPostUsername: {
        fontSize: 13,
    },
    quotedPostContent: {
        fontSize: 14,
        lineHeight: 20,
    },
    quotedPostLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    quotedPostLinkText: {
        fontSize: 12,
    },
});
