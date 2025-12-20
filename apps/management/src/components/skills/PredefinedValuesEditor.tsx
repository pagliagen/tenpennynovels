import React, { useState } from 'react';
import styles from '@/styles/components/skills/PredefinedValuesEditor.module.scss';

interface PredefinedValuesEditorProps {
  value: string[];           // Array valori attuali
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

export const PredefinedValuesEditor: React.FC<PredefinedValuesEditorProps> = ({
  value = [],
  onChange,
  disabled = false
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    // Check duplicati
    if (value.includes(trimmed)) {
      alert('Questo valore esiste già!');
      return;
    }

    onChange([...value, trimmed]);
    setNewValue('');
    setIsAdding(false);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    const newValues = [...value];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newValues[index], newValues[targetIndex]] = [newValues[targetIndex], newValues[index]];
    onChange(newValues);
  };

  return (
    <div className={styles.predefinedValuesEditor}>
      <div className={styles.editorHeader}>
        <label className={styles.editorLabel}>
          📋 Valori Predefiniti (Opzionale)
        </label>
        <small className={styles.editorHint}>
          Se configurati, i giocatori potranno selezionare dalla lista o inserire un valore personalizzato
        </small>
      </div>

      {/* Lista valori esistenti */}
      {value.length > 0 && (
        <div className={styles.valuesList}>
          {value.map((val, index) => (
            <div key={index} className={styles.valueItem}>
              <span className={styles.valueText}>{val}</span>
              <div className={styles.valueActions}>
                <button
                  onClick={() => handleReorder(index, 'up')}
                  disabled={index === 0 || disabled}
                  className={styles.reorderButton}
                  title="Sposta su"
                  type="button"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleReorder(index, 'down')}
                  disabled={index === value.length - 1 || disabled}
                  className={styles.reorderButton}
                  title="Sposta giù"
                  type="button"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  className={styles.removeButton}
                  title="Rimuovi"
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {value.length === 0 && (
        <div className={styles.emptyState}>
          <small>Nessun valore predefinito. I giocatori useranno campo libero.</small>
        </div>
      )}

      {/* Add new value form */}
      {isAdding ? (
        <div className={styles.addForm}>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="es: Francese, Tedesco..."
            className={styles.addInput}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
            disabled={disabled}
          />
          <button
            onClick={handleAdd}
            className={styles.confirmButton}
            title="Conferma"
            type="button"
            disabled={disabled}
          >
            ✓
          </button>
          <button
            onClick={() => { setIsAdding(false); setNewValue(''); }}
            className={styles.cancelButton}
            title="Annulla"
            type="button"
            disabled={disabled}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          disabled={disabled}
          className={styles.addButton}
          type="button"
        >
          + Aggiungi Valore
        </button>
      )}
    </div>
  );
};
