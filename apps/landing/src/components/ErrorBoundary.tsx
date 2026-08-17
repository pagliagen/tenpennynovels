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

import { logger } from '@/lib/logger';
import styles from '@/styles/components/ErrorBoundary.module.scss';

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
    logger.error('ErrorBoundary caught error', { error, errorInfo });

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
        <div className={styles.root}>
          <div className={styles.card}>
            <h1 className={styles.title}>
              Si è verificato un errore
            </h1>

            <p className={styles.lead}>
              Ci scusiamo per l'inconveniente. Si è verificato un errore imprevisto durante il
              caricamento della pagina.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <div className={styles.devBox}>
                <strong>Errore (dev only):</strong>
                <br />
                {error.message}
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" onClick={this.resetError} className={styles.primaryButton}>
                Riprova
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className={styles.secondaryButton}
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
