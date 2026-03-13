/**
 * Forum Store (Zustand)
 *
 * Manages forum navigation state and URL hash synchronization.
 *
 * **URL Format** (Hash-based routing):
 * - /#bacheca → topics list
 * - /#bacheca/{topicSlug} → discussions list
 * - /#bacheca/{topicSlug}/{discussionSlug} → thread view
 * - /#bacheca/{topicSlug}/{discussionSlug}/{postId} → thread + scroll to post
 * - /#bacheca/search?q=term → search results
 * - /#bacheca/bookmarks → user bookmarks
 * - /#bacheca/notifications → user notifications
 * - /#bacheca/{topicSlug}/nuova-discussione → create discussion
 *
 * @module store/forumStore
 * @since 2.0.0
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ForumView } from '@/types/forum';

interface ForumStore {
  isOpen: boolean;
  view: ForumView;
  topicSlug: string | null;
  discussionSlug: string | null;
  postId: string | null;
  searchQuery: string;

  openForum: () => void;
  closeForum: () => void;
  navigateToTopics: () => void;
  navigateToDiscussions: (topicSlug: string) => void;
  navigateToThread: (topicSlug: string, discussionSlug: string) => void;
  navigateToPost: (topicSlug: string, discussionSlug: string, postId: string) => void;
  navigateToSearch: (query?: string) => void;
  navigateToBookmarks: () => void;
  navigateToNotifications: () => void;
  navigateToCreateDiscussion: (topicSlug: string) => void;
  setSearchQuery: (query: string) => void;
  syncWithUrl: () => void;
  updateUrl: () => void;
}

const HASH_PREFIX = '#bacheca';

function buildHash(state: Pick<ForumStore, 'view' | 'topicSlug' | 'discussionSlug' | 'postId' | 'searchQuery'>): string {
  switch (state.view) {
    case 'topics':
      return HASH_PREFIX;
    case 'discussions':
      return `${HASH_PREFIX}/${state.topicSlug}`;
    case 'thread':
      if (state.postId) {
        return `${HASH_PREFIX}/${state.topicSlug}/${state.discussionSlug}/${state.postId}`;
      }
      return `${HASH_PREFIX}/${state.topicSlug}/${state.discussionSlug}`;
    case 'search':
      return state.searchQuery
        ? `${HASH_PREFIX}/search?q=${encodeURIComponent(state.searchQuery)}`
        : `${HASH_PREFIX}/search`;
    case 'bookmarks':
      return `${HASH_PREFIX}/bookmarks`;
    case 'notifications':
      return `${HASH_PREFIX}/notifications`;
    case 'createDiscussion':
      return `${HASH_PREFIX}/${state.topicSlug}/nuova-discussione`;
    default:
      return HASH_PREFIX;
  }
}

function parseHash(hash: string): Partial<Pick<ForumStore, 'view' | 'topicSlug' | 'discussionSlug' | 'postId' | 'searchQuery'>> {
  if (!hash || !hash.startsWith(HASH_PREFIX)) return {};

  // Extract path and query from hash (e.g., #bacheca/search?q=test)
  const hashContent = hash.slice(1); // Remove leading #
  const [pathPart = '', queryPart] = hashContent.split('?');

  const rest = pathPart.slice('bacheca'.length);
  if (!rest || rest === '/') {
    return { view: 'topics', topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
  }

  const withoutLeadingSlash = rest.startsWith('/') ? rest.slice(1) : rest;

  if (withoutLeadingSlash.startsWith('search')) {
    const qMatch = queryPart?.match(/q=(.+)$/);
    return {
      view: 'search',
      searchQuery: qMatch?.[1] ? decodeURIComponent(qMatch[1]) : '',
      topicSlug: null,
      discussionSlug: null,
      postId: null,
    };
  }

  if (withoutLeadingSlash === 'bookmarks') {
    return { view: 'bookmarks', topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
  }

  if (withoutLeadingSlash === 'notifications') {
    return { view: 'notifications', topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
  }

  const segments = withoutLeadingSlash.split('/');

  if (segments.length === 1) {
    return { view: 'discussions', topicSlug: segments[0], discussionSlug: null, postId: null, searchQuery: '' };
  }

  if (segments.length === 2) {
    if (segments[1] === 'nuova-discussione') {
      return { view: 'createDiscussion', topicSlug: segments[0], discussionSlug: null, postId: null, searchQuery: '' };
    }
    return { view: 'thread', topicSlug: segments[0], discussionSlug: segments[1], postId: null, searchQuery: '' };
  }

  if (segments.length >= 3) {
    return { view: 'thread', topicSlug: segments[0], discussionSlug: segments[1], postId: segments[2], searchQuery: '' };
  }

  return { view: 'topics', topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
}

/**
 * Forum Store (Zustand)
 *
 * Centralized state management for forum navigation.
 * URL updates use history.replaceState for internal navigation.
 * Open/close transitions use Next.js router (handled by components).
 */
