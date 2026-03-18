/**
 * Environment Context
 *
 * Manages real-time weather and moon phase data fetched from backend.
 * Data is auto-refreshed every 5 minutes to keep UI in sync.
 * All users see identical environment data from centralized backend cache.
 *
 * @module contexts/EnvironmentContext
 * @since 2.0.0
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api/client';
import { Environment } from '@/types/api/schemas';

/**
 * API Response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Environment Context Type
 *
 * Provides weather and moon phase data to components.
 */
interface EnvironmentContextType {
  /** Current environment data (null if not loaded yet) */
  environment: Environment | null;

  /** Whether data is currently being fetched */
  isLoading: boolean;

  /** Error message if fetch failed */
  error: string | null;

  /** Manually trigger a data refresh */
  refetch: () => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

/**
 * Environment Provider Component
 *
 * Wraps application to provide environment data to all child components.
 * Auto-refreshes data every 5 minutes.
 *
 * @param children - Child components
 * @returns Provider component
 *
 * @example
 * ```tsx
 * <EnvironmentProvider>
 *   <App />
 * </EnvironmentProvider>
 * ```
 */
export function EnvironmentProvider({ children }: { children: ReactNode }): JSX.Element {
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch environment data from backend
   */
  const fetchEnvironment = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await api.get<ApiResponse<Environment>>('/game/environment');

      if (response.success && response.data) {
        setEnvironment(response.data);
        setError(null);
        console.log('[EnvironmentContext] Environment data loaded:', response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch environment');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error';
      setError(errorMessage);
      console.error('[EnvironmentContext] Failed to fetch environment:', err);

      // Keep using stale data if available
      if (!environment) {
        // No data yet - set defaults
        setEnvironment({
          condition: 'fog',
          temperature: 5,
          moonPhase: 'waning_crescent',
          moonIllumination: 0.3,
          lastUpdated: new Date().toISOString(),
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [environment]);

  // Initial fetch on mount
  useEffect(() => {
    fetchEnvironment();
  }, []);

  // Auto-refresh every 5 minutes (300000ms)
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const interval = setInterval(() => {
      console.log('[EnvironmentContext] Auto-refreshing environment data...');
      fetchEnvironment();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchEnvironment]);

  const value: EnvironmentContextType = {
    environment,
    isLoading,
    error,
    refetch: fetchEnvironment,
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
}

/**
 * Use Environment Hook
 *
 * Access environment data in any component.
 * Must be used within EnvironmentProvider.
 *
 * @returns Environment context value
 * @throws Error if used outside EnvironmentProvider
 *
 * @example
 * ```tsx
 * function WeatherDisplay() {
 *   const { environment, isLoading } = useEnvironment();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return <div>{environment?.condition}</div>;
 * }
 * ```
 */
export function useEnvironment(): EnvironmentContextType {
  const context = useContext(EnvironmentContext);

  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider');
  }

  return context;
}
