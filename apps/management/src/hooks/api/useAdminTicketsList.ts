import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { AdminTicketRow } from '@/types/api/AdminTicket';
import type { ListResponse, PaginationInfo } from '@/types/api/common';

export const adminTicketsQueryKeys = {
  all: ['admin', 'tickets'] as const,
  list: (params: Record<string, unknown>) =>
    [...adminTicketsQueryKeys.all, 'list', params] as const,
  characterApprovals: (params: Record<string, unknown>) =>
    [...adminTicketsQueryKeys.all, 'character-approvals', params] as const,
};

export interface AdminTicketsListResult {
  list: AdminTicketRow[];
  pagination: PaginationInfo;
}

function defaultPagination(pageSize: number): PaginationInfo {
  return {
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    pageSize,
  };
}

export async function fetchAdminTicketsList(
  params: Record<string, string | number | boolean | undefined>
): Promise<AdminTicketsListResult> {
  const pageSize = Number(params.pageSize) || 25;
  const response = (await api.get(
    `/admin/tickets${api.buildQueryString(params)}`
  )) as ListResponse<AdminTicketRow>;
  return {
    list: response.list ?? [],
    pagination: response.pagination ?? defaultPagination(pageSize),
  };
}

type AdminTicketsParams = Record<string, string | number | boolean | undefined>;

export function useAdminTicketsListQuery(options: {
  variant: 'list' | 'character-approvals';
  params: AdminTicketsParams;
}): UseQueryResult<AdminTicketsListResult, Error> {
  const { variant, params } = options;
  const apiParams: AdminTicketsParams =
    variant === 'character-approvals'
      ? { ...params, category: 'character_approval' }
      : params;

  const queryKey =
    variant === 'character-approvals'
      ? adminTicketsQueryKeys.characterApprovals(params)
      : adminTicketsQueryKeys.list(params);

  return useQuery({
    queryKey,
    queryFn: () => fetchAdminTicketsList(apiParams),
  });
}
