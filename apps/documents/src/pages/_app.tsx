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
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/api/queryClient';
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { DocumentsLayout } from '@/components/layout/DocumentsLayout';
import '@/styles/globals.scss';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <DocumentsLayout>
          <Component {...pageProps} />
        </DocumentsLayout>

        {/* React Query Devtools (only in development) */}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </AuthInitializer>
    </QueryClientProvider>
  );
}
