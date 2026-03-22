import type { Types } from 'mongoose';

/** Ban applicato al singolo personaggio (non all'account intero). */
export type CharacterBanScope = 'full' | 'chat_only' | 'forum_only';

export interface CharacterBanFields {
  isBanned?: boolean;
  banScope?: CharacterBanScope;
  banReason?: string;
  bannedAt?: Date;
  bannedUntil?: Date | null;
  bannedBy?: Types.ObjectId;
  bannedByName?: string;
}

/** In sessione può comparire `game_only` solo per ban legacy ancora sullo User. */
export type SessionBanScope = CharacterBanScope | 'game_only';

export interface CharacterBanPublicPayload {
  active: boolean;
  scope: SessionBanScope | null;
  reason: string | null;
  bannedUntil: string | null;
  bannedAt: string | null;
  blocksLandAccess: boolean;
  blocksChatWrite: boolean;
  blocksForumWrite: boolean;
}

export function isCharacterBanExpired(bannedUntil: Date | null | undefined): boolean {
  if (bannedUntil == null) return false;
  return new Date(bannedUntil).getTime() <= Date.now();
}

/** True se il ban sul personaggio è attivo (flag + non scaduto). */
export function isCharacterBanActive(char: CharacterBanFields | null | undefined): boolean {
  if (!char?.isBanned) return false;
  if (isCharacterBanExpired(char.bannedUntil ?? undefined)) return false;
  return true;
}

export function effectiveBanScope(char: CharacterBanFields | null | undefined): CharacterBanScope | null {
  if (!isCharacterBanActive(char)) return null;
  return char?.banScope ?? 'full';
}

export function blocksLandAccess(char: CharacterBanFields | null | undefined): boolean {
  const s = effectiveBanScope(char);
  return s === 'full';
}

export function blocksChatWrite(char: CharacterBanFields | null | undefined): boolean {
  const s = effectiveBanScope(char);
  return s === 'full' || s === 'chat_only';
}

export function blocksForumWrite(char: CharacterBanFields | null | undefined): boolean {
  const s = effectiveBanScope(char);
  return s === 'full' || s === 'forum_only';
}

export function toCharacterBanPayload(char: CharacterBanFields | null | undefined): CharacterBanPublicPayload {
  const active = isCharacterBanActive(char);
  const scope = effectiveBanScope(char) as SessionBanScope | null;
  return {
    active,
    scope,
    reason: active && char?.banReason ? char.banReason : null,
    bannedUntil:
      active && char?.bannedUntil
        ? new Date(char.bannedUntil).toISOString()
        : null,
    bannedAt:
      active && char?.bannedAt ? new Date(char.bannedAt).toISOString() : null,
    blocksLandAccess: active && blocksLandAccess(char),
    blocksChatWrite: active && blocksChatWrite(char),
    blocksForumWrite: active && blocksForumWrite(char),
  };
}

/** Legacy: ban ancora sul documento User (fino a migrazione). */
export interface LegacyUserBanFields {
  isBanned?: boolean;
  banScope?: 'full' | 'chat_only' | 'game_only';
  banReason?: string;
  bannedAt?: Date;
  bannedUntil?: Date | null;
}

function legacyUserActive(user: LegacyUserBanFields | null | undefined): boolean {
  if (!user?.isBanned) return false;
  if (isCharacterBanExpired(user.bannedUntil ?? undefined)) return false;
  return true;
}

/**
 * Ban ancora sullo User: stesso effetto su tutti i personaggi dell'account.
 * `game_only` = solo land/gameplay (come da enum storico), non chat/forum.
 */
export function legacyUserBlocksGame(user: LegacyUserBanFields | null | undefined): boolean {
  if (!legacyUserActive(user)) return false;
  const s = user!.banScope ?? 'full';
  return s === 'full' || s === 'game_only';
}

export function legacyUserBlocksChat(user: LegacyUserBanFields | null | undefined): boolean {
  if (!legacyUserActive(user)) return false;
  const s = user!.banScope ?? 'full';
  return s === 'full' || s === 'chat_only';
}

export function legacyUserBlocksForum(user: LegacyUserBanFields | null | undefined): boolean {
  if (!legacyUserActive(user)) return false;
  const s = user!.banScope ?? 'full';
  return s === 'full';
}

/**
 * Payload sessione/API: merge character ban + legacy user (character ha priorità).
 */
export function resolveEffectiveBan(
  character: CharacterBanFields | null | undefined,
  legacyUser: LegacyUserBanFields | null | undefined
): CharacterBanPublicPayload {
  if (isCharacterBanActive(character)) {
    return toCharacterBanPayload(character);
  }
  if (!legacyUserActive(legacyUser) || !legacyUser) {
    return toCharacterBanPayload(null);
  }
  const raw = legacyUser.banScope ?? 'full';
  const scope: SessionBanScope | null =
    raw === 'chat_only' ? 'chat_only' : raw === 'game_only' ? 'game_only' : 'full';
  return {
    active: true,
    scope,
    reason: legacyUser.banReason ?? null,
    bannedUntil: legacyUser.bannedUntil
      ? new Date(legacyUser.bannedUntil).toISOString()
      : null,
    bannedAt: legacyUser.bannedAt ? new Date(legacyUser.bannedAt).toISOString() : null,
    blocksLandAccess: legacyUserBlocksGame(legacyUser),
    blocksChatWrite: legacyUserBlocksChat(legacyUser),
    blocksForumWrite: legacyUserBlocksForum(legacyUser),
  };
}
