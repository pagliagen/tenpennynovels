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
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { bootstrapRenderers } from '@/lib/cellRenderers';
import { runStorageMigrations } from '@/lib/storage/migrations';
import '@/styles/globals.scss';

// Bootstrap cell renderers on app start
bootstrapRenderers();

export default function App({ Component, pageProps }: AppProps) {
  // Run storage migrations on mount
  useEffect(() => {
    runStorageMigrations();
  }, []);

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
