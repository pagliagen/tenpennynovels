import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as forumCategoryAPI from '@/lib/api/forumCategories';
import type {
  ForumCategoryListParams,
  CreateForumCategoryData,
  UpdateForumCategoryData
} from '@/types/api/ForumCategory';

export const forumCategoryKeys = {
  all: ['admin', 'forumCategories'] as const,
  lists: () => [...forumCategoryKeys.all, 'list'] as const,
  list: (params: ForumCategoryListParams) => [...forumCategoryKeys.lists(), params] as const,
  details: () => [...forumCategoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...forumCategoryKeys.details(), id] as const
};

export function useForumCategories(params: ForumCategoryListParams) {
  return useQuery({
    queryKey: forumCategoryKeys.list(params),
    queryFn: () => forumCategoryAPI.getForumCategories(params),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useForumCategory(categoryId: string) {
  return useQuery({
    queryKey: forumCategoryKeys.detail(categoryId),
    queryFn: () => forumCategoryAPI.getForumCategory(categoryId),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!categoryId
  });
}

export function useCreateForumCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateForumCategoryData) => forumCategoryAPI.createForumCategory(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumCategoryKeys.lists() });
    }
  });
}

export function useUpdateForumCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: UpdateForumCategoryData }) =>
      forumCategoryAPI.updateForumCategory(categoryId, data),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: forumCategoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: forumCategoryKeys.detail(variables.categoryId) });
    }
  });
}

export function useDeleteForumCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId }: { categoryId: string }) =>
      forumCategoryAPI.deleteForumCategory(categoryId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumCategoryKeys.lists() });
    }
  });
}
