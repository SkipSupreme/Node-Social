import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal, TextInput, ScrollView, Platform } from 'react-native';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  X,
  Check,
  BarChart2,
} from 'lucide-react-native';
import { COLORS, RADIUS } from '../../constants/theme';
import type { SelectionState, RichTextEditorRef } from './RichTextEditor';

interface EditorToolbarProps {
  editorRef: React.RefObject<RichTextEditorRef | null>;
  selectionState: SelectionState;
  onImagePress?: () => void;
  onPollPress?: () => void;
  showPoll?: boolean;
  style?: any;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editorRef,
  selectionState,
  onImagePress,
  onPollPress,
  showPoll,
  style,
}) => {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);

  const handleLinkSubmit = () => {
    if (linkUrl.trim()) {
      let url = linkUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      editorRef.current?.setLink(url);
    }
    setLinkUrl('');
    setShowLinkModal(false);
  };

  const handleHeadingSelect = (level: 1 | 2 | 3) => {
    editorRef.current?.toggleHeading(level);
    setShowHeadingMenu(false);
  };

  const ToolbarButton: React.FC<{
    onPress: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    label?: string;
  }> = ({ onPress, isActive, children, label }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, isActive && styles.buttonActive]}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {children}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Text formatting */}
        <ToolbarButton
          onPress={() => editorRef.current?.toggleBold()}
          isActive={selectionState.isBold}
          label="Bold"
        >
          <Bold
            size={18}
            color={selectionState.isBold ? COLORS.node.accent : COLORS.node.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleItalic()}
          isActive={selectionState.isItalic}
          label="Italic"
        >
          <Italic
            size={18}
            color={selectionState.isItalic ? COLORS.node.accent : COLORS.node.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleStrike()}
          isActive={selectionState.isStrike}
          label="Strikethrough"
        >
          <Strikethrough
            size={18}
            color={selectionState.isStrike ? COLORS.node.accent : COLORS.node.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleCode()}
          isActive={selectionState.isCode}
          label="Inline code"
        >
          <Code
            size={18}
            color={selectionState.isCode ? COLORS.node.accent : COLORS.node.muted}
          />
        </ToolbarButton>

        <View style={styles.separator} />

        {/* Headings */}
        <ToolbarButton
          onPress={() => setShowHeadingMenu(true)}
          isActive={selectionState.isHeading}
          label="Heading"
        >
          {selectionState.headingLevel === 1 ? (
            <Heading1 size={18} color={COLORS.node.accent} />
          ) : selectionState.headingLevel === 2 ? (
            <Heading2 size={18} color={COLORS.node.accent} />
          ) : selectionState.headingLevel === 3 ? (
            <Heading3 size={18} color={COLORS.node.accent} />
          ) : (
            <Heading2 size={18} color={COLORS.node.muted} />
          )}
        </ToolbarButton>

        <View style={styles.separator} />

        {/* Lists */}
        <ToolbarButton
          onPress={() => editorRef.current?.toggleBulletList()}
          isActive={selectionState.isBulletList}
          label="Bullet list"
        >
          <List
            size={18}
            color={selectionState.isBulletList ? COLORS.node.accent : COLORS.node.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleOrderedList()}
          isActive={selectionState.isOrderedList}
          label="Numbered list"
        >
          <ListOrdered
            size={18}
            color={selectionState.isOrderedList ? COLORS.node.accent : COLORS.node.muted}
          />
        </ToolbarButton>

        <View style={styles.separator} />

        {/* Block elements */}
        <ToolbarButton
          onPress={() => editorRef.current?.toggleBlockquote()}
          isActive={selectionState.isBlockquote}
          label="Blockquote"
        >
          <Quote
            size={18}
            color={selectionState.isBlockquote ? COLORS.node.accent : COLORS.node.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleCodeBlock()}
          isActive={selectionState.isCodeBlock}
          label="Code block"
        >
          <View style={styles.codeBlockIcon}>
            <Code
              size={14}
              color={selectionState.isCodeBlock ? COLORS.node.accent : COLORS.node.muted}
            />
          </View>
        </ToolbarButton>

        <View style={styles.separator} />

        {/* Link */}
        <ToolbarButton
          onPress={() => {
            if (selectionState.isLink) {
              editorRef.current?.setLink(null);
            } else {
              setShowLinkModal(true);
            }
          }}
          isActive={selectionState.isLink}
          label="Link"
        >
          <LinkIcon
            size={18}
            color={selectionState.isLink ? COLORS.node.accent : COLORS.node.muted}
          />
        </ToolbarButton>

        {/* Image */}
        {onImagePress && (
          <ToolbarButton onPress={onImagePress} label="Insert image">
            <ImageIcon size={18} color={COLORS.node.muted} />
          </ToolbarButton>
        )}

        {/* Poll */}
        {onPollPress && (
          <ToolbarButton onPress={onPollPress} isActive={showPoll} label="Add poll">
            <BarChart2 size={18} color={showPoll ? COLORS.node.accent : COLORS.node.muted} />
          </ToolbarButton>
        )}
      </ScrollView>

      {/* Link Modal */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLinkModal(false)}
        >
          <View style={styles.linkModal} onStartShouldSetResponder={() => true}>
            <View style={styles.linkModalHeader}>
              <Text style={styles.linkModalTitle}>Insert Link</Text>
              <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                <X size={20} color={COLORS.node.muted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.linkInput}
              placeholder="https://example.com"
              placeholderTextColor={COLORS.node.muted}
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
              onSubmitEditing={handleLinkSubmit}
            />
            <TouchableOpacity
              style={[styles.linkSubmitButton, !linkUrl.trim() && styles.linkSubmitButtonDisabled]}
              onPress={handleLinkSubmit}
              disabled={!linkUrl.trim()}
            >
              <Check size={18} color={COLORS.node.bg} />
              <Text style={styles.linkSubmitText}>Add Link</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Heading Modal */}
      <Modal
        visible={showHeadingMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHeadingMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHeadingMenu(false)}
        >
          <View style={styles.headingModal} onStartShouldSetResponder={() => true}>
            <View style={styles.linkModalHeader}>
              <Text style={styles.linkModalTitle}>Heading</Text>
              <TouchableOpacity onPress={() => setShowHeadingMenu(false)}>
                <X size={20} color={COLORS.node.muted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.headingOption, selectionState.headingLevel === 1 && styles.headingOptionActive]}
              onPress={() => handleHeadingSelect(1)}
            >
              <Heading1 size={22} color={selectionState.headingLevel === 1 ? COLORS.node.accent : COLORS.node.text} />
              <Text style={[styles.headingLabel, selectionState.headingLevel === 1 && styles.headingLabelActive]}>
                Heading 1
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headingOption, selectionState.headingLevel === 2 && styles.headingOptionActive]}
              onPress={() => handleHeadingSelect(2)}
            >
              <Heading2 size={20} color={selectionState.headingLevel === 2 ? COLORS.node.accent : COLORS.node.text} />
              <Text style={[styles.headingLabel, selectionState.headingLevel === 2 && styles.headingLabelActive]}>
                Heading 2
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headingOption, selectionState.headingLevel === 3 && styles.headingOptionActive]}
              onPress={() => handleHeadingSelect(3)}
            >
              <Heading3 size={18} color={selectionState.headingLevel === 3 ? COLORS.node.accent : COLORS.node.text} />
              <Text style={[styles.headingLabel, selectionState.headingLevel === 3 && styles.headingLabelActive]}>
                Heading 3
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.node.panel,
    borderTopWidth: 1,
    borderTopColor: COLORS.node.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: `${COLORS.node.accent}25`,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.node.border,
    marginHorizontal: 6,
  },
  codeBlockIcon: {
    borderWidth: 1,
    borderColor: COLORS.node.muted,
    borderRadius: 4,
    padding: 2,
  },
  headingModal: {
    backgroundColor: COLORS.node.panel,
    borderRadius: RADIUS.lg,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  headingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderRadius: RADIUS.md,
    marginBottom: 4,
  },
  headingOptionActive: {
    backgroundColor: `${COLORS.node.accent}20`,
  },
  headingLabel: {
    fontSize: 16,
    color: COLORS.node.text,
  },
  headingLabelActive: {
    color: COLORS.node.accent,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  linkModal: {
    backgroundColor: COLORS.node.panel,
    borderRadius: RADIUS.lg,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  linkModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.node.text,
  },
  linkInput: {
    backgroundColor: COLORS.node.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.node.text,
    marginBottom: 16,
  },
  linkSubmitButton: {
    backgroundColor: COLORS.node.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  linkSubmitButtonDisabled: {
    opacity: 0.5,
  },
  linkSubmitText: {
    color: COLORS.node.bg,
    fontSize: 16,
    fontWeight: '600',
  },
});
