/**
 * Dice Roll Modal Component
 *
 * Modal for configuring and rolling custom dice.
 * Allows selection of dice type, count, and modifiers.
 *
 * @module components/chat/DiceRollModal
 * @since 2.0.0
 */

'use client';

import { useState, useMemo } from 'react';
import styles from './DiceRollModal.module.scss';

/**
 * Dice type options
 */
const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;
type DiceType = typeof DICE_TYPES[number];

/**
 * Modal Props
 */
interface DiceRollModalProps {
  /** Callback when roll is confirmed with dice spec string */
  onRoll: (diceSpec: string) => void;

  /** Callback to close modal */
  onClose: () => void;
}

/**
 * Dice Roll Modal
 *
 * Allows user to configure:
 * - Dice type (d4, d6, d8, d10, d12, d20, d100)
 * - Number of dice (1-20)
 * - Modifier (-99 to +99)
 *
 * Generates dice spec string: "{count}d{type}[+/-modifier]"
 *
 * @param {DiceRollModalProps} props - Component props
 * @returns {JSX.Element} Modal
 */
export function DiceRollModal({
  onRoll,
  onClose,
}: DiceRollModalProps): JSX.Element {
  const [diceType, setDiceType] = useState<DiceType>(100);
  const [diceCount, setDiceCount] = useState<number>(1);
  const [modifier, setModifier] = useState<number>(0);

  /**
   * Generate dice spec string
   * Format: {count}d{type}[+/-modifier]
   * Examples: "2d6+3", "1d20", "3d8-2"
   */
  const diceSpec = useMemo(() => {
    let spec = `${diceCount}d${diceType}`;
    if (modifier > 0) {
      spec += `+${modifier}`;
    } else if (modifier < 0) {
      spec += `${modifier}`; // Already has minus sign
    }
    return spec;
  }, [diceCount, diceType, modifier]);

  /**
   * Handle roll confirmation
   */
  const handleRoll = () => {
    if (!diceType || diceCount < 1 || diceCount > 20) {
      return;
    }
    onRoll(diceSpec);
    onClose();
  };

  /**
   * Handle dice count change with validation
   */
  const handleDiceCountChange = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setDiceCount(1);
    } else if (num < 1) {
      setDiceCount(1);
    } else if (num > 20) {
      setDiceCount(20);
    } else {
      setDiceCount(num);
    }
  };

  /**
   * Handle modifier change with validation
   */
  const handleModifierChange = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || value === '' || value === '-') {
      setModifier(0);
    } else if (num < -99) {
      setModifier(-99);
    } else if (num > 99) {
      setModifier(99);
    } else {
      setModifier(num);
    }
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && diceType) {
      handleRoll();
    }
  };

  const canRoll = diceType && diceCount >= 1 && diceCount <= 20 && modifier >= -99 && modifier <= 99;

  return (
    <div className={styles.modalOverlay} onClick={onClose} onKeyDown={handleKeyDown}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Tira Dado</h3>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Dice Type Selector */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Tipo di Dado</label>
            <div className={styles.diceTypeGrid}>
              {DICE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.diceTypeButton} ${diceType === type ? styles.selected : ''}`}
                  onClick={() => setDiceType(type)}
                  aria-label={`d${type}`}
                >
                  <span className={styles.diceIcon}>🎲</span>
                  <span className={styles.diceLabel}>d{type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Dice */}
          <div className={styles.section}>
            <label className={styles.sectionLabel} htmlFor="dice-count">
              Numero di Dadi
            </label>
            <div className={styles.numberInputWrapper}>
              <button
                type="button"
                className={styles.stepButton}
                onClick={() => setDiceCount(Math.max(1, diceCount - 1))}
                aria-label="Diminuisci"
                disabled={diceCount <= 1}
              >
                −
              </button>
              <input
                id="dice-count"
                type="number"
                min="1"
                max="20"
                value={diceCount}
                onChange={(e) => handleDiceCountChange(e.target.value)}
                className={styles.numberInput}
                aria-label="Numero di dadi"
              />
              <button
                type="button"
                className={styles.stepButton}
                onClick={() => setDiceCount(Math.min(20, diceCount + 1))}
                aria-label="Aumenta"
                disabled={diceCount >= 20}
              >
                +
              </button>
            </div>
            <span className={styles.helperText}>1-20 dadi</span>
          </div>

          {/* Modifier */}
          <div className={styles.section}>
            <label className={styles.sectionLabel} htmlFor="modifier">
              Modificatore (Opzionale)
            </label>
            <div className={styles.numberInputWrapper}>
              <button
                type="button"
                className={styles.stepButton}
                onClick={() => setModifier(Math.max(-99, modifier - 1))}
                aria-label="Diminuisci"
                disabled={modifier <= -99}
              >
                −
              </button>
              <input
                id="modifier"
                type="number"
                min="-99"
                max="99"
                value={modifier}
                onChange={(e) => handleModifierChange(e.target.value)}
                className={styles.numberInput}
                aria-label="Modificatore"
              />
              <button
                type="button"
                className={styles.stepButton}
                onClick={() => setModifier(Math.min(99, modifier + 1))}
                aria-label="Aumenta"
                disabled={modifier >= 99}
              >
                +
              </button>
            </div>
            <span className={styles.helperText}>-99 a +99</span>
          </div>

          {/* Preview Formula */}
          <div className={styles.previewSection}>
            <div className={styles.previewLabel}>Formula</div>
            <div className={styles.previewFormula}>{diceSpec}</div>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.modalFooter}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
          >
            Annulla
          </button>
          <button
            className={styles.rollButton}
            onClick={handleRoll}
            disabled={!canRoll}
          >
            🎲 Tira
          </button>
        </div>
      </div>
    </div>
  );
}
