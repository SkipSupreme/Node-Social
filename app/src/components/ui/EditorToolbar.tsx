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
import { RADIUS } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useTheme';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SelectionState, RichTextEditorRef } from './RichTextEditor';

interface EditorToolbarProps {
  editorRef: React.RefObject<RichTextEditorRef | null>;
  selectionState: SelectionState;
  onImagePress?: () => void;
  onPollPress?: () => void;
  showPoll?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editorRef,
  selectionState,
  onImagePress,
  onPollPress,
  showPoll,
  style,
}) => {
  const theme = useAppTheme();
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
      style={[styles.button, isActive && { backgroundColor: `${theme.accent}25` }]}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {children}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.panel, borderTopColor: theme.border }, style]}>
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
            color={selectionState.isBold ? theme.accent : theme.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleItalic()}
          isActive={selectionState.isItalic}
          label="Italic"
        >
          <Italic
            size={18}
            color={selectionState.isItalic ? theme.accent : theme.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleStrike()}
          isActive={selectionState.isStrike}
          label="Strikethrough"
        >
          <Strikethrough
            size={18}
            color={selectionState.isStrike ? theme.accent : theme.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleCode()}
          isActive={selectionState.isCode}
          label="Inline code"
        >
          <Code
            size={18}
            color={selectionState.isCode ? theme.accent : theme.muted}
          />
        </ToolbarButton>

        <View style={[styles.separator, { backgroundColor: theme.border }]} />

        {/* Headings */}
        <ToolbarButton
          onPress={() => setShowHeadingMenu(true)}
          isActive={selectionState.isHeading}
          label="Heading"
        >
          {selectionState.headingLevel === 1 ? (
            <Heading1 size={18} color={theme.accent} />
          ) : selectionState.headingLevel === 2 ? (
            <Heading2 size={18} color={theme.accent} />
          ) : selectionState.headingLevel === 3 ? (
            <Heading3 size={18} color={theme.accent} />
          ) : (
            <Heading2 size={18} color={theme.muted} />
          )}
        </ToolbarButton>

        <View style={[styles.separator, { backgroundColor: theme.border }]} />

        {/* Lists */}
        <ToolbarButton
          onPress={() => editorRef.current?.toggleBulletList()}
          isActive={selectionState.isBulletList}
          label="Bullet list"
        >
          <List
            size={18}
            color={selectionState.isBulletList ? theme.accent : theme.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleOrderedList()}
          isActive={selectionState.isOrderedList}
          label="Numbered list"
        >
          <ListOrdered
            size={18}
            color={selectionState.isOrderedList ? theme.accent : theme.muted}
          />
        </ToolbarButton>

        <View style={[styles.separator, { backgroundColor: theme.border }]} />

        {/* Block elements */}
        <ToolbarButton
          onPress={() => editorRef.current?.toggleBlockquote()}
          isActive={selectionState.isBlockquote}
          label="Blockquote"
        >
          <Quote
            size={18}
            color={selectionState.isBlockquote ? theme.accent : theme.muted}
          />
        </ToolbarButton>

        <ToolbarButton
          onPress={() => editorRef.current?.toggleCodeBlock()}
          isActive={selectionState.isCodeBlock}
          label="Code block"
        >
          <View style={[styles.codeBlockIcon, { borderColor: theme.muted }]}>
            <Code
              size={14}
              color={selectionState.isCodeBlock ? theme.accent : theme.muted}
            />
          </View>
        </ToolbarButton>

        <View style={[styles.separator, { backgroundColor: theme.border }]} />

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
            color={selectionState.isLink ? theme.accent : theme.muted}
          />
        </ToolbarButton>

        {/* Image */}
        {onImagePress && (
          <ToolbarButton onPress={onImagePress} label="Insert image">
            <ImageIcon size={18} color={theme.muted} />
          </ToolbarButton>
        )}

        {/* Poll */}
        {onPollPress && (
          <ToolbarButton onPress={onPollPress} isActive={showPoll} label="Add poll">
            <BarChart2 size={18} color={showPoll ? theme.accent : theme.muted} />
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
          <View style={[styles.linkModal, { backgroundColor: theme.panel, borderColor: theme.border }]} onStartShouldSetResponder={() => true}>
            <View style={styles.linkModalHeader}>
              <Text style={[styles.linkModalTitle, { color: theme.text }]}>Insert Link</Text>
              <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                <X size={20} color={theme.muted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.linkInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              placeholder="https://example.com"
              placeholderTextColor={theme.muted}
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
              onSubmitEditing={handleLinkSubmit}
            />
            <TouchableOpacity
              style={[styles.linkSubmitButton, { backgroundColor: theme.accent }, !linkUrl.trim() && styles.linkSubmitButtonDisabled]}
              onPress={handleLinkSubmit}
              disabled={!linkUrl.trim()}
            >
              <Check size={18} color={theme.bg} />
              <Text style={[styles.linkSubmitText, { color: theme.bg }]}>Add Link</Text>
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
          <View style={[styles.headingModal, { backgroundColor: theme.panel, borderColor: theme.border }]} onStartShouldSetResponder={() => true}>
            <View style={styles.linkModalHeader}>
              <Text style={[styles.linkModalTitle, { color: theme.text }]}>Heading</Text>
              <TouchableOpacity onPress={() => setShowHeadingMenu(false)}>
                <X size={20} color={theme.muted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.headingOption, selectionState.headingLevel === 1 && { backgroundColor: `${theme.accent}20` }]}
              onPress={() => handleHeadingSelect(1)}
            >
              <Heading1 size={22} color={selectionState.headingLevel === 1 ? theme.accent : theme.text} />
              <Text style={[styles.headingLabel, { color: theme.text }, selectionState.headingLevel === 1 && { color: theme.accent, fontWeight: '600' }]}>
                Heading 1
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headingOption, selectionState.headingLevel === 2 && { backgroundColor: `${theme.accent}20` }]}
              onPress={() => handleHeadingSelect(2)}
            >
              <Heading2 size={20} color={selectionState.headingLevel === 2 ? theme.accent : theme.text} />
              <Text style={[styles.headingLabel, { color: theme.text }, selectionState.headingLevel === 2 && { color: theme.accent, fontWeight: '600' }]}>
                Heading 2
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headingOption, selectionState.headingLevel === 3 && { backgroundColor: `${theme.accent}20` }]}
              onPress={() => handleHeadingSelect(3)}
            >
              <Heading3 size={18} color={selectionState.headingLevel === 3 ? theme.accent : theme.text} />
              <Text style={[styles.headingLabel, { color: theme.text }, selectionState.headingLevel === 3 && { color: theme.accent, fontWeight: '600' }]}>
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
    borderTopWidth: 1,
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
  separator: {
    width: 1,
    height: 20,
    marginHorizontal: 6,
  },
  codeBlockIcon: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 2,
  },
  headingModal: {
    borderRadius: RADIUS.lg,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
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
  headingLabel: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  linkModal: {
    borderRadius: RADIUS.lg,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
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
  },
  linkInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  linkSubmitButton: {
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
    fontSize: 16,
    fontWeight: '600',
  },
});
