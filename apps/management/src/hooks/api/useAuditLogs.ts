/**
 * Audit Logs TanStack Query Hook
 *
 * Hook per gestire state management audit logs con:
 * - Cache automatica (5 minuti staleTime)
 * - Retry automatico (3x exponential backoff)
 * - Query key factory per consistenza
 */

import { useQuery } from '@tanstack/react-query';
import { systemAPI, type AuditLogParams } from '@/lib/api/system';

/**
 * Query key factory per consistenza
 */
export const auditLogKeys = {
  all: ['admin', 'audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (params: AuditLogParams) => [...auditLogKeys.lists(), params] as const
};

/**
 * Hook per recuperare audit logs paginati
 */
export function useAuditLogs(params: AuditLogParams) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: () => systemAPI.getAuditLogs(params),
    staleTime: 5 * 60 * 1000, // 5 minuti
    retry: 3
  });
}
