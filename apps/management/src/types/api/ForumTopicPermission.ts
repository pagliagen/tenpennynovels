export type ForumPermissionDecision = 'allow' | 'deny';

export interface ForumTopicPermissionOverrideValues {
  view?: ForumPermissionDecision;
  openThread?: ForumPermissionDecision;
  reply?: ForumPermissionDecision;
  attachImages?: ForumPermissionDecision;
}

export interface ForumTopicPermissionOverride {
  _id: string;
  characterId: string;
  characterName?: string;
  overrides: ForumTopicPermissionOverrideValues;
  grantedBy: string;
  grantedByCharacterName: string;
  grantedAt: string;
  reason?: string;
}

export const FORUM_PERMISSION_KEYS: { key: keyof ForumTopicPermissionOverrideValues; label: string }[] = [
  { key: 'view', label: 'Vedere' },
  { key: 'openThread', label: 'Aprire thread' },
  { key: 'reply', label: 'Rispondere' },
  { key: 'attachImages', label: 'Allegare immagini' },
];
