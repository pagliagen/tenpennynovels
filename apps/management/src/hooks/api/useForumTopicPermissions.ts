import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as forumTopicPermissionsAPI from '@/lib/api/forumTopicPermissions';
import type { ForumTopicPermissionOverrideValues } from '@/types/api/ForumTopicPermission';

export const forumTopicPermissionKeys = {
  all: ['admin', 'forumTopicPermissions'] as const,
  list: (topicId: string) => [...forumTopicPermissionKeys.all, 'list', topicId] as const,
};

export function useForumTopicPermissions(topicId: string | null) {
  return useQuery({
    queryKey: forumTopicPermissionKeys.list(topicId ?? ''),
    queryFn: () => forumTopicPermissionsAPI.getForumTopicPermissions(topicId as string),
    enabled: !!topicId,
    staleTime: 60 * 1000,
  });
}

export function useUpsertForumTopicPermission(topicId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, data }: { characterId: string; data: { overrides: ForumTopicPermissionOverrideValues; reason?: string } }) =>
      forumTopicPermissionsAPI.upsertForumTopicPermission(topicId as string, characterId, data),
    onSettled: () => {
      if (topicId) queryClient.invalidateQueries({ queryKey: forumTopicPermissionKeys.list(topicId) });
    }
  });
}

export function useDeleteForumTopicPermission(topicId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: string) => forumTopicPermissionsAPI.deleteForumTopicPermission(topicId as string, characterId),
    onSettled: () => {
      if (topicId) queryClient.invalidateQueries({ queryKey: forumTopicPermissionKeys.list(topicId) });
    }
  });
}
