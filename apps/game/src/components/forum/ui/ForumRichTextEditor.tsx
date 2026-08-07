'use client';

import { Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';

import { bbcodeToHtml, htmlToBBCode } from '@/lib/forum/bbcode';
import styles from '@/styles/components/forum/ForumRichTextEditor.module.scss';

/**
 * Rich-text editor for forum posts/discussions: bold/italic/underline/quote/
 * link/align/color/font-size/font-family/image, plus a VISUAL/BBCODE toggle
 * that fully swaps the editing surface. The same toolbar buttons drive both:
 * in VISUAL they run TipTap commands, in BBCODE they wrap the current
 * textarea selection in the equivalent tag (so clicking B around "ciao"
 * produces `[b]ciao[/b]`, not a no-op).
 * Deliberately narrower than the management app's document editor - no
 * tables/headings for player-authored content. Every style value here is a
 * fixed, predefined set - never free-form - matching what the backend
 * sanitizer (ForumContentSanitizer) actually allows; anything else typed
 * here would just be stripped server-side on submit anyway.
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

const ALLOWED_FONT_FAMILIES = [
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Sans', value: 'Arial, sans-serif' },
  { label: 'Monospace', value: "'Courier New', monospace" },
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
  const [mode, setMode] = useState<'visual' | 'bbcode'>('visual');
  const [bbcodeDraft, setBbcodeDraft] = useState('');
  const bbcodeRef = useRef<HTMLTextAreaElement>(null);

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
      FontFamily,
      Link.configure({ openOnClick: false, autolink: false }),
      TextAlign.configure({ types: ['paragraph'] }),
      Image.configure({ inline: true }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: { class: styles.editorContent || '' },
    },
  });

  // Re-syncs from the `content` prop, but only into whichever surface (the
  // TipTap editor, or the BBCode textarea) the author isn't actively typing
  // into right now - otherwise every keystroke would round-trip through the
  // other format's conversion and fight the cursor.
  useEffect(() => {
    if (mode === 'bbcode') {
      if (document.activeElement !== bbcodeRef.current) {
        setBbcodeDraft(htmlToBBCode(content));
      }
      return;
    }
    if (editor && !editor.isFocused && editor.getHTML() !== content) {
      editor.commands.setContent(content, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, mode]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return <div className={styles.loading}>Caricamento editor...</div>;

  const handleBbcodeChange = (value: string) => {
    setBbcodeDraft(value);
    onChange(bbcodeToHtml(value));
  };

  /** Wraps the current textarea selection in `open`/`close`, keeping it selected afterwards. */
  const wrapBbcodeSelection = (open: string, close: string) => {
    const el = bbcodeRef.current;
    if (!el) return;
    const start = el.selectionStart ?? bbcodeDraft.length;
    const end = el.selectionEnd ?? bbcodeDraft.length;
    const selected = bbcodeDraft.slice(start, end);
    const newValue = bbcodeDraft.slice(0, start) + open + selected + close + bbcodeDraft.slice(end);
    handleBbcodeChange(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + open.length, start + open.length + selected.length);
    });
  };

  /** Inserts fixed text at the cursor (replacing any selection), no wrapping. */
  const insertBbcodeAtCursor = (text: string) => {
    const el = bbcodeRef.current;
    if (!el) return;
    const start = el.selectionStart ?? bbcodeDraft.length;
    const end = el.selectionEnd ?? bbcodeDraft.length;
    const newValue = bbcodeDraft.slice(0, start) + text + bbcodeDraft.slice(end);
    handleBbcodeChange(newValue);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleBold = () => (mode === 'bbcode' ? wrapBbcodeSelection('[b]', '[/b]') : editor.chain().focus().toggleBold().run());
  const handleItalic = () => (mode === 'bbcode' ? wrapBbcodeSelection('[i]', '[/i]') : editor.chain().focus().toggleItalic().run());
  const handleUnderline = () => (mode === 'bbcode' ? wrapBbcodeSelection('[u]', '[/u]') : editor.chain().focus().toggleUnderline().run());
  const handleQuote = () => (mode === 'bbcode' ? wrapBbcodeSelection('[quote]', '[/quote]') : editor.chain().focus().toggleBlockquote().run());

  const handleLink = () => {
    if (mode === 'visual' && editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL del link (https://...)');
    if (!url) return;
    if (mode === 'bbcode') {
      const el = bbcodeRef.current;
      const hasSelection = !!el && el.selectionStart !== el.selectionEnd;
      if (hasSelection) wrapBbcodeSelection(`[url=${url}]`, '[/url]');
      else insertBbcodeAtCursor(`[url=${url}]${url}[/url]`);
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleImage = () => {
    const url = window.prompt('URL immagine (https://...)');
    if (!url) return;
    if (mode === 'bbcode') {
      insertBbcodeAtCursor(`[img]${url}[/img]`);
      return;
    }
    editor.chain().focus().setImage({ src: url }).run();
  };

  const handleAlign = (value: 'left' | 'center' | 'right') => {
    if (mode === 'bbcode') {
      wrapBbcodeSelection(`[align=${value}]`, '[/align]');
      return;
    }
    editor.chain().focus().setTextAlign(value).run();
  };

  const handleColorChange = (value: string) => {
    if (mode === 'bbcode') {
      if (value) wrapBbcodeSelection(`[color=${value}]`, '[/color]');
      return;
    }
    editor.chain().focus().setMark('textStyle', { color: value || null }).run();
  };

  const handleFontSizeChange = (value: string) => {
    if (mode === 'bbcode') {
      if (value) wrapBbcodeSelection(`[size=${value}]`, '[/size]');
      return;
    }
    editor.chain().focus().setMark('textStyle', { fontSize: value || null }).run();
  };

  const handleFontFamilyChange = (value: string) => {
    if (mode === 'bbcode') {
      if (value) wrapBbcodeSelection(`[font=${value}]`, '[/font]');
      return;
    }
    if (value) editor.chain().focus().setFontFamily(value).run();
    else editor.chain().focus().unsetFontFamily().run();
  };

  const isVisual = mode === 'visual';

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={isVisual && editor.isActive('bold') ? styles.active : undefined}
          onClick={handleBold}
          disabled={disabled}
          title="Grassetto"
        >
          B
        </button>
        <button
          type="button"
          className={isVisual && editor.isActive('italic') ? styles.active : undefined}
          onClick={handleItalic}
          disabled={disabled}
          title="Corsivo"
        >
          I
        </button>
        <button
          type="button"
          className={isVisual && editor.isActive('underline') ? styles.active : undefined}
          onClick={handleUnderline}
          disabled={disabled}
          title="Sottolineato"
        >
          U
        </button>
        <button
          type="button"
          className={isVisual && editor.isActive('blockquote') ? styles.active : undefined}
          onClick={handleQuote}
          disabled={disabled}
          title="Citazione"
        >
          &ldquo;&rdquo;
        </button>
        <button
          type="button"
          className={isVisual && editor.isActive('link') ? styles.active : undefined}
          onClick={handleLink}
          disabled={disabled}
          title="Link"
        >
          🔗
        </button>
        <button type="button" onClick={handleImage} disabled={disabled} title="Inserisci immagine">
          🖼
        </button>

        <span className={styles.toolbarDivider} />

        <button
          type="button"
          className={isVisual && editor.isActive({ textAlign: 'left' }) ? styles.active : undefined}
          onClick={() => handleAlign('left')}
          disabled={disabled}
          title="Allinea a sinistra"
        >
          Sx
        </button>
        <button
          type="button"
          className={isVisual && editor.isActive({ textAlign: 'center' }) ? styles.active : undefined}
          onClick={() => handleAlign('center')}
          disabled={disabled}
          title="Centra"
        >
          Cn
        </button>
        <button
          type="button"
          className={isVisual && editor.isActive({ textAlign: 'right' }) ? styles.active : undefined}
          onClick={() => handleAlign('right')}
          disabled={disabled}
          title="Allinea a destra"
        >
          Dx
        </button>

        <span className={styles.toolbarDivider} />

        <select
          className={styles.select}
          onChange={(e) => handleColorChange(e.target.value)}
          disabled={disabled}
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
          onChange={(e) => handleFontSizeChange(e.target.value)}
          disabled={disabled}
          title="Dimensione testo"
          defaultValue=""
        >
          <option value="">Dimensione</option>
          {ALLOWED_FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          onChange={(e) => handleFontFamilyChange(e.target.value)}
          disabled={disabled}
          title="Famiglia font"
          defaultValue=""
        >
          <option value="">Font</option>
          {ALLOWED_FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <div className={styles.modeToggle}>
          <button
            type="button"
            className={mode === 'visual' ? styles.modeActive : undefined}
            onClick={() => setMode('visual')}
          >
            Visual
          </button>
          <button
            type="button"
            className={mode === 'bbcode' ? styles.modeActive : undefined}
            onClick={() => setMode('bbcode')}
          >
            [BBCode]
          </button>
        </div>
      </div>

      {isVisual ? (
        <EditorContent editor={editor} aria-label={placeholder} />
      ) : (
        <textarea
          ref={bbcodeRef}
          className={styles.bbcodeTextarea}
          value={bbcodeDraft}
          onChange={(e) => handleBbcodeChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Sorgente BBCode"
        />
      )}
    </div>
  );
}
