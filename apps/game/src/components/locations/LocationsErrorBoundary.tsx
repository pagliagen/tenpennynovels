/**
 * Locations Error Boundary Component
 *
 * React Error Boundary for graceful error handling in locations system.
 * Catches JavaScript errors anywhere in the locations component tree,
 * logs the error, and displays a fallback UI.
 *
 * @module components/locations/LocationsErrorBoundary
 * @since 2.0.0
 */

'use client';

import { Component, ReactNode, ErrorInfo } from 'react';

import styles from '@/styles/components/locations/error-boundary.module.scss';
import { logger } from '@/lib/logger';

/**
 * Error Boundary Props
 */
interface LocationsErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

/**
 * Error Boundary State
 */
interface LocationsErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error object */
  error: Error | null;
  /** Error stack trace */
  errorInfo: ErrorInfo | null;
}

/**
 * Locations Error Boundary Component
 *
 * Wraps location components to catch and handle errors gracefully.
 * Provides fallback UI with retry functionality.
 *
 * @component
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * <LocationsErrorBoundary>
 *   <LocationsMap />
 * </LocationsErrorBoundary>
 * ```
 */
export class LocationsErrorBoundary extends Component<
  LocationsErrorBoundaryProps,
  LocationsErrorBoundaryState
> {
  constructor(props: LocationsErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<LocationsErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error details to console and error tracking service
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    logger.error('🚨 [LocationsErrorBoundary] Caught error:', { error });
    logger.error('Error info:', { errorInfo });

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Note: Error tracking service (Sentry) can be added here in production
    // reportError(error, errorInfo);
  }

  /**
   * Reset error state and retry
   */
  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Navigate back to safe location (dashboard or home)
   */
  handleGoBack = (): void => {
    window.location.href = '/dashboard';
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    // No error - render children normally
    if (!hasError) {
      return children;
    }

    // Custom fallback provided
    if (fallback) {
      return fallback;
    }

    // Default error UI
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <div className={styles.errorIcon}>⚠️</div>
          <h2 className={styles.errorTitle}>Impossibile caricare le location</h2>
          <p className={styles.errorMessage}>
            Si è verificato un errore durante il caricamento del sistema di navigazione.
          </p>

          {/* Error details (development only) */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className={styles.errorDetails}>
              <summary className={styles.errorDetailsSummary}>
                Dettagli tecnici (solo in sviluppo)
              </summary>
              <div className={styles.errorDetailsContent}>
                <strong>Error:</strong>
                <pre>{error.toString()}</pre>
                {errorInfo && (
                  <>
                    <strong>Component Stack:</strong>
                    <pre>{errorInfo.componentStack}</pre>
                  </>
                )}
              </div>
            </details>
          )}

          {/* Action buttons */}
          <div className={styles.errorActions}>
            <button
              type="button"
              onClick={this.handleRetry}
              className={styles.retryButton}
            >
              Riprova
            </button>
            <button
              type="button"
              onClick={this.handleGoBack}
              className={styles.backButton}
            >
              Torna alla Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
