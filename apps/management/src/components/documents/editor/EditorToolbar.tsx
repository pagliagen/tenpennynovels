import React from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Code2, Italic, List, ListOrdered, Quote, Redo2, RemoveFormatting, Strikethrough, Table2, Underline, Undo2
} from 'lucide-react';

import { toggleHeadingOnLine } from '@/lib/tiptap/hardBreaks';
import { CUSTOM_SIZE_VALUE, FONT_SIZES, isKnownFontSize, NORMAL_SIZE_VALUE } from '@/lib/tiptap/fontSizes';
import { ColorPopover } from './ColorPopover';
import { TableBar } from './TableBar';
import { ToolbarButton } from './ToolbarButton';
import { UrlPopover } from './UrlPopover';

import styles from './editorUi.module.scss';

type Block = 'p' | 'h2' | 'h3';

function currentBlock(editor: Editor): Block {
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  return 'p';
}

function changeBlock(editor: Editor, next: Block) {
  if (next === 'p') {
    // toggleHeading sul livello attivo riporta a paragrafo.
    const active = currentBlock(editor);
    if (active === 'h2') toggleHeadingOnLine(editor, 2);
    else if (active === 'h3') toggleHeadingOnLine(editor, 3);
    return;
  }
  toggleHeadingOnLine(editor, next === 'h2' ? 2 : 3);
}

export const EditorToolbar: React.FC<{ editor: Editor }> = ({ editor }) => {
  const chain = () => editor.chain().focus();

  const fontSize = editor.getAttributes('textStyle').fontSize as string | undefined;
  const sizeSelectValue = !isKnownFontSize(fontSize) ? CUSTOM_SIZE_VALUE : fontSize ?? NORMAL_SIZE_VALUE;

  return (
    <>
      <div className={styles.toolbar} role="toolbar" aria-label="Formattazione">
        <ToolbarButton icon={Undo2} label="Annulla" onClick={() => chain().undo().run()} disabled={!editor.can().undo()} />
        <ToolbarButton icon={Redo2} label="Ripeti" onClick={() => chain().redo().run()} disabled={!editor.can().redo()} />

        <span className={styles.separator} />

        {/* H1 è riservato al titolo del documento: qui solo H2 e H3. */}
        <select
          className={styles.select}
          aria-label="Stile del paragrafo"
          value={currentBlock(editor)}
          onChange={(event) => changeBlock(editor, event.target.value as Block)}
        >
          <option value="p">Paragrafo</option>
          <option value="h2">Titolo 2</option>
          <option value="h3">Titolo 3</option>
        </select>

        <select
          className={styles.select}
          aria-label="Dimensione del carattere"
          value={sizeSelectValue}
          onChange={(event) => {
            const value = event.target.value;
            if (value === CUSTOM_SIZE_VALUE) return;
            if (value === NORMAL_SIZE_VALUE) chain().unsetFontSize().run();
            else chain().setFontSize(value).run();
          }}
        >
          {FONT_SIZES.map((size) => (
            <option key={size.label} value={size.value ?? NORMAL_SIZE_VALUE}>{size.label}</option>
          ))}
          {/* Documenti vecchi con una misura fuori scala: si mostra, non si perde in silenzio. */}
          {sizeSelectValue === CUSTOM_SIZE_VALUE && <option value={CUSTOM_SIZE_VALUE}>Personalizzata</option>}
        </select>

        <span className={styles.separator} />

        <ToolbarButton icon={Bold} label="Grassetto" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} />
        <ToolbarButton icon={Italic} label="Corsivo" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} />
        <ToolbarButton icon={Underline} label="Sottolineato" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()} />
        <ToolbarButton icon={Strikethrough} label="Barrato" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()} />

        <span className={styles.separator} />

        <ColorPopover editor={editor} kind="text" />
        <ColorPopover editor={editor} kind="highlight" />
        <ToolbarButton
          icon={RemoveFormatting}
          label="Rimuovi formattazione"
          onClick={() => chain().unsetAllMarks().clearNodes().run()}
        />

        <span className={styles.separator} />

        <UrlPopover editor={editor} kind="link" />
        <UrlPopover editor={editor} kind="image" />

        <span className={styles.separator} />

        <ToolbarButton icon={List} label="Elenco puntato" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()} />
        <ToolbarButton icon={ListOrdered} label="Elenco numerato" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()} />
        <ToolbarButton icon={Quote} label="Citazione" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()} />
        <ToolbarButton icon={Code2} label="Blocco di codice" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()} />
        <ToolbarButton
          icon={Table2}
          label="Inserisci tabella"
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
      </div>

      {editor.isActive('table') && <TableBar editor={editor} />}
    </>
  );
};
