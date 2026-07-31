/**
 * Etichette italiane per SocialClass — mirror di
 * services/unified-backend/src/shared/types/socialClass.ts (SOCIAL_CLASS_LABELS).
 * Solo per display: la classe sociale effettiva è sempre calcolata/validata server-side.
 */

import type { SocialClass } from '@/types/api/CharacterFinances';

export const SOCIAL_CLASS_LABELS: Record<SocialClass, string> = {
  destitute: 'Indigente',
  poor: 'Povero',
  modest: 'Modesto',
  lower_middle: 'Piccola borghesia',
  middle_class: 'Media borghesia',
  wealthy: 'Ricco',
  affluent: 'Facoltoso',
  elite: 'Élite'
};
