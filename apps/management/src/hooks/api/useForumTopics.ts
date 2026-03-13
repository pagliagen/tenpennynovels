import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as forumTopicAPI from '@/lib/api/forumTopics';
import type {
  ForumTopicListParams,
  CreateForumTopicData,
  UpdateForumTopicData
} from '@/types/api/ForumTopic';

export const forumTopicKeys = {
  all: ['admin', 'forumTopics'] as const,
  lists: () => [...forumTopicKeys.all, 'list'] as const,
  list: (params: ForumTopicListParams) => [...forumTopicKeys.lists(), params] as const,
  details: () => [...forumTopicKeys.all, 'detail'] as const,
  detail: (id: string) => [...forumTopicKeys.details(), id] as const
};

export function useForumTopics(params: ForumTopicListParams) {
  return useQuery({
    queryKey: forumTopicKeys.list(params),
    queryFn: () => forumTopicAPI.getForumTopics(params),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useForumTopic(topicId: string) {
  return useQuery({
    queryKey: forumTopicKeys.detail(topicId),
    queryFn: () => forumTopicAPI.getForumTopic(topicId),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!topicId
  });
}

export function useCreateForumTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateForumTopicData) => forumTopicAPI.createForumTopic(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumTopicKeys.lists() });
    }
  });
}

export function useUpdateForumTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topicId, data }: { topicId: string; data: UpdateForumTopicData }) =>
      forumTopicAPI.updateForumTopic(topicId, data),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: forumTopicKeys.lists() });
      queryClient.invalidateQueries({ queryKey: forumTopicKeys.detail(variables.topicId) });
    }
  });
}

export function useDeleteForumTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topicId }: { topicId: string }) =>
      forumTopicAPI.deleteForumTopic(topicId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumTopicKeys.lists() });
    }
  });
}
