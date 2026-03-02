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
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/api/queryClient';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { EnvironmentProvider } from '@/contexts/EnvironmentContext';
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import '@/styles/globals.css';

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
  return (
    <QueryClientProvider client={queryClient}>
      {/* Auth Initializer - Verifies session before rendering */}
      <AuthInitializer>
        {/* WebSocket Provider - Handles real-time events */}
        <WebSocketProvider>
          {/* Environment Provider - Weather/moon data (public, auto-refresh) */}
          <EnvironmentProvider>
            {/* Page Component */}
            <Component {...pageProps} />

            {/* React Query Devtools (dev mode only) */}
            {process.env.NODE_ENV === 'development' && (
              <ReactQueryDevtools initialIsOpen={false} />
            )}
          </EnvironmentProvider>
        </WebSocketProvider>
      </AuthInitializer>
    </QueryClientProvider>
  );
}
