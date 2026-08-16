import type { FeatureKey } from '../../features/types';
import type { ChatActionType } from './ChatActionType';

/**
 * Forma minima di un'azione chat persistita, sufficiente per le regole di
 * visibilità lato viewer. Deliberatamente non IChat: questo modulo (core)
 * non deve dipendere da tipi di modules/features, solo dai campi che una
 * regola di visibilità può davvero aver bisogno di leggere.
 */
export interface ChatActionLike {
  actionType: string;
  characterId: string;
  visibility: 'public' | 'whisper' | 'master_only';
  targetCharacters?: string[];
  isHidden?: boolean;
}

/**
 * Policy cross-cutting per un actionType: chi può crearlo, la visibilità di
 * default, chi può vederlo una volta creato, se alimenta gli embedding,
 * l'etichetta per il pannello admin. Non contiene alcun riferimento a
 * IActionHandler/IMessageEnricher (quelli restano wiring di modules/game/,
 * mai importati qui — vedi core/chat/actionTypes/registry.ts).
 */
export interface ActionTypeModule {
  key: ChatActionType;
  /** Stampato da bootstrapFeatures()/registerCoreActionTypes() alla registrazione — mai valorizzato dalla feature stessa. undefined = uno dei 6 tipi core, mai gated da flag. */
  featureKey?: FeatureKey;
  canCreate(gameplayRoles: string[], isGestore: boolean): boolean;
  defaultVisibility: 'public' | 'whisper' | 'master_only';
  /** Omesso = nessuna regola di visibilità aggiuntiva oltre a quella generica (whisper/master_only/public) già applicata dal chiamante. */
  canSeeMessage?(action: ChatActionLike, viewerCharacterId: string, isViewerMaster: boolean): boolean;
  /** Default false se omesso. */
  includeInEmbeddings?: boolean;
  adminLabel: string;
}
