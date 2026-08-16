import type { FeatureManifest } from '@core/features/types';
import { ChatActionType } from '@core/chat/actionTypes/ChatActionType';
import { isApprovedPlayerOrAbove } from '@core/chat/actionTypes/predicates';
import type { ChatActionLike } from '@core/chat/actionTypes/types';

export const skillCheck: FeatureManifest = {
  key: 'skillCheck',
  title: 'Tiro Abilità',
  description: 'Tiro contro un valore di abilità (skill check) nella chat di location',
  flag: { configKey: 'skill_check_enabled', section: 'system', default: true, label: 'Tiro Abilità' },
  chatActionTypes: [
    {
      key: ChatActionType.SKILL_CHECK,
      canCreate: isApprovedPlayerOrAbove,
      defaultVisibility: 'public',
      // Spostato verbatim da ChatMessageService.canSeeAction: solo mittente e master vedono il tiro.
      canSeeMessage: (action: ChatActionLike, viewerCharacterId, isViewerMaster) =>
        isViewerMaster || action.characterId === viewerCharacterId,
      includeInEmbeddings: false,
      adminLabel: 'Skill check attempts and results',
    },
  ],
};
