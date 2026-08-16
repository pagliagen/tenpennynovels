/**
 * Confrontation Enricher
 *
 * Enriches social_confrontation/combat_action/confrontation_reaction_request
 * actions, mascherando i campi di esito che il viewer non ha diritto a
 * vedere. Logica spostata verbatim da MessageTransformer.maskConfrontationForViewer
 * (era uno special-case inline nell'orchestratore, non passava dalla catena
 * di enricher come gli altri tipi).
 *
 * @module features/confronti/enrichers/ConfrontationEnricher
 */

import type { IMessageEnricher } from '@modules/game/transformers/enrichers/IMessageEnricher';
import type { EnrichedChatMessage, EnrichedConfrontation } from '@modules/game/transformers/types';
import type { MessageContext } from '@modules/game/transformers/MessageContext';

export class ConfrontationEnricher implements IMessageEnricher {
  canEnrich(actionType: string): boolean {
    return actionType === 'social_confrontation' ||
      actionType === 'combat_action' ||
      actionType === 'confrontation_reaction_request';
  }

  async enrich(action: any, context: MessageContext): Promise<Partial<EnrichedChatMessage>> {
    if (!action.confrontation) {
      return {};
    }

    return { confrontation: this.maskConfrontationForViewer(action.confrontation, context) };
  }

  /**
   * Mask confrontation result fields the viewer isn't entitled to see.
   *
   * Raggirare (TiroContrapposto hidden roll) sets `hiddenResultForAttacker: true`:
   * the attacker must never learn the outcome of their own lie — not the rolls,
   * not the success levels, not who won. Everyone else authorized to see the
   * message (defender, master) gets the full object untouched.
   */
  private maskConfrontationForViewer(
    confrontation: EnrichedConfrontation,
    context: MessageContext
  ): EnrichedConfrontation {
    const viewerIsAttacker = context.viewerCharacterId === confrontation.attackerCharacterId;
    const mustMask =
      confrontation.hiddenResultForAttacker &&
      confrontation.phase === 'result' &&
      viewerIsAttacker &&
      !context.isViewerMaster;

    if (!mustMask) {
      return confrontation;
    }

    const {
      attackRoll: _attackRoll,
      defenseRoll: _defenseRoll,
      attackSuccessLevel: _attackSuccessLevel,
      defenseSuccessLevel: _defenseSuccessLevel,
      outcome: _outcome,
      defenseSkill: _defenseSkill,
      messageForDefender: _messageForDefender,
      revealsFullMessage: _revealsFullMessage,
      ...masked
    } = confrontation;

    return masked;
  }
}
