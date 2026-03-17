/**
 * Custom App Component
 *
 * Root component that wraps all pages in the application.
 * Provides global providers, styles, and layout.
 *
 * Provider Tree (MUST RESPECT ORDER):
 * 1. QueryClientProvider - TanStack Query for API calls
 * 2. AuthProvider - Authentication state (MUST be above WebSocket)
 * 3. WebSocketProvider - Real-time events (depends on Auth)
 * 4. EnvironmentProvider - Weather/moon data (public, auto-refresh every 5 min)
 * 5. GlobalLayout - UI theme, error boundaries, toasts
 *
 * Features:
 * - React Query integration with devtools (dev mode only)
 * - WebSocket connection with auto-reconnect
 * - Authentication state management
 * - Theme persistence (localStorage)
 * - Global error boundaries
 *
 * @module pages/_app
 * @since 2.0.0
 */

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/api/queryClient';

/** Devtools caricati solo sul client e solo in dev (pacchetto in devDependencies, assente in prod) */
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamic(
      () => import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })),
      { ssr: false }
    )
  : () => null;
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { EnvironmentProvider } from '@/contexts/EnvironmentContext';
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { ToastContainer } from '@/components/ui/ToastContainer';
import '@/styles/main.scss';

/**
 * Custom App Component
 *
 * Wraps all pages with necessary providers and global configuration.
 * This component renders on BOTH server and client side.
 *
 * @component
 * @param {AppProps} props - Next.js app props
 * @param {React.ComponentType} props.Component - Current page component
 * @param {any} props.pageProps - Props for current page
 * @returns {JSX.Element} Wrapped application
 * @since 2.0.0
 *
 * @example
 * // This component is automatically used by Next.js
 * // No need to import or use directly
 */
export default function App({ Component, pageProps }: AppProps): JSX.Element {
  /**
   * Presence cleanup on beforeunload
   *
   * When user closes tab, send immediate cleanup request via navigator.sendBeacon.
   * This is MORE RELIABLE than fetch() which may be cancelled during unload.
   *
   * Backend endpoint: POST /game/presence/leave (cookie-based auth)
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const endpoint = `${apiUrl}/game/presence/leave`;

      // Get auth token from cookie (sendBeacon can't use fetch interceptors)
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1];

      if (token) {
        const data = JSON.stringify({ timestamp: Date.now() });
        // navigator.sendBeacon is guaranteed delivery even if tab closes immediately
        navigator.sendBeacon(endpoint, data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      {/* Auth Initializer - Verifies session before rendering */}
      <AuthInitializer>
        {/* WebSocket Provider - Handles real-time events */}
        <WebSocketProvider>
          {/* Environment Provider - Weather/moon data (public, auto-refresh) */}
          <EnvironmentProvider>
            {/* Page Component */}
            <Component {...pageProps} />

            {/* Toast Container - Global notifications (403, permission errors, etc.) */}
            <ToastContainer />

            {/* React Query Devtools (dynamic import, solo in dev; in prod è no-op) */}
            <ReactQueryDevtools initialIsOpen={false} />
          </EnvironmentProvider>
        </WebSocketProvider>
      </AuthInitializer>
    </QueryClientProvider>
  );
}
