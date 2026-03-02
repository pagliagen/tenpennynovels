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
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/api/queryClient';
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
      <AuthInitializer>
        <Component {...pageProps} />
        {/* DevTools only in development */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </AuthInitializer>
    </QueryClientProvider>
  );
}
