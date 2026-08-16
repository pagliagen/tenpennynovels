import { FeatureFlagService } from '../../features/flags';
import type { ChatActionType } from './ChatActionType';
import type { ActionTypeModule, ChatActionLike } from './types';

/**
 * Registro di policy per i 12 actionType della chat — sostituisce gli switch
 * paralleli sparsi in ChatController/ChatMessageService/BaseActionHandler/
 * ChatManagementController/Chat.ts. Popolato da registerCoreActionTypes()
 * (i 6 fissi) e da bootstrapFeatures() (i tipi posseduti da una feature),
 * mai da un side-effect di import.
 */
export class ActionTypeRegistry {
  private readonly byKey = new Map<ChatActionType, ActionTypeModule>();

  register(module: ActionTypeModule): void {
    if (this.byKey.has(module.key)) {
      throw new Error(`ActionType duplicato: "${module.key}" è già registrato`);
    }
    this.byKey.set(module.key, module);
  }

  getByKey(key: ChatActionType | string): ActionTypeModule | undefined {
    return this.byKey.get(key as ChatActionType);
  }

  getAll(): readonly ActionTypeModule[] {
    return [...this.byKey.values()];
  }

  /** Fail-closed: chiave sconosciuta o feature disattivata → false, mai un throw. */
  async canCreate(actionType: string, gameplayRoles: string[], isGestore: boolean): Promise<boolean> {
    const module = this.getByKey(actionType);
    if (!module) return false;
    if (module.featureKey && !(await FeatureFlagService.isEnabled(module.featureKey))) return false;
    return module.canCreate(gameplayRoles, isGestore);
  }

  /** Consultata solo dopo che canCreate ha già filtrato: nessun controllo flag qui. */
  getDefaultVisibility(actionType: string): 'public' | 'whisper' | 'master_only' {
    return this.getByKey(actionType)?.defaultVisibility ?? 'public';
  }

  /**
   * Mai gated dal flag: disattivare una feature blocca solo la creazione di
   * nuovi messaggi, non nasconde retroattivamente lo storico già visibile.
   */
  async canSeeMessage(action: ChatActionLike, viewerCharacterId: string, isViewerMaster: boolean): Promise<boolean> {
    const module = this.getByKey(action.actionType);
    if (!module?.canSeeMessage) return true;
    return module.canSeeMessage(action, viewerCharacterId, isViewerMaster);
  }

  /**
   * Sync, nessun controllo flag: l'hook post-save di Chat.ts gira su ogni
   * singolo messaggio salvato in tutta l'app — un round-trip Redis lì
   * aggiungerebbe latenza ad ogni scrittura chat, non solo alle feature
   * nuove. Un tipo disabilitato con includeInEmbeddings:true continuerebbe
   * a generare embedding: accettabile, nessuno dei tipi feature lo è oggi.
   */
  getEmbeddingActionTypes(): ChatActionType[] {
    return this.getAll().filter((m) => m.includeInEmbeddings).map((m) => m.key);
  }

  getAdminLabel(actionType: string): string {
    return this.getByKey(actionType)?.adminLabel ?? 'Sconosciuto';
  }
}

export const actionTypeRegistry = new ActionTypeRegistry();
