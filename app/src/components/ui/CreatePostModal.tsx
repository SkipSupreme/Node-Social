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
    Platform
} from 'react-native';
import { X, Image as ImageIcon, Link as LinkIcon } from 'lucide-react-native';
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
    const [content, setContent] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Link Preview State
    const [linkUrl, setLinkUrl] = useState<string | null>(null);
    const [linkPreview, setLinkPreview] = useState<any | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setContent('');
            setSelectedNodeId(initialNodeId || null);
            setError(null);
            setLinkUrl(null);
            setLinkPreview(null);
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

    const handleSubmit = async () => {
        if (!content.trim()) return;

        setLoading(true);
        setError(null);

        try {
            await createPost({
                content,
                nodeId: selectedNodeId || undefined,
                linkUrl: linkUrl || undefined
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to create post');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={COLORS.node.text} size={24} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.postBtn, (!content.trim() || loading) && styles.disabledBtn]}
                            onPress={handleSubmit}
                            disabled={!content.trim() || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.postBtnText}>Post</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <ScrollView style={styles.content}>
                        <TextInput
                            style={styles.input}
                            placeholder="What's on your mind?"
                            placeholderTextColor={COLORS.node.muted}
                            multiline
                            value={content}
                            onChangeText={setContent}
                            autoFocus
                        />

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
                            <TouchableOpacity style={styles.toolBtn}>
                                <ImageIcon color={COLORS.node.accent} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.toolBtn}>
                                <LinkIcon color={COLORS.node.accent} size={24} />
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: COLORS.node.bg,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '90%',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.node.border,
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
    input: {
        fontSize: 18,
        color: COLORS.node.text,
        minHeight: 100,
        textAlignVertical: 'top',
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
});
