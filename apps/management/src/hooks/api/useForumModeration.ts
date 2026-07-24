import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as forumModerationAPI from '@/lib/api/forumModeration';
import type {
  ForumDiscussionListParams,
  UpdateForumDiscussionData,
  ForumPostListParams,
} from '@/types/api/ForumModeration';

export const forumDiscussionAdminKeys = {
  all: ['admin', 'forumDiscussionsModeration'] as const,
  lists: () => [...forumDiscussionAdminKeys.all, 'list'] as const,
  list: (params: ForumDiscussionListParams) => [...forumDiscussionAdminKeys.lists(), params] as const,
};

export const forumPostAdminKeys = {
  all: ['admin', 'forumPostsModeration'] as const,
  lists: () => [...forumPostAdminKeys.all, 'list'] as const,
  list: (params: ForumPostListParams) => [...forumPostAdminKeys.lists(), params] as const,
};

// ── Discussions ─────────────────────────────────────────────────────

export function useForumDiscussionsAdmin(params: ForumDiscussionListParams) {
  return useQuery({
    queryKey: forumDiscussionAdminKeys.list(params),
    queryFn: () => forumModerationAPI.getForumDiscussionsAdmin(params),
    staleTime: 60 * 1000,
    retry: 3,
  });
}

export function useUpdateForumDiscussionAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ discussionId, data }: { discussionId: string; data: UpdateForumDiscussionData }) =>
      forumModerationAPI.updateForumDiscussionAdmin(discussionId, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumDiscussionAdminKeys.lists() });
    },
  });
}

export function useDeleteForumDiscussionAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (discussionId: string) => forumModerationAPI.deleteForumDiscussionAdmin(discussionId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumDiscussionAdminKeys.lists() });
    },
  });
}

export function useRestoreForumDiscussionAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (discussionId: string) => forumModerationAPI.restoreForumDiscussionAdmin(discussionId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumDiscussionAdminKeys.lists() });
    },
  });
}

// ── Posts ───────────────────────────────────────────────────────────

export function useForumPostsAdmin(params: ForumPostListParams) {
  return useQuery({
    queryKey: forumPostAdminKeys.list(params),
    queryFn: () => forumModerationAPI.getForumPostsAdmin(params),
    staleTime: 60 * 1000,
    retry: 3,
  });
}

export function usePinForumPostAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, pinned }: { postId: string; pinned: boolean }) =>
      forumModerationAPI.pinForumPostAdmin(postId, pinned),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumPostAdminKeys.lists() });
    },
  });
}

export function useDeleteForumPostAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => forumModerationAPI.deleteForumPostAdmin(postId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumPostAdminKeys.lists() });
    },
  });
}

export function useRestoreForumPostAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => forumModerationAPI.restoreForumPostAdmin(postId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: forumPostAdminKeys.lists() });
    },
  });
}
