/**
 * ForumSerializer
 *
 * Centralizes response-shaping rules that depend on the viewer rather than
 * pure access control (that's ForumAccessService). Currently: masking the
 * author of anonymous posts for viewers without moderation access.
 *
 * CRITICAL: masking happens ONLY here, at serialization time, on a copy of
 * the data being sent out. The underlying ForumPost.author field is NEVER
 * altered - staff (moderation access) always sees the real author, per spec
 * ("lo staff vede sempre l'autore reale").
 */

export interface AnonymizablePost {
  isAnonymous?: boolean;
  author: {
    characterId: unknown;
    characterName: string;
  };
}

const ANONYMOUS_AUTHOR = {
  characterId: null,
  characterName: 'Anonimo'
};

/**
 * Returns a shallow copy of `post` with `author` masked if it's an anonymous
 * post and the viewer lacks moderation access. Safe to spread into a response
 * mapping; does not mutate the input.
 */
export function serializePostAuthor<T extends AnonymizablePost>(
  post: T,
  viewerHasModerationAccess: boolean
): T {
  if (post.isAnonymous && !viewerHasModerationAccess) {
    return { ...post, author: ANONYMOUS_AUTHOR };
  }
  return post;
}
