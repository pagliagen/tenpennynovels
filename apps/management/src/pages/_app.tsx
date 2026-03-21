/**
 * App Shell - Next.js _app.tsx
 *
 * Setup:
 * - QueryClientProvider (TanStack Query)
 * - Auth verification (AuthInitializer)
 * - Cell renderer bootstrap
 * - Global styles
 * - Storage migrations
 */

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/api/queryClient';

/** Devtools caricati solo sul client e solo in dev (pacchetto in devDependencies, assente in prod) */
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamic(
      () => import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })),
      { ssr: false }
    )
  : () => null;
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { bootstrapRenderers } from '@/lib/cellRenderers';
import { runStorageMigrations } from '@/lib/storage/migrations';
import '@/styles/globals.scss';

// Bootstrap cell renderers on app start
bootstrapRenderers();

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isSessionReady, setIsSessionReady] = useState(false);

  /**
   * Initialize sessionId from query parameter
   *
   * ✅ CRITICAL: Wait for router.query to be ready, then process sessionId
   * When redirecting from game app (different origin), sessionStorage is NOT shared.
   * Game app passes sessionId as query param: ?sessionId=xxx
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
        sessionStorage.setItem('character_session_id', sessionId);
        console.log('[Management App] SessionId received and saved:', sessionId);

        // Clean URL
        router.replace(router.pathname, undefined, { shallow: true });
      } catch (error) {
        console.error('[Management App] Failed to save sessionId:', error);
      }
    }

    // Mark session as ready (either saved or no sessionId in URL)
    setIsSessionReady(true);
  }, [router.isReady, router.query.sessionId]);

  // Run storage migrations on mount
  useEffect(() => {
    runStorageMigrations();
  }, []);

  // ✅ CRITICAL: Don't render AuthInitializer until sessionId is processed
  // This prevents race condition where useAuth runs before sessionId is saved
  if (!isSessionReady) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '1.5rem',
          color: '#555',
        }}
      >
        Initializing...
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      <AuthInitializer>
        <Component {...pageProps} />
        {/* React Query Devtools (dynamic import, solo in dev; in prod è no-op) */}
        <ReactQueryDevtools initialIsOpen={false} />
      </AuthInitializer>
    </QueryClientProvider>
  );
}
