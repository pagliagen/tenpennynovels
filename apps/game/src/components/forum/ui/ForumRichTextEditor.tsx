'use client';

import { Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

import styles from '@/styles/components/forum/ForumRichTextEditor.module.scss';

/**
 * Minimal rich-text editor for forum posts/discussions: bold/italic/underline/
 * quote/color/font-size/image only (per spec - deliberately narrower than the
 * management app's document editor: no tables/links/headings for player-authored
 * content). Palette and font sizes are a fixed, predefined set - never free-form -
 * matching what the backend sanitizer (ForumContentSanitizer) actually allows;
 * anything else typed here would just be stripped server-side on submit anyway.
 */

const ALLOWED_COLORS = [
  { label: 'Default', value: '#1a1a1a' },
  { label: 'Bordeaux', value: '#8b0000' },
  { label: 'Blu', value: '#1976d2' },
  { label: 'Verde', value: '#2e7d32' },
  { label: 'Oro', value: '#d4af37' },
  { label: 'Grigio', value: '#616161' },
];

const ALLOWED_FONT_SIZES = [
  { label: 'Piccolo', value: '12px' },
  { label: 'Normale', value: '14px' },
  { label: 'Medio', value: '16px' },
  { label: 'Grande', value: '18px' },
  { label: 'Molto grande', value: '24px' },
];

// Adds a `fontSize` attribute to the textStyle mark (no official TipTap
// extension for this) - applied directly via setMark('textStyle', {fontSize}),
// no custom command needed so no command-type augmentation required.
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

interface ForumRichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ForumRichTextEditor({ content, onChange, placeholder, disabled }: ForumRichTextEditorProps): JSX.Element {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        strike: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      Image.configure({ inline: true }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: { class: styles.editorContent || '' },
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== content) {
      editor.commands.setContent(content, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return <div className={styles.loading}>Caricamento editor...</div>;

  const handleInsertImage = () => {
    const url = window.prompt('URL immagine (https://...)');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={editor.isActive('bold') ? styles.active : undefined}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Grassetto"
        >
          B
        </button>
        <button
          type="button"
          className={editor.isActive('italic') ? styles.active : undefined}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Corsivo"
        >
          I
        </button>
        <button
          type="button"
          className={editor.isActive('underline') ? styles.active : undefined}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sottolineato"
        >
          U
        </button>
        <button
          type="button"
          className={editor.isActive('blockquote') ? styles.active : undefined}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citazione"
        >
          &ldquo;&rdquo;
        </button>
        <select
          className={styles.select}
          onChange={(e) => editor.chain().focus().setMark('textStyle', { color: e.target.value || null }).run()}
          title="Colore testo"
          defaultValue=""
        >
          <option value="">Colore</option>
          {ALLOWED_COLORS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          onChange={(e) => editor.chain().focus().setMark('textStyle', { fontSize: e.target.value || null }).run()}
          title="Dimensione testo"
          defaultValue=""
        >
          <option value="">Dimensione</option>
          {ALLOWED_FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button type="button" onClick={handleInsertImage} title="Inserisci immagine">
          🖼
        </button>
      </div>
      <EditorContent editor={editor} aria-label={placeholder} />
    </div>
  );
}
