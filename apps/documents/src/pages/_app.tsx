/**
 * Custom App Component
 *
 * Initializes QueryClient for TanStack Query and applies global layout.
 * Includes auth verification via AuthInitializer.
 *
 * @module pages/_app
 * @since 1.0.0
 */

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import Head from 'next/head';
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
import { DocumentsLayout } from '@/components/layout/DocumentsLayout';
import '@/styles/globals.scss';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      <AuthInitializer>
        <DocumentsLayout>
          <Component {...pageProps} />
        </DocumentsLayout>

        {/* React Query Devtools (dynamic import, solo in dev; in prod è no-op) */}
        <ReactQueryDevtools initialIsOpen={false} />
      </AuthInitializer>
    </QueryClientProvider>
  );
}
