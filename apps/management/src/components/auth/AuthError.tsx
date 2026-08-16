/**
 * Auth Error Component
 *
 * Displays authentication error page with clear message and action button.
 * Used when session verification fails or server is unavailable.
 *
 * @module components/auth/AuthError
 * @since 1.0.0
 */

'use client';

import styles from '@/styles/components/auth/AuthError.module.scss';

/**
 * Auth Error Props
 *
 * @interface AuthErrorProps
 * @since 1.0.0
 */
interface AuthErrorProps {
  /** Error type */
  type: 'network' | 'session' | 'server';

  /** Optional error message override */
  message?: string;
}

/**
 * Auth Error Component
 *
 * Displays full-page error with explanation and action button.
 *
 * @component
 * @param {AuthErrorProps} props - Component props
 * @returns {JSX.Element}
 * @since 1.0.0
 */
export function AuthError({ type, message }: AuthErrorProps): JSX.Element {
  const errorConfig = {
    network: {
      title: 'Impossibile connettersi al server',
      message: 'Il server di autenticazione non è raggiungibile. Verifica la tua connessione internet o riprova tra qualche minuto.',
      emoji: '🔌',
    },
    session: {
      title: 'Sessione non valida',
      message: 'La tua sessione è scaduta o non è valida. Effettua nuovamente il login per continuare.',
      emoji: '🔐',
    },
    server: {
      title: 'Servizio temporaneamente non disponibile',
      message: 'Il server sta riscontrando problemi tecnici. Stiamo lavorando per ripristinare il servizio al più presto.',
      emoji: '⚠️',
    },
  };

  const config = errorConfig[type];
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.emoji}>
          {config.emoji}
        </div>

        <h1 className={styles.heading}>
          {config.title}
        </h1>

        <p className={styles.message}>
          {message || config.message}
        </p>

        <button
          type="button"
          onClick={() => {
            window.location.href = `${landingUrl}`;
          }}
          className={styles.loginButton}
        >
          Vai al Login
        </button>

        <p className={styles.footerNote}>
          Se il problema persiste, contatta l'amministrazione.
        </p>
      </div>
    </div>
  );
}
