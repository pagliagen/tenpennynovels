/**
 * Forum Store (Zustand)
 *
 * Manages forum navigation state and URL hash synchronization.
 *
 * **URL Format** (Hash-based routing):
 * - /#bacheca → categories list (root)
 * - /#bacheca/categorie/{categorySlug} → topics list, filtered by category
 * - /#bacheca/tutti → topics list, unfiltered (includes uncategorized topics)
 * - /#bacheca/{topicSlug} → discussions list
 * - /#bacheca/{topicSlug}/{discussionSlug} → thread view
 * - /#bacheca/{topicSlug}/{discussionSlug}/{postId} → thread + scroll to post
 * - /#bacheca/search?q=term → search results
 * - /#bacheca/bookmarks → user bookmarks
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
  isCollapsed: boolean;
  view: ForumView;
  categorySlug: string | null;
  topicSlug: string | null;
  discussionSlug: string | null;
  postId: string | null;
  searchQuery: string;

  openForum: () => void;
  closeForum: () => void;
  collapseForum: () => void;
  expandForum: () => void;
  navigateToCategories: () => void;
  navigateToTopics: () => void;
  navigateToTopicsInCategory: (categorySlug: string) => void;
  navigateToDiscussions: (topicSlug: string) => void;
  navigateToThread: (topicSlug: string, discussionSlug: string) => void;
  navigateToPost: (topicSlug: string, discussionSlug: string, postId: string) => void;
  navigateToSearch: (query?: string) => void;
  navigateToBookmarks: () => void;
  navigateToCreateDiscussion: (topicSlug: string) => void;
  setSearchQuery: (query: string) => void;
  syncWithUrl: () => void;
  updateUrl: () => void;
}

const HASH_PREFIX = '#bacheca';

type HashState = Pick<ForumStore, 'view' | 'categorySlug' | 'topicSlug' | 'discussionSlug' | 'postId' | 'searchQuery'>;

function buildHash(state: HashState): string {
  switch (state.view) {
    case 'categories':
      return HASH_PREFIX;
    case 'topics':
      return state.categorySlug
        ? `${HASH_PREFIX}/categorie/${state.categorySlug}`
        : `${HASH_PREFIX}/tutti`;
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
    case 'createDiscussion':
      return `${HASH_PREFIX}/${state.topicSlug}/nuova-discussione`;
    default:
      return HASH_PREFIX;
  }
}

function parseHash(hash: string): Partial<HashState> {
  if (!hash || !hash.startsWith(HASH_PREFIX)) return {};

  // Extract path and query from hash (e.g., #bacheca/search?q=test)
  const hashContent = hash.slice(1); // Remove leading #
  const [pathPart = '', queryPart] = hashContent.split('?');

  const rest = pathPart.slice('bacheca'.length);
  if (!rest || rest === '/') {
    return { view: 'categories', categorySlug: null, topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
  }

  const withoutLeadingSlash = rest.startsWith('/') ? rest.slice(1) : rest;

  if (withoutLeadingSlash.startsWith('search')) {
    const qMatch = queryPart?.match(/q=(.+)$/);
    return {
      view: 'search',
      searchQuery: qMatch?.[1] ? decodeURIComponent(qMatch[1]) : '',
      categorySlug: null,
      topicSlug: null,
      discussionSlug: null,
      postId: null,
    };
  }

  if (withoutLeadingSlash === 'bookmarks') {
    return { view: 'bookmarks', categorySlug: null, topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
  }

  if (withoutLeadingSlash === 'tutti') {
    return { view: 'topics', categorySlug: null, topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
  }

  const segments = withoutLeadingSlash.split('/');

  if (segments[0] === 'categorie' && segments.length === 2) {
    return { view: 'topics', categorySlug: segments[1], topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
  }

  if (segments.length === 1) {
    return { view: 'discussions', categorySlug: null, topicSlug: segments[0], discussionSlug: null, postId: null, searchQuery: '' };
  }

  if (segments.length === 2) {
    if (segments[1] === 'nuova-discussione') {
      return { view: 'createDiscussion', categorySlug: null, topicSlug: segments[0], discussionSlug: null, postId: null, searchQuery: '' };
    }
    return { view: 'thread', categorySlug: null, topicSlug: segments[0], discussionSlug: segments[1], postId: null, searchQuery: '' };
  }

  if (segments.length >= 3) {
    return { view: 'thread', categorySlug: null, topicSlug: segments[0], discussionSlug: segments[1], postId: segments[2], searchQuery: '' };
  }

  return { view: 'categories', categorySlug: null, topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' };
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
      isCollapsed: false,
      view: 'categories',
      categorySlug: null,
      topicSlug: null,
      discussionSlug: null,
      postId: null,
      searchQuery: '',

      openForum: () => {
        set({ isOpen: true, isCollapsed: false });
        get().syncWithUrl();
      },

      closeForum: () => {
        set({
          isOpen: false,
          isCollapsed: false,
          view: 'categories',
          categorySlug: null,
          topicSlug: null,
          discussionSlug: null,
          postId: null,
          searchQuery: '',
        });
      },

      collapseForum: () => {
        set({ isCollapsed: true });
      },

      expandForum: () => {
        set({ isCollapsed: false });
      },

      navigateToCategories: () => {
        set({ view: 'categories', categorySlug: null, topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' });
        get().updateUrl();
      },

      navigateToTopics: () => {
        set({ view: 'topics', categorySlug: null, topicSlug: null, discussionSlug: null, postId: null, searchQuery: '' });
        get().updateUrl();
      },

      navigateToTopicsInCategory: (categorySlug: string) => {
        set({ view: 'topics', categorySlug, topicSlug: null, discussionSlug: null, postId: null });
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
        set({ view: 'search', searchQuery: query || '', categorySlug: null, topicSlug: null, discussionSlug: null, postId: null });
        get().updateUrl();
      },

      navigateToBookmarks: () => {
        set({ view: 'bookmarks', categorySlug: null, topicSlug: null, discussionSlug: null, postId: null });
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
            categorySlug: parsed.categorySlug ?? null,
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
  // Deep link on first load: hashchange never fires for a hash that's already
  // in the URL when the page loads (e.g. a shared #bacheca link), so open here too.
  if (window.location.hash.startsWith('#bacheca')) {
    useForumStore.getState().openForum();
  }

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
export const useForumIsCollapsed = () => useForumStore((s) => s.isCollapsed);
export const useForumCategorySlug = () => useForumStore((s) => s.categorySlug);
export const useForumTopicSlug = () => useForumStore((s) => s.topicSlug);
export const useForumDiscussionSlug = () => useForumStore((s) => s.discussionSlug);
export const useForumPostId = () => useForumStore((s) => s.postId);
export const useForumSearchQuery = () => useForumStore((s) => s.searchQuery);
export const useForumNavContext = () =>
  useForumStore((s) => ({
    view: s.view,
    categorySlug: s.categorySlug,
    topicSlug: s.topicSlug,
    discussionSlug: s.discussionSlug,
    postId: s.postId,
  }));
