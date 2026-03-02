/**
 * TipTap WYSIWYG editor for document content
 */
import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import styles from './DocumentContentEditor.module.scss';

interface DocumentContentEditorProps {
  contentDelta: any;                    // TipTap JSON Delta
  onChange: (delta: any) => void;       // Emit changes
  readOnly?: boolean;
}

export const DocumentContentEditor: React.FC<DocumentContentEditorProps> = ({
  contentDelta,
  onChange,
  readOnly = false
}) => {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false, // Fix SSR hydration mismatch
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]  // H2-H6 (H1 reserved for document title)
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      }),
      Underline,
      Image.configure({
        inline: true,
        allowBase64: true
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true
      })
    ],
    content: contentDelta,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    }
  });

  // Update content when prop changes (for hierarchical editing)
  useEffect(() => {
    if (editor && contentDelta) {
      const currentContent = editor.getJSON();
      if (JSON.stringify(currentContent) !== JSON.stringify(contentDelta)) {
        editor.commands.setContent(contentDelta);
      }
    }
  }, [contentDelta, editor]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className={styles.editorWrapper}>
      {/* Toolbar */}
      {!readOnly && (
        <div className={styles.toolbar}>
          {/* Headings (H2-H6 only, H1 reserved for document title) */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? styles.active : ''}
            type="button"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive('heading', { level: 3 }) ? styles.active : ''}
            type="button"
          >
            H3
          </button>

          <div className={styles.separator} />

          {/* Text Formatting */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? styles.active : ''}
            type="button"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? styles.active : ''}
            type="button"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive('underline') ? styles.active : ''}
            type="button"
          >
            <u>U</u>
          </button>

          <div className={styles.separator} />

          {/* Link */}
          <button
            onClick={() => {
              const url = window.prompt('URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={editor.isActive('link') ? styles.active : ''}
            type="button"
          >
            🔗 Link
          </button>

          {/* Image */}
          <button
            onClick={() => {
              const url = window.prompt('Image URL:');
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            }}
            type="button"
          >
            🖼️ Img
          </button>

          <div className={styles.separator} />

          {/* Lists */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? styles.active : ''}
            type="button"
          >
            • List
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? styles.active : ''}
            type="button"
          >
            1. List
          </button>

          <div className={styles.separator} />

          {/* Quote & Code */}
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? styles.active : ''}
            type="button"
          >
            " Quote
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive('codeBlock') ? styles.active : ''}
            type="button"
          >
            {'<>'} Code
          </button>

          <div className={styles.separator} />

          {/* Text Color */}
          <input
            type="color"
            onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
            value={editor.getAttributes('textStyle').color || '#000000'}
            className={styles.colorPicker}
            title="Text Color"
          />

          {/* Highlight */}
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive('highlight') ? styles.active : ''}
            type="button"
          >
            🖍️ Highlight
          </button>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  );
};
