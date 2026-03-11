import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as itemAPI from '@/lib/api/items';
import type {
  ItemListParams,
  CreateItemData,
  UpdateItemData
} from '@/types/api/Item';

export const itemKeys = {
  all: ['admin', 'items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (params: ItemListParams) => [...itemKeys.lists(), params] as const,
  details: () => [...itemKeys.all, 'detail'] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const
};

export function useItems(params: ItemListParams) {
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => itemAPI.getItems(params),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: itemKeys.detail(id),
    queryFn: () => itemAPI.getItemById(id),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!id
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateItemData) => itemAPI.createItem(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    }
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateItemData }) =>
      itemAPI.updateItem(id, data),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.id) });
    }
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      itemAPI.deleteItem(id, reason),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    }
  });
}
