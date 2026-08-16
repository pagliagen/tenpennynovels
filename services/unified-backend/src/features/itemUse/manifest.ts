import type { FeatureManifest } from '@core/features/types';
import { ChatActionType } from '@core/chat/actionTypes/ChatActionType';
import { isApprovedPlayerOrAbove } from '@core/chat/actionTypes/predicates';

export const itemUse: FeatureManifest = {
  key: 'itemUse',
  title: 'Uso Oggetto',
  description: 'Messaggio di utilizzo di un oggetto nella chat di location',
  flag: { configKey: 'item_use_enabled', section: 'system', default: true, label: 'Uso Oggetto' },
  dependsOn: ['oggetti'],
  chatActionTypes: [
    {
      key: ChatActionType.ITEM_USE,
      canCreate: isApprovedPlayerOrAbove,
      defaultVisibility: 'public',
      // Nessuna regola di visibilità aggiuntiva: pubblico come standard, invariato.
      includeInEmbeddings: false,
      adminLabel: 'Item usage and effects',
    },
  ],
};
