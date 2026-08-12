/**
 * Step 6: Conferma (Review) Component
 *
 * Layout matching wizard6.png:
 * - If valid: centered message + submit button
 * - If errors: validation errors only
 *
 * @module components/character/wizard/steps/Step6Review
 * @since 2.0.0
 */

'use client';

import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/Step6Review.module.scss';
import { logger } from '@/lib/logger';

interface Step6ReviewProps {
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Step 6: Conferma Component
 */
export function Step6Review({ onSubmit, isSubmitting }: Step6ReviewProps): JSX.Element {
  const { validateAll } = useWizardStore();

  // Run validation
  const validation = validateAll();

  // Elenco errori dal risultato fresco di validateAll (non da stepErrors: quello
  // si popola solo mentre l'utente interagisce con i campi, quindi resta vuoto
  // per gli step mai toccati anche se in realtà non sono validi).
  const allErrorsList: Array<{ step: string; error: string }> = Object.entries(validation.errors).map(
    ([key, error]) => {
      const stepMatch = key.match(/^step(\d+)_/);
      return { step: stepMatch?.[1] ?? '-', error };
    }
  );

  const handleSubmit = async () => {
    if (!validation.valid) return;

    try {
      await onSubmit();
    } catch (error) {
      logger.error('Submission error:', { error });
    }
  };

  return (
    <div className={styles.stepContent} data-step="conferma">
      {/* ERROR STATE: Show only validation errors */}
      {!validation.valid && (
        <div className={styles.errorBox}>
          <h4>⚠️ Errori di Validazione</h4>
          <p>Correggi i seguenti errori prima di procedere:</p>
          <ul className={styles.errorList}>
            {allErrorsList.map(({ step, error }, index) => (
              <li key={`${step}-${index}`}>
                <strong>Step {step}:</strong> {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SUCCESS STATE: Show confirmation message + submit button */}
      {validation.valid && (
        <div className={styles.confirmBox}>
          <div className={styles.confirmMessage}>
            <p className={styles.confirmTitle}>
              Hai concluso la procedura di creazione del personaggio.
            </p>
            <p className={styles.confirmSubtitle}>
              Prima dell'invio, assicurati che tutte le informazioni inserite siano corrette.
            </p>
            <p className={styles.confirmText}>
              Una volta confermato, il personaggio entrerà in fase di approvazione. Durante questo periodo non sarà
              possibile giocare, però potrai comunque consultare i documenti, esplorare la chat e familiarizzare con
              l'ambientazione.
            </p>
            <p className={styles.confirmText}>
              I tempi di revisione possono arrivare fino a 48 ore. Ti chiediamo di attendere (senza sollecitare ogni
              mezz'ora) così personaggio verrà validato se possibile.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={styles.submitButton}
          >
            {isSubmitting ? 'INVIO IN CORSO...' : 'INVIA ALLO STAFF'}
          </button>
        </div>
      )}
    </div>
  );
}
