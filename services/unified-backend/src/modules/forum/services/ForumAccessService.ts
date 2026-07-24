import mongoose from 'mongoose';

import { ForumCategory } from '@database/models/ForumCategory';
import type { IForumTopic, TopicAccessRule } from '@database/models/ForumTopic';
import type { IForumDiscussion } from '@database/models/ForumDiscussion';

/**
 * ForumAccessService
 *
 * Centralizes visibility/access-control logic for the forum module, extracted
 * out of ForumController so it can be reused (list queries, mutation guards,
 * search result filtering) without duplicating the rules in each call site.
 *
 * Two access layers, always combined with AND (never wider than the bacheca):
 * 1. Topic ("bacheca") access — canAccessTopic, via accessRules (own or
 *    inherited from the parent ForumCategory).
 * 2. Discussion ("thread") visibility — matchesDiscussionVisibility, an
 *    optional, more restrictive rule on top, plus an always-on exclusion list.
 *
 * Gestore always bypasses both layers. Master/Moderatore are subject to the
 * same rules as any other character (no automatic bypass).
 */

export interface ForumCharacterContext {
  characterId: string;
  gameplayRoles?: string[];
  isGestore?: boolean;
}

function isStaffContext(character?: ForumCharacterContext): boolean {
  return !!character && (character.gameplayRoles?.includes('master') || character.gameplayRoles?.includes('moderatore') || false);
}

/**
 * Resolve the access rules that actually govern a topic: its own accessRules
 * if it has no category or explicitly overrides (accessRulesOverride: true),
 * otherwise the parent ForumCategory's defaultAccessRules (inherited).
 */
export async function getEffectiveAccessRules(topic: IForumTopic): Promise<TopicAccessRule[]> {
  if (topic.accessRulesOverride || !topic.categoryId) {
    return topic.accessRules;
  }

  const category = await ForumCategory.findById(topic.categoryId).select('defaultAccessRules').lean();
  return category?.defaultAccessRules ?? topic.accessRules;
}

/**
 * Check if a character can access a topic (bacheca) based on its effective
 * accessRules (OR logic between rules). Gestore always passes.
 */
export async function canAccessTopic(
  topic: IForumTopic,
  character?: ForumCharacterContext
): Promise<boolean> {
  if (character?.isGestore) return true;

  const accessRules = await getEffectiveAccessRules(topic);
  if (!accessRules || accessRules.length === 0) return true;

  for (const rule of accessRules) {
    switch (rule.type) {
      case 'public':
        return true;
      case 'authenticated':
        if (character) return true;
        break;
      case 'gameplayRole':
        if (character && rule.gameplayRole && character.gameplayRoles?.includes(rule.gameplayRole)) {
          return true;
        }
        break;
      case 'corporation':
        if (character && rule.corporationId) {
          const Corporation = mongoose.model('Corporation');
          const isMember = await Corporation.exists({
            _id: rule.corporationId,
            'members.characterId': new mongoose.Types.ObjectId(character.characterId)
          });
          if (isMember) return true;
        }
        break;
    }
  }
  return false;
}

/**
 * Check if a character satisfies a discussion's own visibility rule and is not
 * on its exclusion list. Does NOT check topic-level access — combine with
 * canAccessTopic (see evaluateDiscussionVisibility) when there isn't already a
 * separate topic-level gate upstream. Gestore always passes.
 */
export async function matchesDiscussionVisibility(
  discussion: Pick<IForumDiscussion, 'visibility' | 'excludedCharacterIds' | 'createdBy'>,
  character?: ForumCharacterContext
): Promise<boolean> {
  if (character?.isGestore) return true;

  if (character && discussion.excludedCharacterIds?.some((id) => id.toString() === character.characterId)) {
    return false;
  }

  const visibility = discussion.visibility;
  if (!visibility) return true; // inherits fully from the topic

  const isStaff = isStaffContext(character);

  switch (visibility.type) {
    case 'public':
      return true;
    case 'staff':
      return isStaff;
    case 'corporation': {
      if (!character || !visibility.corporationId) return false;
      const Corporation = mongoose.model('Corporation');
      const isMember = await Corporation.exists({
        _id: visibility.corporationId,
        'members.characterId': new mongoose.Types.ObjectId(character.characterId)
      });
      return !!isMember;
    }
    case 'characterList':
      return !!character && !!visibility.characterIds?.some((id) => id.toString() === character.characterId);
    case 'private':
      return !!character && (discussion.createdBy.characterId.toString() === character.characterId || isStaff);
    default:
      return false;
  }
}

/**
 * Full visibility check for a single discussion: topic-level gate AND the
 * discussion's own visibility rule AND absence from its exclusion list.
 */
export async function evaluateDiscussionVisibility(
  discussion: Pick<IForumDiscussion, 'visibility' | 'excludedCharacterIds' | 'createdBy'>,
  topic: IForumTopic,
  character?: ForumCharacterContext
): Promise<boolean> {
  if (character?.isGestore) return true;
  if (!(await canAccessTopic(topic, character))) return false;
  return matchesDiscussionVisibility(discussion, character);
}

/**
 * Mongo filter equivalent of matchesDiscussionVisibility, for list endpoints
 * (getDiscussions, getRecentDiscussions, getPopularDiscussions) where
 * per-document application-level filtering after skip/limit would break
 * pagination. Must be combined with a topic-level accessible-slugs filter
 * upstream (this only covers the discussion-specific layer).
 *
 * Returns {} when no extra filtering is needed (no character restrictions
 * apply, or the character is Gestore).
 */
export async function buildDiscussionVisibilityFilter(
  character?: ForumCharacterContext
): Promise<Record<string, unknown>> {
  if (character?.isGestore) return {};

  const charObjectId = character ? new mongoose.Types.ObjectId(character.characterId) : null;
  const isStaff = isStaffContext(character);

  let corporationIds: mongoose.Types.ObjectId[] = [];
  if (charObjectId) {
    const Corporation = mongoose.model('Corporation');
    corporationIds = await Corporation.find({ 'members.characterId': charObjectId }).distinct('_id');
  }

  const visibilityOr: Record<string, unknown>[] = [
    { visibility: { $exists: false } },
    { 'visibility.type': 'public' },
  ];
  if (isStaff) {
    visibilityOr.push({ 'visibility.type': 'staff' });
    visibilityOr.push({ 'visibility.type': 'private' });
  }
  if (corporationIds.length > 0) {
    visibilityOr.push({ 'visibility.type': 'corporation', 'visibility.corporationId': { $in: corporationIds } });
  }
  if (charObjectId) {
    visibilityOr.push({ 'visibility.type': 'characterList', 'visibility.characterIds': charObjectId });
    visibilityOr.push({ 'visibility.type': 'private', 'createdBy.characterId': charObjectId });
  }

  const exclusionFilter = charObjectId
    ? { excludedCharacterIds: { $nin: [charObjectId] } }
    : {};

  return { $and: [{ $or: visibilityOr }, exclusionFilter] };
}
