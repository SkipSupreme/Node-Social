import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

// Import the DOM component
import TipTapEditor, { TipTapEditorRef } from '../dom/TipTapEditor';

// TipTap JSON types
export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  text?: string;
}

export interface SelectionState {
  isBold: boolean;
  isItalic: boolean;
  isStrike: boolean;
  isCode: boolean;
  isLink: boolean;
  isHeading: boolean;
  headingLevel: number | null;
  isBulletList: boolean;
  isOrderedList: boolean;
  isCodeBlock: boolean;
  isBlockquote: boolean;
}

export interface RichTextEditorRef {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrike: () => void;
  toggleCode: () => void;
  toggleHeading: (level: 1 | 2 | 3) => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleCodeBlock: () => void;
  toggleBlockquote: () => void;
  setLink: (url: string | null) => void;
  insertImage: (url: string, alt?: string) => void;
  insertMention: (id: string, label: string) => void;
  getContent: () => { json: TipTapDoc; html: string; text: string } | undefined;
  setContent: (content: TipTapDoc) => void;
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

interface RichTextEditorProps {
  initialContent?: TipTapDoc;
  placeholder?: string;
  onContentChange?: (json: TipTapDoc, html: string, text: string) => void;
  onSelectionChange?: (state: SelectionState) => void;
  onFocusChange?: (focused: boolean) => void;
  onReady?: () => void;
  minHeight?: number;
  style?: any;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  initialContent,
  placeholder = 'Write something...',
  onContentChange,
  onSelectionChange,
  onFocusChange,
  onReady,
  minHeight = 120,
  style,
}, ref) => {
  // Store the editor methods received from the DOM component
  const editorMethodsRef = useRef<TipTapEditorRef | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Handle ready callback - receive methods from DOM component
  const handleReady = useCallback((methods: TipTapEditorRef) => {
    editorMethodsRef.current = methods;
    setIsReady(true);
    onReady?.();
  }, [onReady]);

  // Expose methods to parent via ref - proxy to DOM component methods
  useImperativeHandle(ref, () => ({
    toggleBold: () => {
      editorMethodsRef.current?.toggleBold();
    },
    toggleItalic: () => {
      editorMethodsRef.current?.toggleItalic();
    },
    toggleStrike: () => {
      editorMethodsRef.current?.toggleStrike();
    },
    toggleCode: () => {
      editorMethodsRef.current?.toggleCode();
    },
    toggleHeading: (level: 1 | 2 | 3) => {
      editorMethodsRef.current?.toggleHeading(level);
    },
    toggleBulletList: () => {
      editorMethodsRef.current?.toggleBulletList();
    },
    toggleOrderedList: () => {
      editorMethodsRef.current?.toggleOrderedList();
    },
    toggleCodeBlock: () => {
      editorMethodsRef.current?.toggleCodeBlock();
    },
    toggleBlockquote: () => {
      editorMethodsRef.current?.toggleBlockquote();
    },
    setLink: (url: string | null) => {
      editorMethodsRef.current?.setLink(url);
    },
    insertImage: (url: string, alt?: string) => {
      editorMethodsRef.current?.insertImage(url, alt);
    },
    insertMention: (id: string, label: string) => {
      editorMethodsRef.current?.insertMention(id, label);
    },
    getContent: () => {
      return editorMethodsRef.current?.getContent();
    },
    setContent: (content: TipTapDoc) => {
      editorMethodsRef.current?.setContent(content);
    },
    focus: () => {
      editorMethodsRef.current?.focus();
    },
    blur: () => {
      editorMethodsRef.current?.blur();
    },
    clear: () => {
      editorMethodsRef.current?.clear();
    },
  }), []);

  return (
    <View style={[styles.container, { minHeight }, style]}>
      <TipTapEditor
        dom={{ matchContents: true }}
        initialContent={initialContent}
        placeholder={placeholder}
        onContentChange={onContentChange}
        onSelectionChange={onSelectionChange}
        onFocusChange={onFocusChange}
        onReady={handleReady}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});

RichTextEditor.displayName = 'RichTextEditor';
