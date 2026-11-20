import React from 'react';
import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';

import { type ImageAlign } from '@/lib/tiptap/documentImage';

import styles from './editorUi.module.scss';

const POSITIONS: ReadonlyArray<{ value: ImageAlign | null; label: string; hint: string }> = [
  { value: null, label: 'Nel testo', hint: 'Sulla riga, come una parola' },
  { value: 'left', label: 'A sinistra', hint: 'A lato, con il testo che scorre a destra' },
  { value: 'center', label: 'Al centro', hint: 'Da sola sulla riga, centrata' },
  { value: 'right', label: 'A destra', hint: 'A lato, con il testo che scorre a sinistra' }
];

/**
 * Barra contestuale: compare solo con un'immagine selezionata (clic sull'immagine).
 * La dimensione si cambia trascinando le maniglie agli angoli.
 */
export const ImageBar: React.FC<{ editor: Editor }> = ({ editor }) => {
  const attrs = editor.getAttributes('image');
  const current: ImageAlign | null = attrs.align ?? null;
  const resized = attrs.width != null || attrs.height != null;

  const keepSelection = (event: React.MouseEvent) => event.preventDefault();

  // Il NodeView del ridimensionamento non rilegge width/height quando cambiano
  // (li gestisce solo lui durante il trascinamento): con updateAttributes il
  // documento tornerebbe alla misura originale ma l'editor continuerebbe a
  // mostrarla ridotta. Si sostituisce il nodo, che crea un NodeView nuovo.
  const resetSize = () => {
    const { selection } = editor.state;
    if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') return;
    const { from, to } = selection;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from, to },
        { type: 'image', attrs: { ...attrs, width: null, height: null } }
      )
      .setNodeSelection(from)
      .run();
  };

  return (
    <div className={styles.tableBar} role="toolbar" aria-label="Strumenti immagine">
      <span className={styles.tableBarTitle}>Immagine</span>
      {POSITIONS.map((position) => (
        <button
          key={position.label}
          type="button"
          title={position.hint}
          aria-pressed={current === position.value}
          className={`${styles.tableButton} ${current === position.value ? styles.selected : ''}`}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().updateAttributes('image', { align: position.value }).run()}
        >
          {position.label}
        </button>
      ))}
      <span className={styles.barSeparator} />
      <button
        type="button"
        title="Torna alla larghezza originale (sul sito resta comunque entro la colonna)"
        className={styles.tableButton}
        disabled={!resized}
        onMouseDown={keepSelection}
        onClick={resetSize}
      >
        Dimensione originale
      </button>
      <button
        type="button"
        className={`${styles.tableButton} ${styles.danger}`}
        onMouseDown={keepSelection}
        onClick={() => editor.chain().focus().deleteSelection().run()}
      >
        Elimina immagine
      </button>
    </div>
  );
};
