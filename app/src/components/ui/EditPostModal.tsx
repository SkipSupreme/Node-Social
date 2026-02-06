import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { X } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS } from '../../constants/theme';
import { editPost, TipTapDoc } from '../../lib/api';
import { RichTextEditor, RichTextEditorRef, SelectionState } from './RichTextEditor';
import { EditorToolbar } from './EditorToolbar';
import { UIPost } from './Feed';

interface EditPostModalProps {
    visible: boolean;
    post: UIPost | null;
    onClose: () => void;
    onSuccess: (updatedPostId: string) => void;
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

export const EditPostModal: React.FC<EditPostModalProps> = ({
    visible,
    post,
    onClose,
    onSuccess,
}) => {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    // Rich text editor state
    const editorRef = useRef<RichTextEditorRef>(null);
    const [contentJson, setContentJson] = useState<TipTapDoc | null>(null);
    const [plainText, setPlainText] = useState('');
    const [selectionState, setSelectionState] = useState<SelectionState>(defaultSelectionState);

    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editorReady, setEditorReady] = useState(false);

    // Populate editor with existing post data when modal opens
    useEffect(() => {
        if (visible && post) {
            setTitle(post.title || '');
            setError(null);
            setEditorReady(false);
            setSelectionState(defaultSelectionState);

            // Content will be set once the editor is ready (see handleEditorReady)
            if (post.contentJson) {
                setContentJson(post.contentJson);
            } else {
                setPlainText(post.content || '');
                setContentJson(null);
            }
        }
    }, [visible, post]);

    // When editor becomes ready, load the existing content into it
    const handleEditorReady = useCallback(() => {
        setEditorReady(true);
        if (post?.contentJson) {
            // Small delay to ensure the editor DOM is fully mounted
            setTimeout(() => {
                editorRef.current?.setContent(post.contentJson as TipTapDoc);
            }, 150);
        } else if (post?.content) {
            // For plain text posts, create a simple TipTap doc to load
            const simpleDoc: TipTapDoc = {
                type: 'doc',
                content: post.content.split('\n').filter(Boolean).map(paragraph => ({
                    type: 'paragraph',
                    content: [{ type: 'text', text: paragraph }],
                })),
            };
            setTimeout(() => {
                editorRef.current?.setContent(simpleDoc);
            }, 150);
        }
    }, [post]);

    // Handle content changes from editor
    const handleContentChange = useCallback((json: TipTapDoc, _html: string, text: string) => {
        setContentJson(json);
        setPlainText(text);
    }, []);

    // Handle selection state changes for toolbar
    const handleSelectionChange = useCallback((state: SelectionState) => {
        setSelectionState(state);
    }, []);

    const handleSubmit = async () => {
        if (!post) return;

        setLoading(true);
        setError(null);

        try {
            const finalTitle = title.trim();
            if (!finalTitle) {
                throw new Error('Title is required');
            }

            const hasRichContent = contentJson && contentJson.content && contentJson.content.length > 0;
            const hasText = plainText.trim().length > 0;

            await editPost(post.id, {
                contentJson: hasRichContent ? contentJson : undefined,
                content: !hasRichContent && hasText ? plainText.trim() : undefined,
                title: finalTitle,
            });

            onSuccess(post.id);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update post');
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = !!title.trim();

    if (!post) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={[styles.container, isDesktop && styles.containerDesktop]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={COLORS.node.muted} size={22} />
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>Edit Post</Text>

                        <TouchableOpacity
                            style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={!canSubmit || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Editor Area */}
                    <ScrollView
                        style={styles.editor}
                        contentContainerStyle={[
                            styles.editorContent,
                            isDesktop && styles.editorContentDesktop
                        ]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Title Input */}
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

                        {/* Rich Text Editor */}
                        <RichTextEditor
                            ref={editorRef}
                            placeholder="Edit your post..."
                            onContentChange={handleContentChange}
                            onSelectionChange={handleSelectionChange}
                            onReady={handleEditorReady}
                            minHeight={200}
                            style={[styles.richEditor, isDesktop && styles.richEditorDesktop]}
                        />
                    </ScrollView>

                    {/* Rich Text Formatting Toolbar */}
                    <EditorToolbar
                        editorRef={editorRef}
                        selectionState={selectionState}
                    />
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
    headerTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.node.text,
    },
    saveBtn: {
        backgroundColor: COLORS.node.accent,
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: RADIUS.full,
    },
    saveBtnDisabled: {
        opacity: 0.35,
    },
    saveBtnText: {
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
        color: COLORS.node.text,
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
});
