/**
 * Error Boundary Component
 *
 * Catches React errors and displays user-friendly message instead of crash overlay.
 *
 * **Features**:
 * - Catches all unhandled React errors
 * - Shows Victorian-styled error message
 * - Provides "Ricarica pagina" button to recover
 * - Logs errors to console for debugging
 *
 * **Usage**:
 * Wrap your app or components with this boundary:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 *
 * @module components/ErrorBoundary
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Error Boundary Props
 */
interface ErrorBoundaryProps {
  /**
   * Child components to wrap
   */
  children: ReactNode;

  /**
   * Optional fallback UI when error occurs
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

/**
 * Error Boundary State
 */
interface ErrorBoundaryState {
  /**
   * Whether an error has been caught
   */
  hasError: boolean;

  /**
   * The caught error (if any)
   */
  error: Error | null;
}

/**
 * Error Boundary Component
 *
 * React Error Boundary that catches errors in child components.
 *
 * @class ErrorBoundary
 * @extends {Component<ErrorBoundaryProps, ErrorBoundaryState>}
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  /**
   * Static method called when error is thrown
   *
   * @param {Error} error - The error that was thrown
   * @returns {ErrorBoundaryState} Updated state
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called after error is caught
   *
   * @param {Error} error - The error that was thrown
   * @param {ErrorInfo} errorInfo - React error info with component stack
   * @returns {void}
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console for debugging
    console.error('ErrorBoundary caught error:', error, errorInfo);

    // Note: Error tracking service (Sentry, LogRocket) can be added here in production
    // Example: errorTrackingService.logError(error, errorInfo);
  }

  /**
   * Reset error state (used by "Ricarica" button)
   *
   * @returns {void}
   */
  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  /**
   * Render method
   *
   * @returns {ReactNode} Either children or error fallback UI
   */
  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.resetError);
      }

      // Default fallback UI (Victorian-styled error message)
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            backgroundColor: '#1a0f0a',
            color: '#f5f5dc',
            fontFamily: "'IM Fell English', serif",
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '3rem',
              backgroundColor: 'rgba(139, 69, 19, 0.2)',
              border: '2px solid rgba(212, 175, 55, 0.5)',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                fontSize: '2.5rem',
                marginBottom: '1.5rem',
                color: '#ffa748',
                fontWeight: 'bold',
              }}
            >
              Si è verificato un errore
            </h1>

            <p
              style={{
                fontSize: '1.2rem',
                marginBottom: '2rem',
                lineHeight: '1.6',
                color: '#f5f5dc',
              }}
            >
              Ci scusiamo per l'inconveniente. Si è verificato un errore imprevisto durante il
              caricamento della pagina.
            </p>

            {/* Show error message in development mode */}
            {process.env.NODE_ENV === 'development' && (
              <div
                style={{
                  marginBottom: '2rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(220, 53, 69, 0.1)',
                  border: '1px solid rgba(220, 53, 69, 0.3)',
                  borderRadius: '4px',
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  color: '#dc3545',
                  wordBreak: 'break-word',
                }}
              >
                <strong>Errore (dev only):</strong>
                <br />
                {error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={this.resetError}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1.1rem',
                  fontFamily: "'IM Fell English', serif",
                  backgroundColor: '#ffa748',
                  color: '#1a0f0a',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#DAA520';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffa748';
                }}
              >
                Riprova
              </button>

              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1.1rem',
                  fontFamily: "'IM Fell English', serif",
                  backgroundColor: 'rgba(212, 175, 55, 0.2)',
                  color: '#ffa748',
                  border: '1px solid #ffa748',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.2)';
                }}
              >
                Ricarica pagina
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
