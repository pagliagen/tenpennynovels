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

import { QueryClientProvider } from '@tanstack/react-query';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import sessionBootStyles from '@/styles/SessionBoot.module.scss';


/** Devtools caricati solo sul client e solo in dev (pacchetto in devDependencies, assente in prod) */
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamic(
      () => import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })),
      { ssr: false }
    )
  : () => null;
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { EnvironmentProvider } from '@/contexts/EnvironmentContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { queryClient } from '@/lib/api/queryClient';
import { logger } from '@/lib/logger';
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
  const router = useRouter();
  const [isSessionReady, setIsSessionReady] = useState(false);

  /**
   * Initialize sessionId from query parameter
   *
   * ✅ CRITICAL: Wait for router.query to be ready, then process sessionId
   * When redirecting from landing app (different origin), sessionStorage is NOT shared.
   * Landing app passes sessionId as query param: ?sessionId=xxx
   * This effect reads it and saves to sessionStorage (once).
   *
   * Flow:
   * 1. User selects character in landing app (localhost:4001)
   * 2. Landing redirects to game: localhost:3010?sessionId=xxx
   * 3. Router.isReady becomes true, router.query is populated
   * 4. This effect runs, saves sessionId to sessionStorage
   * 5. setIsSessionReady(true) allows AuthInitializer to render
   * 6. sessionId is now available for API interceptor (X-Session-Id header)
   *
   * RACE CONDITION FIX: Don't let AuthInitializer run until we've processed sessionId
   */
  useEffect(() => {
    // Wait for router to be ready (router.query populated)
    if (!router.isReady) {
      return;
    }

    const { sessionId } = router.query;

    if (sessionId && typeof sessionId === 'string') {
      try {
        // Save to sessionStorage (game app origin: localhost:3010)
        sessionStorage.setItem('character_session_id', sessionId);
        if (process.env.NODE_ENV === 'development') {
          logger.info('[App] SessionId received from landing and saved to sessionStorage');
        }

        // Clean URL (remove query param) for better UX
        router.replace(router.pathname, undefined, { shallow: true });
      } catch (error) {
        logger.error('[App] Failed to save sessionId to sessionStorage:', { error });
      }
    }

    // Mark session as ready (either saved or no sessionId in URL)
    setIsSessionReady(true);
  }, [router.isReady, router.query.sessionId]);

  /**
   * Presence cleanup on beforeunload
   *
   * When user closes tab, send immediate cleanup request via navigator.sendBeacon.
   * This is MORE RELIABLE than fetch() which may be cancelled during unload.
   *
   * NEW FLOW (Multi-Tab Support):
   * - Read sessionId from sessionStorage (isolated per tab)
   * - Send sessionId in request body (sendBeacon doesn't support custom headers)
   * - Backend validates session ownership (session.userId === auth_token.userId)
   * - Backend deletes session from Redis
   *
   * Backend endpoint: POST /game/presence/leave (dual auth: cookie + sessionId)
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const endpoint = `${apiUrl}/game/presence/leave`;

      // NEW: Read sessionId from sessionStorage (multi-tab support)
      const sessionId = sessionStorage.getItem('character_session_id');

      if (!sessionId) {
        // No session to cleanup (user not logged in with character)
        return;
      }

      // WORKAROUND: sendBeacon doesn't support custom headers
      // Send sessionId in request body (backend reads from body OR header)
      const data = new Blob(
        [JSON.stringify({ sessionId })],
        { type: 'application/json' }
      );

      // navigator.sendBeacon is guaranteed delivery even if tab closes immediately
      const sent = navigator.sendBeacon(endpoint, data);

      if (!sent) {
        logger.warn('[Cleanup] sendBeacon failed - session may not be cleaned up');
      }

      // sessionStorage auto-cleared on tab close (no manual cleanup needed)
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // ✅ CRITICAL: Don't render AuthInitializer until sessionId is processed
  // This prevents race condition where useAuth runs before sessionId is saved
  if (!isSessionReady) {
    return (
      <div className={sessionBootStyles.root}>
        Initializing...
      </div>
    );
  }

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
