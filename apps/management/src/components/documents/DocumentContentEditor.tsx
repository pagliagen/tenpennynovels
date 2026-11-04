/**
 * TipTap WYSIWYG editor for document content
 */
import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

import { PasteHardBreakSplit } from '@/lib/tiptap/hardBreaks';
import { PasteColorCleanup } from '@/lib/tiptap/pasteColorCleanup';
import { EditorToolbar } from './editor/EditorToolbar';

import styles from './DocumentContentEditor.module.scss';

export type EditorSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_STATUS_LABEL: Record<EditorSaveStatus, string> = {
  idle: '',
  saving: 'Salvataggio…',
  saved: '● Salvato',
  error: 'Salvataggio non riuscito'
};

interface DocumentContentEditorProps {
  contentDelta: any;
  onChange: (delta: any) => void;
  readOnly?: boolean;
  /** When true, contentDelta is treated as an HTML string and onChange emits HTML */
  htmlMode?: boolean;
  /** Riempie l'altezza del contenitore (modal a tutto schermo) invece di avere un'altezza propria. */
  fill?: boolean;
  /** Stato dell'autosave, mostrato nella barra in basso. */
  saveStatus?: EditorSaveStatus;
}

export const DocumentContentEditor: React.FC<DocumentContentEditorProps> = ({
  contentDelta,
  onChange,
  readOnly = false,
  htmlMode = false,
  fill = false,
  saveStatus = 'idle'
}) => {
  const editor = useEditor({
    immediatelyRender: false,
    // In TipTap v3 il componente non si ridisegna a ogni transazione: senza questo
    // i pulsanti della toolbar (attivo, annulla, tabella) non seguono il cursore.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]
        },
        // link e underline sono forniti sotto con la nostra config (StarterKit
        // v3 li include di default e altrimenti darebbe nomi di estensione duplicati)
        link: false,
        underline: false
      }),
      Link.configure({
        openOnClick: false,
        // Di default TipTap crea un link automaticamente mentre scrivi o
        // incolli testo che sembra un URL - un redattore vede comparire un
        // link "da solo" senza aver mai premuto il comando Link, e senza
        // un bottone di rimozione dedicato (v. sotto) non c'era modo di
        // toglierlo dall'interfaccia.
        autolink: false,
        linkOnPaste: false,
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
      // Dimensione del carattere: scala a 5 gradini (lib/tiptap/fontSizes.ts).
      FontSize,
      Color,
      Highlight.configure({
        multicolor: true
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      // Deve stare dopo TextStyle/Color/Highlight: ripulisce i mark che quelli
      // hanno appena parsato dall'HTML incollato.
      PasteColorCleanup,
      // Word esporta "titolo⏎body" come un solo <p> con <br>: senza questo
      // split H2 si applicherebbe a tutto il blocco (v. lib/tiptap/hardBreaks.ts).
      PasteHardBreakSplit
    ],
    content: contentDelta,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(htmlMode ? editor.getHTML() : editor.getJSON());
    }
  });

  // Sincronizza l'editor con la prop. `emitUpdate: false` è essenziale: in
  // TipTap v3 setContent emette `update` per default (in v2 no), quindi una
  // sincronizzazione programmatica sarebbe scambiata per una modifica
  // dell'utente. Se la prop è ancora la bozza vuota iniziale, onChange
  // sovrascriveva il documento appena caricato con un paragrafo vuoto e
  // l'autosave lo scriveva sul DB (perdita del contenuto, 2026-09-18).
  useEffect(() => {
    if (!editor || !contentDelta) return;

    if (htmlMode) {
      const currentHtml = editor.getHTML();
      if (currentHtml !== contentDelta) {
        editor.commands.setContent(contentDelta, { emitUpdate: false });
      }
    } else {
      const currentContent = editor.getJSON();
      if (JSON.stringify(currentContent) !== JSON.stringify(contentDelta)) {
        editor.commands.setContent(contentDelta, { emitUpdate: false });
      }
    }
  }, [contentDelta, editor, htmlMode]);

  if (!editor) {
    return <div>Caricamento editor…</div>;
  }

  const words = editor.getText().split(/\s+/).filter(Boolean).length;

  return (
    <div className={`${styles.editorWrapper} ${fill ? styles.fill : ''}`}>
      {!readOnly && <EditorToolbar editor={editor} />}

      <div className={styles.page}>
        <div className={styles.sheet}>
          <EditorContent editor={editor} className={styles.editorContent} />
        </div>
      </div>

      <div className={styles.status}>
        <span>{words} {words === 1 ? 'parola' : 'parole'}</span>
        <span className={saveStatus === 'saved' ? styles.statusOk : saveStatus === 'error' ? styles.statusError : ''} role="status">
          {SAVE_STATUS_LABEL[saveStatus]}
        </span>
      </div>
    </div>
  );
};
