'use dom';

import React, { useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

// Use refs to avoid stale closure issues with useEditor callbacks
function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

// Types for TipTap JSON content
interface TipTapDoc {
  type: 'doc';
  content: any[];
}

// Ref methods exposed to native
export interface TipTapEditorRef {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrike: () => void;
  toggleCode: () => void;
  toggleHeading: (level: number) => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleCodeBlock: () => void;
  toggleBlockquote: () => void;
  setLink: (url: string | null) => void;
  insertImage: (url: string, alt?: string) => void;
  insertMention: (id: string, label: string) => void;
  getContent: () => { json: TipTapDoc; html: string; text: string };
  setContent: (content: TipTapDoc) => void;
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

interface TipTapEditorProps {
  initialContent?: TipTapDoc;
  placeholder?: string;
  dom?: import('expo/dom').DOMProps;
  onContentChange?: (json: TipTapDoc, html: string, text: string) => void;
  onSelectionChange?: (state: SelectionState) => void;
  onFocusChange?: (focused: boolean) => void;
  onReady?: (methods: TipTapEditorRef) => void;
}

interface SelectionState {
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

export default function TipTapEditor({
  initialContent,
  placeholder = 'Write something...',
  onContentChange,
  onSelectionChange,
  onFocusChange,
  onReady,
}: TipTapEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Use refs to always get the latest callback values (fixes stale closure in useEditor)
  const onContentChangeRef = useLatestRef(onContentChange);
  const onSelectionChangeRef = useLatestRef(onSelectionChange);
  const onFocusChangeRef = useLatestRef(onFocusChange);
  const onReadyRef = useLatestRef(onReady);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false, // Use CodeBlockLowlight instead
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'editor-code-block',
        },
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as TipTapDoc;
      const html = editor.getHTML();
      const text = editor.getText();
      onContentChangeRef.current?.(json, html, text);
    },
    onSelectionUpdate: ({ editor }) => {
      const state = getSelectionState(editor);
      onSelectionChangeRef.current?.(state);
    },
    onFocus: () => {
      onFocusChangeRef.current?.(true);
    },
    onBlur: () => {
      onFocusChangeRef.current?.(false);
    },
  });

  // Get current selection state for toolbar feedback
  const getSelectionState = useCallback((ed: typeof editor): SelectionState => {
    if (!ed) {
      return {
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
    }
    return {
      isBold: ed.isActive('bold'),
      isItalic: ed.isActive('italic'),
      isStrike: ed.isActive('strike'),
      isCode: ed.isActive('code'),
      isLink: ed.isActive('link'),
      isHeading: ed.isActive('heading'),
      headingLevel: ed.getAttributes('heading').level || null,
      isBulletList: ed.isActive('bulletList'),
      isOrderedList: ed.isActive('orderedList'),
      isCodeBlock: ed.isActive('codeBlock'),
      isBlockquote: ed.isActive('blockquote'),
    };
  }, []);

  // Notify native when editor is ready and pass methods
  useEffect(() => {
    if (editor) {
      const methods: TipTapEditorRef = {
        toggleBold: () => {
          editor.chain().focus().toggleBold().run();
        },
        toggleItalic: () => {
          editor.chain().focus().toggleItalic().run();
        },
        toggleStrike: () => {
          editor.chain().focus().toggleStrike().run();
        },
        toggleCode: () => {
          editor.chain().focus().toggleCode().run();
        },
        toggleHeading: (level: number) => {
          editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
        },
        toggleBulletList: () => {
          editor.chain().focus().toggleBulletList().run();
        },
        toggleOrderedList: () => {
          editor.chain().focus().toggleOrderedList().run();
        },
        toggleCodeBlock: () => {
          editor.chain().focus().toggleCodeBlock().run();
        },
        toggleBlockquote: () => {
          editor.chain().focus().toggleBlockquote().run();
        },
        setLink: (url: string | null) => {
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          } else {
            editor.chain().focus().unsetLink().run();
          }
        },
        insertImage: (url: string, alt?: string) => {
          if (url) {
            editor.chain().focus().setImage({ src: url, alt: alt || '' }).run();
          }
        },
        insertMention: (id: string, label: string) => {
          if (id && label) {
            editor.chain().focus().insertContent({
              type: 'mention',
              attrs: { id, label },
            }).run();
          }
        },
        getContent: () => {
          return {
            json: editor.getJSON() as TipTapDoc,
            html: editor.getHTML(),
            text: editor.getText(),
          };
        },
        setContent: (content: TipTapDoc) => {
          editor.commands.setContent(content);
        },
        focus: () => {
          editor.commands.focus();
        },
        blur: () => {
          editor.commands.blur();
        },
        clear: () => {
          editor.commands.clearContent();
        },
      };
      onReadyRef.current?.(methods);
    }
  }, [editor]);

  return (
    <div className="tiptap-container" ref={editorRef}>
      <EditorContent editor={editor} className="tiptap-editor" />
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background: transparent;
          overflow-x: hidden;
        }

        .tiptap-container {
          width: 100%;
          min-height: 120px;
          background: transparent;
        }

        .tiptap-editor {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px;
          line-height: 1.6;
          color: #E8E6E3;
          background: transparent;
          width: 100%;
        }

        .tiptap-editor .ProseMirror {
          outline: none;
          min-height: 120px;
          padding: 0;
        }

        .tiptap-editor .ProseMirror p {
          margin: 0 0 12px 0;
        }

        .tiptap-editor .ProseMirror p:last-child {
          margin-bottom: 0;
        }

        .tiptap-editor .ProseMirror.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #6B7280;
          pointer-events: none;
          position: absolute;
          height: 0;
        }

        /* Headings */
        .tiptap-editor h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 16px 0;
          color: #FFFFFF;
        }

        .tiptap-editor h2 {
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #FFFFFF;
        }

        .tiptap-editor h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #FFFFFF;
        }

        /* Text formatting */
        .tiptap-editor strong {
          font-weight: 700;
        }

        .tiptap-editor em {
          font-style: italic;
        }

        .tiptap-editor s {
          text-decoration: line-through;
        }

        .tiptap-editor code {
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          font-size: 14px;
          background: rgba(139, 92, 246, 0.15);
          color: #A78BFA;
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Links */
        .editor-link {
          color: #8B5CF6;
          text-decoration: underline;
          cursor: pointer;
        }

        /* Lists */
        .tiptap-editor ul,
        .tiptap-editor ol {
          padding-left: 24px;
          margin: 0 0 12px 0;
        }

        .tiptap-editor li {
          margin: 4px 0;
        }

        .tiptap-editor li p {
          margin: 0;
        }

        /* Blockquote */
        .tiptap-editor blockquote {
          border-left: 3px solid #8B5CF6;
          padding-left: 16px;
          margin: 12px 0;
          color: #9CA3AF;
          font-style: italic;
        }

        /* Code blocks */
        .editor-code-block {
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          font-size: 14px;
          background: #1F2937;
          border-radius: 8px;
          padding: 16px;
          margin: 12px 0;
          overflow-x: auto;
        }

        .editor-code-block code {
          background: none;
          padding: 0;
          color: #E8E6E3;
        }

        /* Images */
        .editor-image {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 12px 0;
        }

        /* Mentions */
        .editor-mention {
          color: #8B5CF6;
          font-weight: 500;
          background: rgba(139, 92, 246, 0.15);
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Horizontal rule */
        .tiptap-editor hr {
          border: none;
          border-top: 1px solid #374151;
          margin: 24px 0;
        }
      `}</style>
    </div>
  );
}
