import type { FeatureManifest } from '@core/features/types';
import { ChatActionType } from '@core/chat/actionTypes/ChatActionType';
import { isApprovedPlayerOrAbove } from '@core/chat/actionTypes/predicates';
import type { ChatActionLike } from '@core/chat/actionTypes/types';

export const statCheck: FeatureManifest = {
  key: 'statCheck',
  title: 'Tiro Caratteristica',
  description: 'Tiro contro un valore di caratteristica (stat check) nella chat di location',
  flag: { configKey: 'stat_check_enabled', section: 'system', default: true, label: 'Tiro Caratteristica' },
  chatActionTypes: [
    {
      key: ChatActionType.STAT_CHECK,
      canCreate: isApprovedPlayerOrAbove,
      defaultVisibility: 'public',
      // Spostato verbatim da ChatMessageService.canSeeAction: solo mittente e master vedono il tiro.
      canSeeMessage: (action: ChatActionLike, viewerCharacterId, isViewerMaster) =>
        isViewerMaster || action.characterId === viewerCharacterId,
      includeInEmbeddings: false,
      adminLabel: 'Attribute check attempts and results',
    },
  ],
};
