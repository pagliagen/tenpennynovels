import { actionTypeRegistry } from './registry';
import { ChatActionType } from './ChatActionType';
import { isApprovedPlayerOrAbove } from './predicates';

/**
 * I 6 actionType strutturalmente fissi (mai una feature, mai un flag,
 * mai disattivabili). Zero import da modules/ o features/: sono policy
 * pura, permesso dallo split fra core/chat/actionTypes (contratto) e
 * modules/game/actions (handler concreti) — vedi core/chat/actionTypes/types.ts.
 *
 * Chiamata esplicita da app.ts accanto a bootstrapFeatures(), non un
 * side-effect di import: stessa disciplina "registrazione a compile-time"
 * già in vigore per le feature.
 */
export function registerCoreActionTypes(): void {
  actionTypeRegistry.register({
    key: ChatActionType.STANDARD,
    canCreate: isApprovedPlayerOrAbove,
    defaultVisibility: 'public',
    includeInEmbeddings: true,
    adminLabel: 'Regular character actions and roleplay'
  });

  actionTypeRegistry.register({
    key: ChatActionType.WHISPER,
    canCreate: isApprovedPlayerOrAbove,
    defaultVisibility: 'whisper',
    adminLabel: 'Private messages between characters'
  });

  actionTypeRegistry.register({
    key: ChatActionType.OOC,
    canCreate: isApprovedPlayerOrAbove,
    defaultVisibility: 'public',
    adminLabel: 'Out of character communication'
  });

  actionTypeRegistry.register({
    key: ChatActionType.DICE_ROLL,
    canCreate: isApprovedPlayerOrAbove,
    defaultVisibility: 'public',
    adminLabel: 'Dice roll actions and results'
  });

  actionTypeRegistry.register({
    key: ChatActionType.MASTER,
    canCreate: (roles) => roles.includes('master'),
    // Inerte: MasterActionHandler sovrascrive sempre actionData.visibility esplicitamente.
    defaultVisibility: 'master_only',
    includeInEmbeddings: true,
    adminLabel: 'Master/Game Master actions and narration'
  });

  actionTypeRegistry.register({
    key: ChatActionType.MODERATION,
    canCreate: (roles) => roles.includes('moderatore'),
    // Inerte: ModerationActionHandler sovrascrive sempre actionData.visibility esplicitamente.
    defaultVisibility: 'master_only',
    includeInEmbeddings: true,
    adminLabel: 'Moderation actions by staff'
  });
}
