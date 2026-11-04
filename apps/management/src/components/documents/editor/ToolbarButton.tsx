import React from 'react';
import type { LucideIcon } from 'lucide-react';

import styles from './editorUi.module.scss';

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Pulsante a icona della toolbar. `onMouseDown` annulla il default: premere un
 * pulsante non deve togliere il focus (e quindi la selezione) all'editor.
 */
export const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon: Icon, label, active, disabled, onClick }) => (
  <button
    type="button"
    className={`${styles.btn} ${active ? styles.on : ''}`}
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
  >
    <Icon size={17} />
  </button>
);
