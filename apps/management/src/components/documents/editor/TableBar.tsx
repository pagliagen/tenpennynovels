import React from 'react';
import type { Editor } from '@tiptap/react';

import styles from './editorUi.module.scss';

/** Barra contestuale: compare solo con il cursore dentro una tabella. */
export const TableBar: React.FC<{ editor: Editor }> = ({ editor }) => {
  const run = (command: (chain: ReturnType<Editor['chain']>) => { run: () => boolean }) => () => {
    command(editor.chain().focus()).run();
  };

  const actions: Array<{ label: string; danger?: boolean; command: (chain: ReturnType<Editor['chain']>) => { run: () => boolean } }> = [
    { label: '+ Riga sopra', command: (c) => c.addRowBefore() },
    { label: '+ Riga sotto', command: (c) => c.addRowAfter() },
    { label: '+ Colonna a sinistra', command: (c) => c.addColumnBefore() },
    { label: '+ Colonna a destra', command: (c) => c.addColumnAfter() },
    { label: 'Unisci / dividi celle', command: (c) => c.mergeOrSplit() },
    { label: 'Riga di intestazione', command: (c) => c.toggleHeaderRow() },
    { label: '− Riga', danger: true, command: (c) => c.deleteRow() },
    { label: '− Colonna', danger: true, command: (c) => c.deleteColumn() },
    { label: 'Elimina tabella', danger: true, command: (c) => c.deleteTable() }
  ];

  return (
    <div className={styles.tableBar} role="toolbar" aria-label="Strumenti tabella">
      <span className={styles.tableBarTitle}>Tabella</span>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={`${styles.tableButton} ${action.danger ? styles.danger : ''}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={run(action.command)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};
