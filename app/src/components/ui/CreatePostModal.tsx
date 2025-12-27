import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { X, Image as ImageIcon, BarChart2, Trash2, Bold, Italic, Link as LinkIcon, List, ChevronDown, Check, Search, Hash } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS } from '../../constants/theme';
import { createPost, Node, getLinkPreview } from '../../lib/api';
import { LinkPreviewCard } from '../LinkPreviewCard';

interface CreatePostModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    nodes: Node[];
    initialNodeId?: string | null;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
    visible,
    onClose,
    onSuccess,
    nodes,
    initialNodeId
}) => {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Node picker state
    const [showNodePicker, setShowNodePicker] = useState(false);
    const [nodeSearch, setNodeSearch] = useState('');

    // Link Preview State
    const [linkUrl, setLinkUrl] = useState<string | null>(null);
    const [linkPreview, setLinkPreview] = useState<any | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Poll State
    const [showPoll, setShowPoll] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);

    // Image State
    const [showImageInput, setShowImageInput] = useState(false);
    const [imageUrl, setImageUrl] = useState('');

    // Text selection for formatting
    const contentRef = useRef<TextInput>(null);
    const [selection, setSelection] = useState({ start: 0, end: 0 });

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
            setContent('');
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
        }
    }, [visible, initialNodeId]);

    // Detect URLs in content
    useEffect(() => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = content.match(urlRegex);

        if (match && match[0] !== linkUrl) {
            const url = match[0];
            setLinkUrl(url);
            fetchPreview(url);
        } else if (!match && linkUrl) {
            setLinkUrl(null);
            setLinkPreview(null);
        }
    }, [content]);

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

    // Formatting helpers
    const insertFormatting = (prefix: string, suffix: string, placeholder: string) => {
        const { start, end } = selection;
        const selectedText = content.substring(start, end);
        const textToInsert = selectedText || placeholder;
        const before = content.substring(0, start);
        const after = content.substring(end);
        const newContent = `${before}${prefix}${textToInsert}${suffix}${after}`;
        setContent(newContent);
        setTimeout(() => contentRef.current?.focus(), 50);
    };

    const formatBold = () => insertFormatting('**', '**', 'bold');
    const formatItalic = () => insertFormatting('*', '*', 'italic');
    const formatLink = () => insertFormatting('[', '](url)', 'link');
    const formatList = () => {
        const { start } = selection;
        const before = content.substring(0, start);
        const after = content.substring(start);
        const prefix = before.length === 0 || before.endsWith('\n') ? '- ' : '\n- ';
        setContent(`${before}${prefix}${after}`);
        setTimeout(() => contentRef.current?.focus(), 50);
    };

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

            await createPost({
                content: content.trim() || undefined,
                title: finalTitle,
                nodeId: selectedNodeId || undefined,
                linkUrl: linkUrl || imageUrl || undefined,
                poll: pollData
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to create post');
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

                <View style={[styles.container, isDesktop && styles.containerDesktop]}>
                    {/* Minimal Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={COLORS.node.muted} size={22} />
                        </TouchableOpacity>

                        {/* Publishing context - where you're posting */}
                        <TouchableOpacity
                            style={styles.nodeContext}
                            onPress={() => setShowNodePicker(true)}
                        >
                            <View style={[
                                styles.nodeContextDot,
                                { backgroundColor: selectedNode?.color || COLORS.node.accent }
                            ]} />
                            <Text style={styles.nodeContextText} numberOfLines={1}>
                                {selectedNode ? `n/${selectedNode.slug}` : 'General'}
                            </Text>
                            <ChevronDown size={14} color={COLORS.node.muted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.publishBtn, !canSubmit && styles.publishBtnDisabled]}
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
                            style={[styles.titleInput, isDesktop && styles.titleInputDesktop]}
                            placeholder="Title"
                            placeholderTextColor={COLORS.node.muted}
                            value={title}
                            onChangeText={setTitle}
                            maxLength={300}
                            autoFocus
                            multiline
                        />

                        {/* Body Input - fills the space */}
                        <TextInput
                            ref={contentRef}
                            style={[styles.bodyInput, isDesktop && styles.bodyInputDesktop]}
                            placeholder="Tell your story..."
                            placeholderTextColor={COLORS.node.muted}
                            multiline
                            value={content}
                            onChangeText={setContent}
                            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                        />

                        {/* Image/Video URL Input */}
                        {showImageInput && (
                            <View style={styles.attachmentSection}>
                                <View style={styles.attachmentHeader}>
                                    <ImageIcon size={16} color={COLORS.node.accent} />
                                    <Text style={styles.attachmentTitle}>Media URL</Text>
                                    <TouchableOpacity onPress={() => setShowImageInput(false)} style={styles.attachmentClose}>
                                        <X size={16} color={COLORS.node.muted} />
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.attachmentInput}
                                    placeholder="Paste image or video URL"
                                    placeholderTextColor={COLORS.node.muted}
                                    value={imageUrl}
                                    onChangeText={setImageUrl}
                                />
                            </View>
                        )}

                        {/* Poll Creator */}
                        {showPoll && (
                            <View style={styles.attachmentSection}>
                                <View style={styles.attachmentHeader}>
                                    <BarChart2 size={16} color={COLORS.node.accent} />
                                    <Text style={styles.attachmentTitle}>Poll</Text>
                                    <TouchableOpacity onPress={() => setShowPoll(false)} style={styles.attachmentClose}>
                                        <X size={16} color={COLORS.node.muted} />
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    style={styles.pollQuestion}
                                    placeholder="Ask a question..."
                                    placeholderTextColor={COLORS.node.muted}
                                    value={pollQuestion}
                                    onChangeText={setPollQuestion}
                                />

                                {pollOptions.map((option, index) => (
                                    <View key={index} style={styles.pollOptionRow}>
                                        <TextInput
                                            style={styles.pollOptionInput}
                                            placeholder={`Option ${index + 1}`}
                                            placeholderTextColor={COLORS.node.muted}
                                            value={option}
                                            onChangeText={(text) => handleOptionChange(text, index)}
                                        />
                                        {pollOptions.length > 2 && (
                                            <TouchableOpacity onPress={() => handleRemoveOption(index)} style={styles.pollOptionRemove}>
                                                <Trash2 size={16} color={COLORS.node.muted} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}

                                {pollOptions.length < 4 && (
                                    <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
                                        <Text style={styles.addOptionText}>+ Add option</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {loadingPreview && (
                            <View style={styles.previewLoading}>
                                <ActivityIndicator color={COLORS.node.accent} size="small" />
                                <Text style={styles.previewLoadingText}>Loading preview...</Text>
                            </View>
                        )}

                        {linkPreview && (
                            <View style={styles.previewContainer}>
                                <LinkPreviewCard metadata={linkPreview} />
                            </View>
                        )}
                    </ScrollView>

                    {/* Bottom Toolbar - minimal and functional */}
                    <View style={styles.toolbar}>
                        <View style={styles.toolbarLeft}>
                            {/* Formatting options - always visible */}
                            <TouchableOpacity style={styles.formatBtn} onPress={formatBold}>
                                <Bold size={18} color={COLORS.node.text} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.formatBtn} onPress={formatItalic}>
                                <Italic size={18} color={COLORS.node.text} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.formatBtn} onPress={formatLink}>
                                <LinkIcon size={18} color={COLORS.node.text} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.formatBtn} onPress={formatList}>
                                <List size={18} color={COLORS.node.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.toolbarRight}>
                            <TouchableOpacity
                                style={[styles.toolbarBtn, showImageInput && styles.toolbarBtnActive]}
                                onPress={() => setShowImageInput(!showImageInput)}
                            >
                                <ImageIcon size={20} color={showImageInput ? COLORS.node.accent : COLORS.node.muted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toolbarBtn, showPoll && styles.toolbarBtnActive]}
                                onPress={() => setShowPoll(!showPoll)}
                            >
                                <BarChart2 size={20} color={showPoll ? COLORS.node.accent : COLORS.node.muted} />
                            </TouchableOpacity>
                        </View>
                    </View>
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
                            style={[styles.pickerContainer, isDesktop && styles.pickerContainerDesktop]}
                        >
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>Post to</Text>
                                <TouchableOpacity onPress={() => setShowNodePicker(false)}>
                                    <X size={20} color={COLORS.node.muted} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.searchContainer}>
                                <Search size={18} color={COLORS.node.muted} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search communities..."
                                    placeholderTextColor={COLORS.node.muted}
                                    value={nodeSearch}
                                    onChangeText={setNodeSearch}
                                    autoFocus
                                />
                                {nodeSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setNodeSearch('')}>
                                        <X size={16} color={COLORS.node.muted} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <ScrollView style={styles.nodeList} showsVerticalScrollIndicator={false}>
                                <TouchableOpacity
                                    style={[styles.nodeOption, !selectedNodeId && styles.nodeOptionSelected]}
                                    onPress={() => handleSelectNode(null)}
                                >
                                    <View style={[styles.nodeColorDot, { backgroundColor: COLORS.node.accent }]} />
                                    <View style={styles.nodeOptionInfo}>
                                        <Text style={styles.nodeOptionName}>General</Text>
                                        <Text style={styles.nodeOptionDesc}>Visible to everyone</Text>
                                    </View>
                                    {!selectedNodeId && <Check size={18} color={COLORS.node.accent} />}
                                </TouchableOpacity>

                                <View style={styles.pickerDivider} />

                                {filteredNodes.map(node => (
                                    <TouchableOpacity
                                        key={node.id}
                                        style={[styles.nodeOption, selectedNodeId === node.id && styles.nodeOptionSelected]}
                                        onPress={() => handleSelectNode(node.id)}
                                    >
                                        <View style={[styles.nodeColorDot, { backgroundColor: node.color || COLORS.node.accent }]} />
                                        <View style={styles.nodeOptionInfo}>
                                            <Text style={styles.nodeOptionName}>n/{node.slug}</Text>
                                            {node.name !== node.slug && (
                                                <Text style={styles.nodeOptionDesc} numberOfLines={1}>{node.name}</Text>
                                            )}
                                        </View>
                                        {selectedNodeId === node.id && <Check size={18} color={COLORS.node.accent} />}
                                    </TouchableOpacity>
                                ))}

                                {filteredNodes.length === 0 && nodeSearch.length > 0 && (
                                    <View style={styles.noResults}>
                                        <Hash size={24} color={COLORS.node.muted} />
                                        <Text style={styles.noResultsText}>No communities found</Text>
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
        backgroundColor: COLORS.node.bg,
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
    // Minimal header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
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
        color: COLORS.node.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    publishBtn: {
        backgroundColor: COLORS.node.accent,
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
    // Editor - focused writing space
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
        color: COLORS.node.text,
        marginBottom: 12,
        lineHeight: 28,
    },
    titleInputDesktop: {
        fontSize: 24,
        lineHeight: 30,
        marginBottom: 16,
    },
    bodyInput: {
        fontSize: 17,
        color: COLORS.node.text,
        lineHeight: 28,
        minHeight: 200,
        textAlignVertical: 'top',
    },
    bodyInputDesktop: {
        fontSize: 18,
        lineHeight: 30,
        minHeight: 300,
    },
    // Attachments (image, poll)
    attachmentSection: {
        backgroundColor: COLORS.node.panel,
        borderRadius: RADIUS.lg,
        padding: 16,
        marginTop: 24,
        borderWidth: 1,
        borderColor: COLORS.node.border,
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
        color: COLORS.node.text,
    },
    attachmentClose: {
        padding: 4,
    },
    attachmentInput: {
        backgroundColor: COLORS.node.bg,
        borderRadius: RADIUS.md,
        padding: 14,
        color: COLORS.node.text,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        fontSize: 15,
    },
    pollQuestion: {
        backgroundColor: COLORS.node.bg,
        borderRadius: RADIUS.md,
        padding: 14,
        color: COLORS.node.text,
        borderWidth: 1,
        borderColor: COLORS.node.border,
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
        backgroundColor: COLORS.node.bg,
        borderRadius: RADIUS.md,
        padding: 12,
        color: COLORS.node.text,
        borderWidth: 1,
        borderColor: COLORS.node.border,
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
        color: COLORS.node.accent,
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
        color: COLORS.node.muted,
        fontSize: 14,
    },
    previewContainer: {
        marginTop: 24,
    },
    // Bottom toolbar - minimal
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: COLORS.node.border,
        backgroundColor: COLORS.node.bgAlt,
        paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    },
    toolbarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    toolbarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    toolbarBtn: {
        padding: 10,
        borderRadius: RADIUS.md,
    },
    toolbarBtnActive: {
        backgroundColor: `${COLORS.node.accent}15`,
    },
    formatBtn: {
        padding: 8,
        borderRadius: RADIUS.sm,
    },
    // Node Picker Modal
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
        backgroundColor: COLORS.node.panel,
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
        borderBottomColor: COLORS.node.border,
    },
    pickerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        margin: 12,
        backgroundColor: COLORS.node.bg,
        borderRadius: RADIUS.lg,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    searchInput: {
        flex: 1,
        color: COLORS.node.text,
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
        backgroundColor: `${COLORS.node.accent}12`,
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
        color: COLORS.node.text,
    },
    nodeOptionDesc: {
        fontSize: 13,
        color: COLORS.node.muted,
        marginTop: 2,
    },
    pickerDivider: {
        height: 1,
        backgroundColor: COLORS.node.border,
        marginVertical: 8,
        marginHorizontal: 12,
    },
    noResults: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    noResultsText: {
        color: COLORS.node.muted,
        fontSize: 14,
    },
});