export const useForumStore = create<ForumStore>()(
  devtools(
    (set, get) => ({
      isOpen: false,
      view: 'topics',
      topicSlug: null,
      discussionSlug: null,
      postId: null,
      searchQuery: '',

      openForum: () => {
        set({ isOpen: true });
        get().syncWithUrl();
      },

      closeForum: () => {
        set({
          isOpen: false,
          view: 'topics',
          topicSlug: null,
          discussionSlug: null,
          postId: null,
          searchQuery: '',
        });
      },

      navigateToTopics: () => {
        set({ view: 'topics', topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' });
        get().updateUrl();
      },

      navigateToDiscussions: (topicSlug: string) => {
        set({ view: 'discussions', topicSlug, discussionSlug: null, postId: null });
        get().updateUrl();
      },

      navigateToThread: (topicSlug: string, discussionSlug: string) => {
        set({ view: 'thread', topicSlug, discussionSlug, postId: null });
        get().updateUrl();
      },

      navigateToPost: (topicSlug: string, discussionSlug: string, postId: string) => {
        set({ view: 'thread', topicSlug, discussionSlug, postId });
        get().updateUrl();
      },

      navigateToSearch: (query?: string) => {
        set({ view: 'search', searchQuery: query || '', topicSlug: null, discussionSlug: null, postId: null });
        get().updateUrl();
      },

      navigateToBookmarks: () => {
        set({ view: 'bookmarks', topicSlug: null, discussionSlug: null, postId: null });
        get().updateUrl();
      },

      navigateToNotifications: () => {
        set({ view: 'notifications', topicSlug: null, discussionSlug: null, postId: null });
        get().updateUrl();
      },

      navigateToCreateDiscussion: (topicSlug: string) => {
        set({ view: 'createDiscussion', topicSlug, discussionSlug: null, postId: null });
        get().updateUrl();
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      syncWithUrl: () => {
        if (typeof window === 'undefined') return;

        const hash = window.location.hash;
        if (!hash || !hash.startsWith(HASH_PREFIX)) return;

        const parsed = parseHash(hash);
        if (parsed.view) {
          set({
            view: parsed.view,
            topicSlug: parsed.topicSlug ?? null,
            discussionSlug: parsed.discussionSlug ?? null,
            postId: parsed.postId ?? null,
            searchQuery: parsed.searchQuery ?? '',
            isOpen: true,
          });
        }
      },

      updateUrl: () => {
        if (typeof window === 'undefined') return;

        const state = get();
        const hash = buildHash(state);

        // Use replaceState to avoid history pollution
        const currentPath = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', currentPath + hash);
      },
    }),
    {
      name: 'ForumStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Initialize hash listener for browser back/forward
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const store = useForumStore.getState();

    // Only sync if forum is open
    if (store.isOpen) {
      store.syncWithUrl();
    } else if (window.location.hash.startsWith('#bacheca')) {
      // If forum closed but hash present, open it
      store.openForum();
    }
  });
}

/**
 * Selector Hooks (Optimized)
 *
 * Use these instead of full store to prevent unnecessary re-renders.
 */
export const useForumView = () => useForumStore((s) => s.view);
export const useForumIsOpen = () => useForumStore((s) => s.isOpen);
export const useForumTopicSlug = () => useForumStore((s) => s.topicSlug);
export const useForumDiscussionSlug = () => useForumStore((s) => s.discussionSlug);
export const useForumPostId = () => useForumStore((s) => s.postId);
export const useForumSearchQuery = () => useForumStore((s) => s.searchQuery);
export const useForumNavContext = () =>
  useForumStore((s) => ({
    view: s.view,
    topicSlug: s.topicSlug,
    discussionSlug: s.discussionSlug,
    postId: s.postId,
  }));
