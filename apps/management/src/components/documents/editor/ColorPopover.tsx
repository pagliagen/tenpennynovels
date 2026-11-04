import React, { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Highlighter, Palette } from 'lucide-react';

import { buildColorGrid, loadRecentColors, rememberColor, THEME_COLORS } from '@/lib/tiptap/colorGrid';
import { useClickOutside } from './useClickOutside';

import styles from './editorUi.module.scss';

const GRID = buildColorGrid();

interface ColorPopoverProps {
  editor: Editor;
  kind: 'text' | 'highlight';
}

function Swatch({ color, onPick }: { color: string; onPick: (color: string) => void }) {
  return (
    <button
      type="button"
      className={styles.swatch}
      style={{ background: color }}
      title={color}
      aria-label={color}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(color)}
    />
  );
}

/** Selettore colore del testo / dell'evidenziatore: griglia stile Google Docs, tema, recenti, "altri colori". */
export const ColorPopover: React.FC<ColorPopoverProps> = ({ editor, kind }) => {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentColors());
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(close);

  const isText = kind === 'text';
  const current: string | undefined = isText ? editor.getAttributes('textStyle').color : editor.getAttributes('highlight').color;
  const [draft, setDraft] = useState(current ?? '#b8860b');
  const Icon = isText ? Palette : Highlighter;
  const label = isText ? 'Colore del testo' : 'Evidenziatore';

  const apply = (color: string) => {
    const chain = editor.chain().focus();
    if (isText) chain.setColor(color).run();
    else chain.setHighlight({ color }).run();
    setRecent(rememberColor(color));
  };

  const clear = () => {
    const chain = editor.chain().focus();
    if (isText) chain.unsetColor().run();
    else chain.unsetHighlight().run();
    setOpen(false);
  };

  // Recupera i documenti dove Word aveva già salvato colori (prima di PasteColorCleanup).
  // Senza selezione agisce sull'intero documento, poi riporta il cursore: lasciare
  // tutto selezionato significa che il tasto successivo lo cancella.
  const clearEverywhere = () => {
    const { from, empty } = editor.state.selection;
    const chain = editor.chain().focus();
    if (empty) chain.selectAll().unsetColor().unsetHighlight().setTextSelection(from);
    else chain.unsetColor().unsetHighlight();
    chain.run();
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`${styles.btn} ${current ? styles.on : ''}`}
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (current) setDraft(current);
          setOpen((value) => !value);
        }}
      >
        <Icon size={17} />
        {current && <span className={styles.colorDot} style={{ background: current }} />}
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={label}>
          <button type="button" className={styles.linkButton} onMouseDown={(event) => event.preventDefault()} onClick={clear}>
            Nessun colore
          </button>

          <div className={styles.popLabel}>Tema vittoriano</div>
          <div className={styles.swatchRow}>
            {THEME_COLORS.map((color) => <Swatch key={color} color={color} onPick={apply} />)}
          </div>

          <div className={styles.popLabel}>Colori</div>
          <div className={styles.swatchGrid}>
            {GRID.flat().map((color) => <Swatch key={color} color={color} onPick={apply} />)}
          </div>

          {recent.length > 0 && (
            <>
              <div className={styles.popLabel}>Usati di recente</div>
              <div className={styles.swatchRow}>
                {recent.map((color) => <Swatch key={color} color={color} onPick={apply} />)}
              </div>
            </>
          )}

          <button type="button" className={styles.linkButton} onClick={() => setShowCustom((value) => !value)}>
            Altri colori…
          </button>
          {showCustom && (
            <div className={styles.custom}>
              <HexColorPicker color={draft} onChange={(color) => { setDraft(color); apply(color); }} />
              <div className={styles.hexRow}>
                <span className={styles.colorDot} style={{ background: draft }} />
                <HexColorInput color={draft} prefixed onChange={(color) => { setDraft(color); apply(color); }} aria-label="Codice colore" />
              </div>
            </div>
          )}

          {isText && (
            <button type="button" className={styles.linkButton} onMouseDown={(event) => event.preventDefault()} onClick={clearEverywhere}>
              Rimuovi i colori dalla selezione (o da tutto il documento)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
