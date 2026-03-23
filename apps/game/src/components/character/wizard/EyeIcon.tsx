/**
 * EyeIcon — icona occhio barrato per i campi privati del wizard
 *
 * visible=true  → occhio barrato rosso visibile (campo privato)
 * visible=false → icona nascosta (campo pubblico, spazio riservato per allineamento)
 *
 * @module components/character/wizard/EyeIcon
 */

export const EyeIcon = ({ visible }: { visible: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ visibility: visible ? 'visible' : 'hidden' }}
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
