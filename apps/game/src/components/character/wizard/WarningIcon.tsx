/**
 * WarningIcon — icona di errore campo con tooltip nativo
 *
 * Mostra ⚠️ accanto a un campo quando ha un errore di validazione, col
 * messaggio come tooltip (title). Non renderizza nulla se non c'è errore -
 * sostituisce il blocco "Errori di Validazione" in fondo allo step.
 *
 * @module components/character/wizard/WarningIcon
 */

export const WarningIcon = ({ message }: { message?: string }) => {
  if (!message) return null;

  return (
    <span
      title={message}
      role="img"
      aria-label={`Errore: ${message}`}
      style={{ marginLeft: 4, cursor: 'help', fontSize: '0.85em' }}
    >
      ⚠️
    </span>
  );
};
