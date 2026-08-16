/**
 * Chat Action Type Config
 *
 * Punto unico per label/disponibilità dei 12 actionType della chat di
 * location — consolida `ACTION_DISPLAY_NAMES` (ex ActionTypeSelector.tsx) e
 * `getActionDisplayName` (ex MessageInput.tsx, mappa quasi duplicata) più i
 * gate di disponibilità che erano inline in `getAvailableActions`
 * (MessageInput.tsx). Tutti e 12 i tipi nella stessa mappa, non 6 core
 * hardcoded + 6 da config: lo stesso motivo per cui il backend registra
 * anche i 6 tipi fissi nello stesso registry (core/chat/actionTypes/) —
 * un solo sistema, non due paralleli.
 *
 * I 3 modali fissi (dado/skill-stat/confronti) restano hardcoded in
 * MessageInput.tsx: non sono "un bottone per actionType", sono superfici
 * composite che scelgono internamente fra più tipi.
 *
 * @module config/chatActionTypes
 */

import type { ActionType } from '@/types/chat';

export interface ChatActionAvailabilityContext {
  hasWhisperTargets: boolean;
  hasEquippedItems: boolean;
  gamePermissions: string[];
}

export interface ChatActionTypeConfig {
  /** Etichetta nel dropdown di selezione (ActionTypeSelector). */
  dropdownLabel: string;
  /** Etichetta usata nel placeholder della textarea. */
  placeholderLabel: string;
  /** false = mai una voce del dropdown: composto via modale dedicato, toggle, o generato dal server. */
  isDropdownEntry: boolean;
  /** Solo per isDropdownEntry:true. Assente = sempre disponibile. */
  isAvailable?(ctx: ChatActionAvailabilityContext): boolean;
}

function hasGamePermission(gamePermissions: string[], permission: string): boolean {
  return gamePermissions.includes('game:*') || gamePermissions.includes(permission);
}

export const CHAT_ACTION_TYPES: Record<ActionType, ChatActionTypeConfig> = {
  // Ordine di inserimento = ordine nel dropdown (Object.entries lo preserva):
  // standard, ooc, whisper, item_use, moderation — stesso ordine di push
  // dell'originale getAvailableActions.
  standard: {
    dropdownLabel: 'Messaggio Standard',
    placeholderLabel: 'messaggio',
    isDropdownEntry: true,
  },
  ooc: {
    dropdownLabel: 'Fuori dal Gioco (OOC)',
    placeholderLabel: 'messaggio fuori dal gioco',
    isDropdownEntry: true,
  },
  whisper: {
    dropdownLabel: 'Sussurro',
    placeholderLabel: 'sussurro',
    isDropdownEntry: true,
    isAvailable: (ctx) => ctx.hasWhisperTargets,
  },
  item_use: {
    dropdownLabel: 'Usa Oggetto',
    placeholderLabel: 'uso oggetto',
    isDropdownEntry: true,
    isAvailable: (ctx) => ctx.hasEquippedItems,
  },
  moderation: {
    dropdownLabel: 'Moderazione',
    placeholderLabel: 'azione di moderazione',
    isDropdownEntry: true,
    isAvailable: (ctx) => hasGamePermission(ctx.gamePermissions, 'game:chat:moderation-action'),
  },
  // Non voci del dropdown: composti via modale dedicato (dado/skill-stat/confronti),
  // toggle (master), o generati dal server (confrontation_reaction_request).
  dice_roll: {
    dropdownLabel: 'Tiro Dado',
    placeholderLabel: 'tiro dado',
    isDropdownEntry: false,
  },
  skill_check: {
    dropdownLabel: 'Tiro Abilità',
    placeholderLabel: 'tiro abilità',
    isDropdownEntry: false,
  },
  stat_check: {
    dropdownLabel: 'Tiro Caratteristica',
    placeholderLabel: 'tiro caratteristica',
    isDropdownEntry: false,
  },
  master: {
    dropdownLabel: 'Annuncio Master',
    placeholderLabel: 'annuncio master',
    isDropdownEntry: false,
  },
  social_confrontation: {
    dropdownLabel: '[Sistema] Conflitto Sociale',
    placeholderLabel: 'conflitto sociale',
    isDropdownEntry: false,
  },
  combat_action: {
    dropdownLabel: '[Sistema] Azione di Combattimento',
    placeholderLabel: 'azione di combattimento',
    isDropdownEntry: false,
  },
  confrontation_reaction_request: {
    dropdownLabel: '[Sistema] Richiesta Reazione',
    placeholderLabel: 'richiesta reazione',
    isDropdownEntry: false,
  },
};

/** Tipi selezionabili dal dropdown, filtrati per disponibilità nel contesto corrente. */
export function getAvailableDropdownActions(ctx: ChatActionAvailabilityContext): ActionType[] {
  return (Object.entries(CHAT_ACTION_TYPES) as Array<[ActionType, ChatActionTypeConfig]>)
    .filter(([, config]) => config.isDropdownEntry && (config.isAvailable?.(ctx) ?? true))
    .map(([action]) => action);
}
