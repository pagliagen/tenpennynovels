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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'Playfair Display, serif',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        color: '#f5f5f5',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          textAlign: 'center',
          padding: '3rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(139, 69, 19, 0.3)',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>
          {config.emoji}
        </div>

        <h1
          style={{
            fontSize: '2rem',
            marginBottom: '1rem',
            color: '#D4AF37',
            fontWeight: 'bold',
          }}
        >
          {config.title}
        </h1>

        <p
          style={{
            fontSize: '1.1rem',
            lineHeight: '1.6',
            marginBottom: '2rem',
            color: '#cccccc',
          }}
        >
          {message || config.message}
        </p>

        <button
          onClick={() => {
            window.location.href = `${landingUrl}/auth/login`;
          }}
          style={{
            padding: '1rem 2rem',
            fontSize: '1rem',
            fontFamily: 'Playfair Display, serif',
            fontWeight: 'bold',
            color: '#1a1a1a',
            background: '#D4AF37',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#B8941E';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(212, 175, 55, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#D4AF37';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 175, 55, 0.3)';
          }}
        >
          Vai al Login
        </button>

        <p
          style={{
            marginTop: '2rem',
            fontSize: '0.9rem',
            color: '#888',
          }}
        >
          Se il problema persiste, contatta l'amministrazione del gioco.
        </p>
      </div>
    </div>
  );
}
