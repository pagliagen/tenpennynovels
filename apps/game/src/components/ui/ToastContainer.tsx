/**
 * Toast Container Component
 *
 * Displays toast notifications from uiStore.
 * Auto-dismisses after duration (default: 3000ms).
 *
 * CRITICAL: Must be placed at root level (_app.tsx) to show toasts globally.
 *
 * @module components/ui/ToastContainer
 * @since 3.0.0
 */

import { useUIStore } from '@/store/uiStore';
import styles from './ToastContainer.module.scss';

/**
 * Toast Container Component
 *
 * Renders all active toast notifications in a fixed position.
 * Toasts can be clicked to dismiss early.
 *
 * @component
 * @returns {JSX.Element | null} Toast container or null if no toasts
 * @since 3.0.0
 *
 * @example
 * ```tsx
 * // In _app.tsx
 * function App({ Component, pageProps }: AppProps) {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <Component {...pageProps} />
 *       <ToastContainer />
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 */
export function ToastContainer(): JSX.Element | null {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          onClick={() => removeToast(toast.id)}
          role="alert"
          aria-live="polite"
        >
          <span className={styles.icon}>
            {toast.type === 'success' && '✅'}
            {toast.type === 'error' && '❌'}
            {toast.type === 'warning' && '⚠️'}
            {toast.type === 'info' && 'ℹ️'}
          </span>
          <span className={styles.message}>{toast.message}</span>
          <button
            className={styles.closeButton}
            onClick={(e) => {
              e.stopPropagation();
              removeToast(toast.id);
            }}
            aria-label="Chiudi notifica"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
