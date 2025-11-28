import React, { useState, useEffect } from 'react';
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
import { X, Image as ImageIcon, Link as LinkIcon, BarChart2, Trash2 } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';
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

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            // Validate Poll first (needed for title fallback)
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

            // For polls, use the poll question as title if no title provided
            const finalTitle = title.trim() || (showPoll && pollData ? pollData.question : undefined);
            if (!finalTitle) {
                throw new Error('Title is required');
            }

            await createPost({
                content: content.trim() || undefined, // Don't send empty string
                title: finalTitle,
                nodeId: selectedNodeId || undefined,
                linkUrl: linkUrl || imageUrl || undefined, // Use image URL as link URL if present
                poll: pollData
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to create post');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={[styles.container, isDesktop && styles.containerDesktop]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={COLORS.node.text} size={24} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Create Post</Text>
                        {/* Enable button if title exists OR if valid poll exists (poll question can be used as title) */}
                        {(() => {
                            const hasTitle = !!title.trim();
                            const hasValidPoll = showPoll && !!pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2;
                            const canSubmit = hasTitle || hasValidPoll;
                            return (
                                <TouchableOpacity
                                    style={[styles.postBtn, !canSubmit && styles.disabledBtn]}
                                    onPress={handleSubmit}
                                    disabled={!canSubmit || loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.postBtnText}>Post</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })()}
                    </View>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <ScrollView style={styles.content}>
                        <TextInput
                            style={styles.titleInput}
                            placeholder="Title (required)"
                            placeholderTextColor={COLORS.node.muted}
                            value={title}
                            onChangeText={setTitle}
                            maxLength={300}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="What's on your mind?"
                            placeholderTextColor={COLORS.node.muted}
                            multiline
                            value={content}
                            onChangeText={setContent}
                            autoFocus
                        />

                        {/* Image URL Input */}
                        {showImageInput && (
                            <View style={styles.sectionContainer}>
                                <View style={styles.sectionHeader}>
                                    <ImageIcon size={16} color={COLORS.node.accent} />
                                    <Text style={styles.sectionTitle}>Image URL</Text>
                                    <TouchableOpacity onPress={() => setShowImageInput(false)}>
                                        <X size={16} color={COLORS.node.muted} />
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.urlInput}
                                    placeholder="https://example.com/image.jpg"
                                    placeholderTextColor={COLORS.node.muted}
                                    value={imageUrl}
                                    onChangeText={setImageUrl}
                                />
                            </View>
                        )}

                        {/* Poll Creator */}
                        {showPoll && (
                            <View style={styles.sectionContainer}>
                                <View style={styles.sectionHeader}>
                                    <BarChart2 size={16} color={COLORS.node.accent} />
                                    <Text style={styles.sectionTitle}>Poll</Text>
                                    <TouchableOpacity onPress={() => setShowPoll(false)}>
                                        <X size={16} color={COLORS.node.muted} />
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    style={styles.pollQuestionInput}
                                    placeholder="What do you want to ask?"
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
                                            <TouchableOpacity onPress={() => handleRemoveOption(index)}>
                                                <Trash2 size={16} color={COLORS.node.muted} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}

                                {pollOptions.length < 4 && (
                                    <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
                                        <Text style={styles.addOptionText}>+ Add Option</Text>
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

                    <View style={styles.footer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nodeSelector}>
                            <TouchableOpacity
                                style={[styles.nodeChip, !selectedNodeId && styles.activeNodeChip]}
                                onPress={() => setSelectedNodeId(null)}
                            >
                                <Text style={[styles.nodeChipText, !selectedNodeId && styles.activeNodeChipText]}>
                                    General
                                </Text>
                            </TouchableOpacity>
                            {nodes.map(node => (
                                <TouchableOpacity
                                    key={node.id}
                                    style={[styles.nodeChip, selectedNodeId === node.id && styles.activeNodeChip]}
                                    onPress={() => setSelectedNodeId(node.id)}
                                >
                                    <Text style={[styles.nodeChipText, selectedNodeId === node.id && styles.activeNodeChipText]}>
                                        n/{node.slug}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.tools}>
                            <TouchableOpacity
                                style={[styles.toolBtn, showImageInput && styles.activeToolBtn]}
                                onPress={() => setShowImageInput(!showImageInput)}
                            >
                                <ImageIcon color={showImageInput ? COLORS.node.accent : COLORS.node.text} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toolBtn, showPoll && styles.activeToolBtn]}
                                onPress={() => setShowPoll(!showPoll)}
                            >
                                <BarChart2 color={showPoll ? COLORS.node.accent : COLORS.node.text} size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    container: {
        backgroundColor: COLORS.node.bg,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '90%',
        width: '100%',
    },
    containerDesktop: {
        width: 600,
        height: '80%',
        alignSelf: 'center',
        borderRadius: 20,
        marginBottom: '10%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.node.text,
    },
    closeBtn: {
        padding: 8,
    },
    postBtn: {
        backgroundColor: COLORS.node.accent,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    disabledBtn: {
        opacity: 0.5,
    },
    postBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12,
        margin: 16,
        borderRadius: 8,
    },
    errorText: {
        color: '#EF4444',
        textAlign: 'center',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    titleInput: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.node.text,
        marginBottom: 12,
        paddingVertical: 8,
    },
    input: {
        fontSize: 16,
        color: COLORS.node.text,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    sectionContainer: {
        backgroundColor: COLORS.node.panel,
        borderRadius: 12,
        padding: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    sectionTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    urlInput: {
        backgroundColor: COLORS.node.bg,
        borderRadius: 8,
        padding: 12,
        color: COLORS.node.text,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    pollQuestionInput: {
        backgroundColor: COLORS.node.bg,
        borderRadius: 8,
        padding: 12,
        color: COLORS.node.text,
        borderWidth: 1,
        borderColor: COLORS.node.border,
        marginBottom: 12,
    },
    pollOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    pollOptionInput: {
        flex: 1,
        backgroundColor: COLORS.node.bg,
        borderRadius: 8,
        padding: 10,
        color: COLORS.node.text,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    addOptionBtn: {
        padding: 12,
        alignItems: 'center',
    },
    addOptionText: {
        color: COLORS.node.accent,
        fontWeight: '600',
    },
    previewLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
    },
    previewLoadingText: {
        color: COLORS.node.muted,
        fontSize: 14,
    },
    previewContainer: {
        marginTop: 16,
        marginBottom: 32,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: COLORS.node.border,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    },
    nodeSelector: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
    },
    nodeChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: COLORS.node.panel,
        marginRight: 8,
        borderWidth: 1,
        borderColor: COLORS.node.border,
    },
    activeNodeChip: {
        backgroundColor: COLORS.node.accent,
        borderColor: COLORS.node.accent,
    },
    nodeChipText: {
        color: COLORS.node.muted,
        fontWeight: '600',
    },
    activeNodeChipText: {
        color: '#fff',
    },
    tools: {
        flexDirection: 'row',
        padding: 16,
        gap: 16,
    },
    toolBtn: {
        padding: 8,
        backgroundColor: COLORS.node.panel,
        borderRadius: 8,
    },
    activeToolBtn: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
});
