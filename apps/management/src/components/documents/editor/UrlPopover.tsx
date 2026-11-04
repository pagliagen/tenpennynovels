import React, { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ImagePlus, Link2 } from 'lucide-react';

import { useClickOutside } from './useClickOutside';

import styles from './editorUi.module.scss';

interface UrlPopoverProps {
  editor: Editor;
  kind: 'link' | 'image';
}

/** Link e immagine: un piccolo popover con il campo dell'indirizzo, al posto di window.prompt. */
export const UrlPopover: React.FC<UrlPopoverProps> = ({ editor, kind }) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(close);

  const isLink = kind === 'link';
  const active = isLink && editor.isActive('link');
  const Icon = isLink ? Link2 : ImagePlus;
  const label = isLink ? (active ? 'Modifica o rimuovi link' : 'Inserisci link') : 'Inserisci immagine';

  const submit = () => {
    const value = url.trim();
    if (!value) return;
    if (isLink) editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
    else editor.chain().focus().setImage({ src: value }).run();
    setOpen(false);
    setUrl('');
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`${styles.btn} ${active ? styles.on : ''}`}
        title={label}
        aria-label={label}
        aria-pressed={active}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setUrl(isLink ? (editor.getAttributes('link').href as string | undefined) ?? '' : '');
          setOpen((value) => !value);
        }}
      >
        <Icon size={17} />
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={label}>
          <label className={styles.popLabel} htmlFor={`editor-url-${kind}`}>
            {isLink ? 'Indirizzo del link' : 'Indirizzo dell\'immagine'}
          </label>
          <input
            id={`editor-url-${kind}`}
            className={styles.textInput}
            autoFocus
            value={url}
            placeholder="https://"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
          />
          <div className={styles.popActions}>
            <button type="button" className={styles.primaryButton} onClick={submit}>
              {isLink ? 'Applica' : 'Inserisci'}
            </button>
            {active && (
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  setOpen(false);
                }}
              >
                Rimuovi link
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
