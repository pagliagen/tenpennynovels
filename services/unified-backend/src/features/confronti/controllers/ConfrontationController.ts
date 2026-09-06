/**
 * Confrontation Controller
 *
 * Sottosistema TiroContrapposto (opposed rolls): attacco, richiesta di
 * reazione, risoluzione, esito forzato dal master. Spostato verbatim da
 * ChatController.ts (~1100 righe, righe originali 78-2532 prima dello
 * spostamento) — stessa logica di dado/danno/gradi di successo, invariata,
 * solo path di import aggiornati e i riferimenti incrociati
 * ChatController.X rinominati in ConfrontationController.X.
 *
 * @module features/confronti/controllers/ConfrontationController
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Character } from '@core/character/models/Character';
import { Chat } from '@core/chat/models/Chat';
import { Skill } from '@database/models';
import { SkillConfrontation } from '../models/SkillConfrontation';
import { CombatEncounter } from '../models/CombatEncounter';
import { logger } from '@modules/game/logger';
import { errorResponse, createResponse, getRequestId } from '@shared/utils/apiResponse';
import { ConfigurationService } from '@shared/services/ConfigurationService';
import { redis } from '@config/runtime/redis';
import { calculateSuccessDegree, compareSuccessDegrees } from '@modules/game/utils/successDegrees';
import { getSocketIO } from '@modules/game/websocket/socketInstance';
import { WeaponService } from '@modules/game/services/WeaponService';

export class ConfrontationController {
  /**
   * Resolve a character's skill value by skill name.
   *
   * character.skills is keyed by Skill ObjectId, but the confrontation system
   * (social conflicts, TiroContrapposto) identifies skills by name (attackSkill,
   * SkillConfrontation.skillName, counterSkills[].skillName). This bridges the two.
   *
   * character.skills is a Mongoose Map on non-.lean() documents (Character.ts
   * schema: `type: Map`) but a plain object once .lean()'d - callers here mix
   * both, so read via .get() when it's a real Map instead of bracket notation
   * (which silently returns undefined on a Map, since entries aren't own props).
   */
  /**
   * Emit a full 'location_message_notification' for a saved Chat document.
   *
   * The confrontation flow (createConfrontationAttack, handleConfrontationReaction,
   * handlePendingReactionAbort, forceConfrontationOutcome) historically emitted only
   * { actionId, characterName, actionType, timestamp } - metadata, no `message` field.
   * The frontend (useLocationChat.ts) always reads `payload.message._id`, so those
   * partial payloads threw client-side and the message never reached the store -
   * this is why a defender never saw the reaction request at all. This mirrors the
   * correct payload shape createMessage() already uses, including whisper-only
   * routing so reaction requests (visibility: 'whisper') don't leak to the whole room.
   */
  /**
   * Strip the confrontation result fields the attacker isn't entitled to see
   * live, for Raggirare (hiddenResultForAttacker). Mirrors
   * ConfrontationEnricher.maskConfrontationForViewer (the GET-path masking)
   * verbatim in which fields it strips — this is the same rule, just applied
   * to the WebSocket push instead of the read path.
   */
  private static maskConfrontationForAttacker(confrontation: any): any {
    if (!confrontation) return confrontation;
    const mustMask = confrontation.hiddenResultForAttacker && confrontation.phase === 'result';
    if (!mustMask) return confrontation;

    const {
      attackRoll: _attackRoll,
      defenseRoll: _defenseRoll,
      attackSuccessLevel: _attackSuccessLevel,
      defenseSuccessLevel: _defenseSuccessLevel,
      outcome: _outcome,
      defenseSkill: _defenseSkill,
      messageForDefender: _messageForDefender,
      ...masked
    } = confrontation;
    return masked;
  }

  private static async emitConfrontationMessage(_req: Request, savedMessage: any): Promise<void> {
    // req.app.get('io') is never populated in this app (no app.set('io', ...)
    // anywhere) - the real instance lives in the getSocketIO() singleton, see
    // socketInstance.ts. Every confrontation emit that used req.app.get('io')
    // silently no-op'd: no error, just nothing delivered live.
    const io = getSocketIO();
    if (!io) return;

    const locationId = savedMessage.locationId.toString();
    const roomName = `location_${locationId}`;

    let whisperEnrichment: { targetCharacterIds: string[]; targetCharacterNames: string[] } | undefined;
    if (savedMessage.visibility === 'whisper' && savedMessage.targetCharacters?.length) {
      const targetChars = await Character.find({ _id: { $in: savedMessage.targetCharacters } })
        .select('_id name')
        .lean();
      const nameById = new Map(targetChars.map((c: any) => [c._id.toString(), c.name]));
      whisperEnrichment = {
        targetCharacterIds: savedMessage.targetCharacters,
        targetCharacterNames: savedMessage.targetCharacters.map((id: string) => nameById.get(id) || 'Unknown')
      };
    }

    const baseChatMessage = {
      _id: savedMessage._id.toString(),
      actionType: savedMessage.actionType,
      characterId: savedMessage.characterId,
      characterName: savedMessage.characterName,
      characterAvatar: savedMessage.characterAvatar || undefined,
      position: savedMessage.position || undefined,
      locationId,
      content: savedMessage.content,
      visibility: savedMessage.visibility,
      diceResult: savedMessage.diceResult || undefined,
      targetCharacters: savedMessage.targetCharacters || undefined,
      whisper: whisperEnrichment,
      editHistory: savedMessage.editHistory || [],
      timestamp: savedMessage.timestamp.toISOString()
    };

    if (savedMessage.visibility === 'whisper' || savedMessage.visibility === 'master_only') {
      // Three payload variants — the GET path (MessageTransformer/ConfrontationEnricher)
      // already masks per-viewer; the live WebSocket push must do the same instead of
      // sending the raw saved document to every recipient room:
      // - attacker: confrontation masked (Raggirare hides the outcome from its own
      //   author), hiddenContent included (their own lie's true-feelings annotation —
      //   a UI reminder, not new information to them)
      // - defender/other targets: confrontation in full (they're allowed to see the
      //   true outcome), hiddenContent never included (would spoil the hidden roll)
      // - staff (master): confrontation in full + hiddenContent
      const attackerId = savedMessage.confrontation?.attackerCharacterId;
      const playerConfrontation = ConfrontationController.maskConfrontationForAttacker(savedMessage.confrontation);

      const attackerMessage = { ...baseChatMessage, confrontation: playerConfrontation, hiddenContent: savedMessage.hiddenContent || undefined };
      const otherTargetsMessage = { ...baseChatMessage, confrontation: savedMessage.confrontation || undefined };
      const staffMessage = { ...baseChatMessage, confrontation: savedMessage.confrontation || undefined, hiddenContent: savedMessage.hiddenContent || undefined };

      const otherTargetRooms = [
        savedMessage.characterId,
        ...(savedMessage.targetCharacters || []),
      ]
        .filter((id: string) => id !== attackerId)
        .map((id: string) => `character_${id}`);

      if (attackerId) {
        io.to(`character_${attackerId}`).emit('location_message_notification', { message: attackerMessage, locationId });
      }
      if (otherTargetRooms.length > 0) {
        io.to(otherTargetRooms).emit('location_message_notification', { message: otherTargetsMessage, locationId });
      }
      io.to('staff').emit('location_message_notification', { message: staffMessage, locationId });
    } else {
      // Public: rollType 'open' confrontations only (Raggirare is always 'whisper'),
      // visible to everyone in the room including bystanders by design — no masking.
      io.to(roomName).emit('location_message_notification', { message: { ...baseChatMessage, confrontation: savedMessage.confrontation || undefined }, locationId });
    }
  }

  private static async getSkillValueByName(character: any, skillName: string): Promise<number> {
    // NoSQL injection guard: skillName must be a plain string, never a query
    // object (e.g. { $ne: null }), before it's used as a filter value below.
    if (typeof skillName !== 'string') return 0;

    const skill = await Skill.findOne({ name: skillName }).select('_id').lean();
    if (!skill) return 0;

    const skillId = skill._id.toString();
    const skillData = character.skills instanceof Map
      ? character.skills.get(skillId)
      : character.skills?.[skillId];
    if (typeof skillData === 'number') return skillData;
    if (skillData && typeof skillData === 'object' && 'total' in skillData) {
      return (skillData as { total: number }).total;
    }
    return 0;
  }

  /**
   * Parse dice specification string
   * Format: {count}d{type}[+/-modifier]
   * Examples: "2d6+3", "1d20", "3d8-2", "1d100"
   */
  private static parseDiceSpec(diceSpec: string): {
    count: number;
    type: number;
    modifier: number;
    isValid: boolean;
  } {
    const regex = /^(\d+)d(\d+)([+-]\d+)?$/i;
    const match = diceSpec.match(regex);

    if (!match) {
      return { count: 1, type: 100, modifier: 0, isValid: false };
    }

    const count = Number.parseInt(match[1], 10);
    const type = Number.parseInt(match[2], 10);
    const modifier = match[3] ? Number.parseInt(match[3], 10) : 0;

    const validTypes = [4, 6, 8, 10, 12, 20, 100];
    const isValid =
      count >= 1 && count <= 20 &&
      validTypes.includes(type) &&
      modifier >= -99 && modifier <= 99;

    return { count, type, modifier, isValid };
  }

  /**
   * Dice rolling function with multi-dice support
   * Parses diceSpec and rolls accordingly
   * Format: {count}d{type}[+/-modifier]
   * Examples: "2d6+3", "1d20", "3d8-2", "1d100"
   */
  private static rollDice(diceSpec?: string): {
    dice: string;
    result: number;
    rolls?: number[];
    modifier?: number;
    total: number;
  } {
    const spec = diceSpec || '1d100';
    const parsed = ConfrontationController.parseDiceSpec(spec);

    if (!parsed.isValid) {
      logger.warn(`Invalid dice spec: ${spec}, falling back to 1d100`);
      const result = Math.floor(Math.random() * 100) + 1;
      return { dice: '1d100', result, total: result };
    }

    const rolls: number[] = [];
    for (let i = 0; i < parsed.count; i++) {
      const roll = Math.floor(Math.random() * parsed.type) + 1;
      rolls.push(roll);
    }

    const rollSum = rolls.reduce((sum, r) => sum + r, 0);
    const total = rollSum + parsed.modifier;

    return {
      dice: spec,
      result: rollSum,
      rolls: parsed.count > 1 ? rolls : undefined,
      modifier: parsed.modifier !== 0 ? parsed.modifier : undefined,
      total: total,
    };
  }

  /**
   * Create Confrontation Attack (TiroContrapposto Phase 1)
   * POST /game/chats/confrontation-attack
   *
   * Initiates an opposed roll (combat or social conflict).
   * If the skill has multiple defense options, creates a reaction request message.
   * Otherwise, resolves immediately with single defense skill.
   */
  static async createConfrontationAttack(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Contesto personaggio richiesto',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const {
        locationId,
        attackSkill,
        defenderId,
        content,
        additionalMessage, // For Raggirare lie text
        forceAbortPendingReaction, // User confirmed abort of pending reaction
        position // Attacker's position tag - without it the message renders dimmed (see MessageList.shouldDimMessage)
      } = req.body;

      // Validate required fields
      if (!locationId || !attackSkill || !defenderId || !content) {
        res.status(400).json(errorResponse(
          'locationId, attackSkill, defenderId, and content are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // locationId must be a plain ObjectId string — reject query objects (e.g. { $ne: null })
      // before it's used as a filter value below (NoSQL injection guard, stesso pattern di
      // messageId/attackSkill in questo stesso file)
      if (typeof locationId !== 'string' || !Types.ObjectId.isValid(locationId)) {
        res.status(400).json(errorResponse(
          'locationId non valido',
          'INVALID_LOCATION_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // attackSkill must be a plain string — reject query objects (e.g. { $ne: null })
      // before it's used as a filter value anywhere below (NoSQL injection guard)
      if (typeof attackSkill !== 'string') {
        res.status(400).json(errorResponse(
          'attackSkill non valido',
          'INVALID_ATTACK_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // defenderId must be a plain ObjectId string — reject query objects (e.g. { $ne: null })
      // before it's used as a filter value below (NoSQL injection guard)
      if (typeof defenderId !== 'string' || !Types.ObjectId.isValid(defenderId)) {
        res.status(400).json(errorResponse(
          'defenderId non valido',
          'INVALID_DEFENDER_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // CHECK: Attacker has pending reaction to resolve?
      const pendingReaction = await Chat.findOne({
        locationId,
        'confrontation.defenderCharacterId': character.characterId,
        'confrontation.phase': 'waiting_reaction',
      });

      if (pendingReaction) {
        if (!forceAbortPendingReaction) {
          // User has not confirmed abort → block
          res.status(400).json(errorResponse(
            'Devi rispondere alla reazione pendente prima di fare altre azioni',
            'PENDING_REACTION_EXISTS',
            { pendingMessageId: pendingReaction._id },
            400,
            getRequestId(req)
          ));
          return;
        }

        // User confirmed abort → auto-resolve with defender fail
        await ConfrontationController.handlePendingReactionAbort(pendingReaction._id.toString(), character.characterId, req);
        logger.info(`Pending reaction ${pendingReaction._id} aborted by ${character.characterId} to proceed with new action`);
      }

      // Load SkillConfrontation config
      const config = await SkillConfrontation.findOne({ skillName: attackSkill });
      if (!config) {
        res.status(400).json(errorResponse(
          `Invalid attack skill: ${attackSkill} is not configured for confrontations`,
          'INVALID_ATTACK_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate attacker has the skill
      const attackerCharacter = await Character.findById(character.characterId);
      if (!attackerCharacter) {
        res.status(404).json(errorResponse(
          'Attacker character not found',
          'ATTACKER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const attackerValue = await ConfrontationController.getSkillValueByName(attackerCharacter, attackSkill);

      if (attackerValue === 0) {
        res.status(400).json(errorResponse(
          `You don't have the skill ${attackSkill} or it's at 0`,
          'ATTACKER_MISSING_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate defender exists
      const defenderCharacter = await Character.findById(defenderId);
      if (!defenderCharacter) {
        res.status(404).json(errorResponse(
          'Defender character not found',
          'DEFENDER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const configService = new ConfigurationService(redis.getClient(), logger);

      // ═══ AUTO-RESOLVE (NO DEFENSE CHOICE TO PRESENT) ═══
      // canDefend:false + counterSkills.length===1 = la skill di difesa è
      // obbligata (es. Raggirare -> solo Empatia): niente popup, niente
      // opzione "non difendersi", risoluzione immediata e tiro nascosto.
      // Guidato dal flag di SkillConfrontation, non da un controllo
      // hardcoded sul nome della skill — una futura skill con la stessa
      // caratteristica eredita lo stesso comportamento senza toccare
      // questo file.
      const autoResolve = config.canDefend === false && config.counterSkills.length === 1;

      if (autoResolve) {
        const defenseSkillName = config.counterSkills[0].skillName;
        let defenderValue = await ConfrontationController.getSkillValueByName(defenderCharacter, defenseSkillName);
        if (defenderValue === 0) {
          defenderValue = 1;
          logger.warn(`Defender skill ${defenseSkillName} not found for character ${defenderCharacter._id}, using default value 1`);
        }

        const attackRoll = ConfrontationController.rollDice('1d100').result;
        const defenseRoll = ConfrontationController.rollDice('1d100').result;
        const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;
        const defenseDegree = calculateSuccessDegree(defenseRoll, defenderValue).degree;
        const comparison = compareSuccessDegrees(attackDegree, defenseDegree, attackRoll, defenseRoll);
        const attackerWins = comparison > 0;

        if (config.category !== 'social') {
          // Nessuna skill da combattimento ha oggi counterSkills.length===1
          // (condividono tutte COMBAT_COUNTERS, lunghezza 7): il calcolo
          // danno non è implementato per questo ramo — se mai capitasse,
          // meglio un warning esplicito che un silenzio inspiegabile.
          logger.warn(`Auto-resolve confrontation for non-social category ${config.category}: damage calculation not implemented for this path`);
        }

        const confrontationData: any = {
          type: config.category === 'social' ? 'social' : 'combat',
          phase: 'result',
          attackerCharacterId: character.characterId,
          defenderCharacterId: defenderId,
          attackSkill,
          defenseSkill: defenseSkillName,
          attackRoll,
          defenseRoll,
          attackSuccessLevel: attackDegree,
          defenseSuccessLevel: defenseDegree,
          outcome: attackerWins ? 'attacker_wins' : 'defender_wins',
          hiddenResultForAttacker: true // canDefend:false è per definizione un tiro nascosto
        };

        // Testo di rivelazione per il difensore, specifico di Raggirare
        // (narrativa della bugia) — non generalizzabile senza sapere cosa
        // dovrebbe dire una futura skill diversa. Il preambolo per le
        // prime due soglie termina con ":" perché il frontend lo mostra
        // sopra message.content (già presente nello stesso messaggio, non
        // duplicato qui) — vedi CombatActionMessage.tsx.
        if (attackSkill === 'Raggirare' && !attackerWins) {
          if (defenseDegree === 'hard' || defenseDegree === 'extreme' || defenseDegree === 'critical') {
            confrontationData.messageForDefender = `${attackerCharacter.name} sta evidentemente cercando di nasconderti qualcosa quando dice:`;
          } else if (defenseDegree === 'normal') {
            confrontationData.messageForDefender = `Ti rendi conto che ${attackerCharacter.name} ti sta nascondendo qualcosa.`;
          } else {
            confrontationData.messageForDefender = `L'istinto ti dice di non fidarti del tutto delle parole di ${attackerCharacter.name}.`;
          }
        }

        const messageData: any = {
          actionType: config.category === 'social' ? 'social_confrontation' : 'combat_action',
          characterId: character.characterId,
          characterName: character.characterName,
          content: content.trim(),
          locationId,
          position: position || undefined,
          visibility: 'whisper',
          targetCharacters: [character.characterId, defenderId],
          characterRoles: character.gameplayRoles || [],
          timestamp: new Date(),
          confrontation: confrontationData
        };

        if (attackSkill === 'Raggirare' && additionalMessage) {
          messageData.hiddenContent = additionalMessage;
        }

        const message = await Chat.create(messageData);
        await ConfrontationController.emitConfrontationMessage(req, message);

        logger.info(`Confrontation auto-resolved: ${attackSkill} vs ${defenseSkillName} by ${character.characterName} (${attackerWins ? 'attacker wins' : 'defender wins'})`);

        res.status(201).json(createResponse(
          { action: message, requiresReaction: false, outcome: attackerWins ? 'success' : 'detected' },
          'Confrontation resolved automatically',
          getRequestId(req)
        ));
        return;
      }

      // ═══ UNIFIED 2-PHASE FLOW (ALL OTHER CONFRONTATIONS) ═══

      // Build availableDefenseSkills with __NO_DEFENSE__ option
      interface DefenseSkillOption {
        skillName: string;
        label: string;
        specialRule?: string;
        value?: number;
      }
      const availableDefenseSkills: DefenseSkillOption[] = await Promise.all(config.counterSkills.map(async (cs: any) => ({
        skillName: cs.skillName,
        label: cs.label,
        specialRule: cs.specialRule,
        value: await ConfrontationController.getSkillValueByName(defenderCharacter, cs.skillName)
      })));

      // Add "Non voglio tirare/difendermi" option (always enabled)
      const allowNoDefense = await configService.getConfig('confrontation_allow_no_defense') as boolean;
      if (allowNoDefense) {
        const noDefenseLabel = config.category === 'social'
          ? 'Non voglio tirare (Accetto automaticamente)'
          : 'Non voglio difendermi (Fallimento automatico)';

        availableDefenseSkills.push({
          skillName: '__NO_DEFENSE__',
          label: noDefenseLabel,
          specialRule: 'auto_fail',
          value: undefined
        });
      }

      // Create CombatEncounter to track state
      const encounterType = config.category === 'social' ? 'social_scene' : 'combat';
      const encounter = await CombatEncounter.create({
        locationId,
        sessionId: character.sessionId || 'default-session', // Use character's current session
        encounterType,
        status: 'waiting_reaction',
        participants: [
          { characterId: character.characterId, characterName: character.characterName },
          { characterId: defenderId, characterName: defenderCharacter.name }
        ],
        currentTurn: {
          turnNumber: 1,
          attackerId: character.characterId,
          defenderId,
          attackSkill,
          status: 'waiting_defense'
        },
        turnHistory: []
      });

      // Create reaction request message (whisper visibility, visible only to attacker and defender)
      const messageData: any = {
        actionType: 'confrontation_reaction_request',
        characterId: character.characterId,
        characterName: character.characterName,
        content: content.trim(),
        locationId,
        position: position || undefined,
        visibility: 'whisper',
        targetCharacters: [character.characterId, defenderId],
        characterRoles: character.gameplayRoles || [],
        timestamp: new Date(),
        confrontation: {
          type: config.category === 'social' ? 'social' : 'combat',
          encounterId: encounter._id.toString(),
          phase: 'waiting_reaction',
          attackerCharacterId: character.characterId,
          defenderCharacterId: defenderId,
          availableDefenseSkills, // Use the built array with __NO_DEFENSE__
          attackSkill,
          hiddenResultForAttacker: !config.canDefend // Never true for Raggirare in practice (routed via autoResolve above), kept generic for the canDefend:false+length!==1 fallback case
        }
      };

      // Save Raggirare lie text to hiddenContent (master-visible only)
      if (attackSkill === 'Raggirare' && additionalMessage) {
        messageData.hiddenContent = additionalMessage;
      }

      // CombatEncounter and Chat aren't in a transaction: if message creation
      // fails, delete the encounter too - otherwise it's left in 'waiting_reaction' forever.
      let message;
      try {
        message = await Chat.create(messageData);
      } catch (messageError) {
        await CombatEncounter.deleteOne({ _id: encounter._id });
        throw messageError;
      }

      // Emit WebSocket notification
      await ConfrontationController.emitConfrontationMessage(req, message);

      logger.info(`Confrontation reaction request created: ${message._id} (${attackSkill} attack by ${character.characterName})`);

      res.status(201).json(createResponse(
        { action: message, requiresReaction: true },
        'Confrontation attack initiated, waiting for defender reaction',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Create confrontation attack error:', error);
      res.status(500).json(errorResponse(
        'Failed to create confrontation attack',
        'CONFRONTATION_ATTACK_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Handle Confrontation Reaction (TiroContrapposto Phase 1)
   * POST /game/chats/confrontation-reaction
   *
   * Defender chooses defense skill and resolves the opposed roll.
   * Updates the reaction request message in-place with final results.
   */
  static async handleConfrontationReaction(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Contesto personaggio richiesto',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { messageId, defenseSkillName } = req.body;

      // Validate required fields
      if (!messageId || !defenseSkillName) {
        res.status(400).json(errorResponse(
          'messageId and defenseSkillName are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // messageId must be a plain ObjectId string — reject query objects (e.g. { $ne: null })
      // before it's used as a filter value anywhere below (NoSQL injection guard)
      if (typeof messageId !== 'string' || !Types.ObjectId.isValid(messageId)) {
        res.status(400).json(errorResponse(
          'messageId non valido',
          'INVALID_MESSAGE_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // defenseSkillName must be a plain string — same NoSQL injection guard as messageId above
      if (typeof defenseSkillName !== 'string') {
        res.status(400).json(errorResponse(
          'defenseSkillName non valido',
          'INVALID_DEFENSE_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find reaction request message
      const message: any = await Chat.findById(messageId);
      if (!message || message.actionType !== 'confrontation_reaction_request') {
        res.status(404).json(errorResponse(
          'Reaction request not found or already processed',
          'REACTION_REQUEST_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Validate defender authorization
      if (message.confrontation.defenderCharacterId !== character.characterId) {
        res.status(403).json(errorResponse(
          'You are not the defender of this confrontation',
          'UNAUTHORIZED_DEFENDER',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Validate defense skill is in available options
      const availableSkills = message.confrontation.availableDefenseSkills.map((s: any) => s.skillName);
      if (!availableSkills.includes(defenseSkillName)) {
        res.status(400).json(errorResponse(
          `Invalid defense skill: ${defenseSkillName} is not available for this confrontation`,
          'INVALID_DEFENSE_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get characters
      const attackerCharacter = await Character.findById(message.confrontation.attackerCharacterId);
      const defenderCharacter = await Character.findById(character.characterId);

      if (!attackerCharacter || !defenderCharacter) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // ═══ CHECK 1: NO-DEFENSE OPTION (AUTO-FAIL) ═══
      if (defenseSkillName === '__NO_DEFENSE__') {
        // Defender chose not to defend - auto-fail
        const attackSkill = message.confrontation.attackSkill;
        const attackerValue = await ConfrontationController.getSkillValueByName(attackerCharacter, attackSkill);

        const attackRoll = ConfrontationController.rollDice('1d100').result;
        const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;

        // Auto-fail: defender gets fumble, attacker rolls normally
        const updateFields: any = {
          actionType: message.confrontation.type === 'combat' ? 'combat_action' : 'social_confrontation',
          visibility: 'public',
          'confrontation.phase': 'result',
          'confrontation.defenseSkill': 'Nessuna difesa',
          'confrontation.attackRoll': attackRoll,
          'confrontation.defenseRoll': 100, // Fumble
          'confrontation.attackSuccessLevel': attackDegree,
          'confrontation.defenseSuccessLevel': 'fumble',
          'confrontation.outcome': 'hit'
        };

        const updated: any = await Chat.findOneAndUpdate(
          { _id: messageId, actionType: 'confrontation_reaction_request' },
          { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
          { new: true }
        );

        if (updated) {
          await CombatEncounter.updateOne(
            { _id: message.confrontation.encounterId },
            { $set: { status: 'completed', 'currentTurn.status': 'resolved', 'currentTurn.defenseSkill': 'Nessuna difesa' } }
          );

          await ConfrontationController.emitConfrontationMessage(req, updated);
        }

        logger.info(`No-defense auto-fail: ${messageId} (${character.characterName} chose not to defend)`);
        res.json(createResponse({ outcome: 'hit', autoFail: true }, 'Defender chose not to defend', getRequestId(req)));
        return;
      }

      // ═══ CHECK 2: CONSTITUTION CHECK (COMBAT ONLY, WOUNDED) ═══
      const configService = new ConfigurationService(redis.getClient(), logger);
      const isCombat = message.confrontation.type === 'combat';

      if (isCombat) {
        const currentHP = defenderCharacter.combat?.currentHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const maxHP = defenderCharacter.combat?.maxHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const threshold = await configService.getConfig('combat_wounded_constitution_check_threshold') as number;

        if ((currentHP / maxHP) <= threshold && currentHP > 0) {
          // Wounded - requires constitution check
          const constitutionValue = defenderCharacter.stats?.constitution || 10;
          const constitutionRoll = ConfrontationController.rollDice('1d100').result;
          const constitutionCheck = calculateSuccessDegree(constitutionRoll, constitutionValue);

          if (constitutionCheck.degree === 'failure' || constitutionCheck.degree === 'fumble') {
            // Failed constitution check - cannot defend (same as no-defense)
            const attackSkill = message.confrontation.attackSkill;
            const attackerValue = await ConfrontationController.getSkillValueByName(attackerCharacter, attackSkill);

            const attackRoll = ConfrontationController.rollDice('1d100').result;
            const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;

            const updateFields: any = {
              actionType: 'combat_action',
              visibility: 'public',
              'confrontation.phase': 'result',
              'confrontation.defenseSkill': 'Impossibile difendersi (ferito)',
              'confrontation.attackRoll': attackRoll,
              'confrontation.defenseRoll': 100,
              'confrontation.attackSuccessLevel': attackDegree,
              'confrontation.defenseSuccessLevel': 'fumble',
              'confrontation.outcome': 'hit',
              'confrontation.constitutionCheckRequired': true,
              'confrontation.constitutionCheckPassed': false,
              'confrontation.constitutionCheckRoll': constitutionRoll
            };

            const updated: any = await Chat.findOneAndUpdate(
              { _id: messageId, actionType: 'confrontation_reaction_request' },
              { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
              { new: true }
            );

            if (updated) {
              await CombatEncounter.updateOne(
                { _id: message.confrontation.encounterId },
                { $set: { status: 'completed', 'currentTurn.status': 'resolved' } }
              );

              await ConfrontationController.emitConfrontationMessage(req, updated);
            }

            logger.info(`Constitution check failed: ${messageId} (${character.characterName} too wounded to defend, ${constitutionRoll} vs ${constitutionValue})`);
            res.json(createResponse({ outcome: 'hit', constitutionCheckFailed: true }, 'Troppo ferito per difendersi', getRequestId(req)));
            return;
          }

          logger.info(`Constitution check passed: ${character.characterName} can defend (${constitutionRoll} vs ${constitutionValue})`);
        }
      }

      // ═══ NORMAL CONFRONTATION RESOLUTION ═══

      // Get attacker skill value
      const attackSkill = message.confrontation.attackSkill;
      const attackerValue = await ConfrontationController.getSkillValueByName(attackerCharacter, attackSkill);

      // Get defender skill value
      let defenderValue = await ConfrontationController.getSkillValueByName(defenderCharacter, defenseSkillName);

      // Default to 1 if skill not found
      if (defenderValue === 0) {
        defenderValue = 1;
        logger.warn(`Defender skill ${defenseSkillName} not found for character ${character.characterId}, using default value 1`);
      }

      // Roll dice
      const attackRoll = ConfrontationController.rollDice('1d100').result;
      const defenseRoll = ConfrontationController.rollDice('1d100').result;

      // Calculate success degrees
      const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;
      const defenseDegree = calculateSuccessDegree(defenseRoll, defenderValue).degree;

      // Compare degrees to determine outcome
      const comparison = compareSuccessDegrees(attackDegree, defenseDegree, attackRoll, defenseRoll);
      const outcome = comparison > 0 ? 'hit' : 'miss';

      // ═══ NORMAL CONFRONTATION: CALCULATE DAMAGE IF HIT (COMBAT ONLY) ═══
      let damageDealt = 0;
      let isCriticalDamage = false;
      let damageFormula = '';

      if (outcome === 'hit' && message.confrontation.type === 'combat') {
        // Import damage calculator
        const { calculateDamage, applyDamage } = await import('@modules/game/utils/damageCalculator');

        // Determine damage formula (weapon or unarmed)
        const weaponStats = await WeaponService.getEquippedWeapon(attackerCharacter._id.toString());

        if (weaponStats) {
          damageFormula = weaponStats.damageFormula;
          logger.info(`[Combat] ${attackerCharacter.name} uses ${weaponStats.weaponType}: ${damageFormula}`);
        } else {
          damageFormula = '1d3'; // Fallback: unarmed combat
          logger.info(`[Combat] ${attackerCharacter.name} uses unarmed combat: 1d3`);
        }

        // Calculate damage
        const damageResult = calculateDamage(
          damageFormula,
          attackerCharacter.derived?.bonusDamage || '0',
          attackDegree
        );

        damageDealt = damageResult.total;
        isCriticalDamage = damageResult.isCritical;

        // Apply damage to defender
        const defenderHP = defenderCharacter.combat?.currentHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const defenderMaxHP = defenderCharacter.combat?.maxHP ?? defenderCharacter.derived?.hitPoints ?? 10;

        const damageResult2 = applyDamage(defenderHP, defenderMaxHP, damageDealt);

        // Update defender's combat state
        await Character.updateOne(
          { _id: defenderCharacter._id },
          {
            $set: {
              'combat.currentHP': damageResult2.newHP,
              'combat.maxHP': defenderMaxHP,
              'combat.isDead': damageResult2.isDead,
              'combat.isIncapacitated': damageResult2.isIncapacitated
            },
            $push: {
              'combat.wounds': {
                damage: damageDealt,
                source: `${attackerCharacter.name} (${attackSkill})`,
                timestamp: new Date()
              }
            }
          }
        );

        logger.info(`Damage applied: ${damageDealt} HP to ${defenderCharacter.name} (${damageResult2.newHP}/${defenderMaxHP} HP remaining)`);
      }

      // Update message IN-PLACE (atomic update with condition)
      const updateFields: any = {
        actionType: message.confrontation.type === 'combat' ? 'combat_action' : 'social_confrontation',
        visibility: 'public',
        'confrontation.phase': 'result',
        'confrontation.defenseSkill': defenseSkillName,
        'confrontation.attackRoll': attackRoll,
        'confrontation.defenseRoll': defenseRoll,
        'confrontation.attackSuccessLevel': attackDegree,
        'confrontation.defenseSuccessLevel': defenseDegree,
        'confrontation.outcome': outcome
      };

      // Add damage fields if combat
      if (damageDealt > 0) {
        updateFields['confrontation.damageDealt'] = damageDealt;
        updateFields['confrontation.isCriticalDamage'] = isCriticalDamage;
        updateFields['confrontation.damageFormula'] = damageFormula;
      }

      const updated: any = await Chat.findOneAndUpdate(
        {
          _id: messageId,
          actionType: 'confrontation_reaction_request' // Prevent double-processing
        },
        {
          $set: updateFields,
          $unset: {
            targetCharacters: '',
            'confrontation.availableDefenseSkills': ''
          }
        },
        { new: true }
      );

      if (!updated) {
        res.status(410).json(errorResponse(
          'Reaction request already processed',
          'ALREADY_PROCESSED',
          undefined,
          410,
          getRequestId(req)
        ));
        return;
      }

      // Update encounter status
      await CombatEncounter.updateOne(
        { _id: message.confrontation.encounterId },
        {
          $set: {
            status: 'completed',
            'currentTurn.status': 'resolved',
            'currentTurn.defenseSkill': defenseSkillName
          }
        }
      );

      // Emit WebSocket notification (SAME actionId, message was updated)
      await ConfrontationController.emitConfrontationMessage(req, updated);

      logger.info(`Confrontation resolved: ${messageId} (${outcome}: ${attackDegree} vs ${defenseDegree})`);

      res.json(createResponse(
        { action: updated, outcome },
        'Confrontation resolved successfully',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Handle confrontation reaction error:', error);
      res.status(500).json(errorResponse(
        'Failed to handle confrontation reaction',
        'CONFRONTATION_REACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Handle Pending Reaction Abort
   *
   * Automatically resolves pending reaction with defender auto-fail.
   * Used when attacker force-aborts to proceed with new action or when timeout expires.
   *
   * @param messageId - Pending reaction request message ID
   * @param abortedByCharacterId - Character who triggered the abort
   * @param req - Express request (for WebSocket IO access)
   */
  static async handlePendingReactionAbort(
    messageId: string,
    abortedByCharacterId: string,
    req: Request
  ): Promise<void> {
    const message: any = await Chat.findById(messageId);
    if (!message || message.confrontation?.phase !== 'waiting_reaction') {
      logger.warn(`Abort failed: message ${messageId} not found or already resolved`);
      return;
    }

    // Get characters
    const attackerCharacter = await Character.findById(message.confrontation.attackerCharacterId);
    const defenderCharacter = await Character.findById(message.confrontation.defenderCharacterId);

    if (!attackerCharacter || !defenderCharacter) {
      logger.error(`Abort failed: characters not found for message ${messageId}`);
      return;
    }

    // Get attacker skill value
    const attackSkill = message.confrontation.attackSkill;
    const attackerValue = await ConfrontationController.getSkillValueByName(attackerCharacter, attackSkill);

    // Roll attack (defender auto-fails)
    const attackRoll = ConfrontationController.rollDice('1d100').result;
    const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;

    // Prepare update fields
    const updateFields: any = {
      actionType: message.confrontation.type === 'combat' ? 'combat_action' : 'social_confrontation',
      visibility: 'public',
      'confrontation.phase': 'result',
      'confrontation.defenseSkill': 'Aborted (auto-fail)',
      'confrontation.attackRoll': attackRoll,
      'confrontation.defenseRoll': 100, // Auto-fumble
      'confrontation.attackSuccessLevel': attackDegree,
      'confrontation.defenseSuccessLevel': 'fumble',
      'confrontation.outcome': 'hit',
      'confrontation.abortedBy': abortedByCharacterId,
      'confrontation.abortedAt': new Date()
    };

    // Calculate damage if combat
    if (message.confrontation.type === 'combat') {
      const { calculateDamage, applyDamage } = await import('@modules/game/utils/damageCalculator');

      const damageFormula = '1d3'; // Unarmed default
      const damageResult = calculateDamage(
        damageFormula,
        attackerCharacter.derived?.bonusDamage || '0',
        attackDegree
      );

      const damageDealt = damageResult.total;
      const isCriticalDamage = damageResult.isCritical;

      // Apply damage to defender
      const defenderHP = defenderCharacter.combat?.currentHP ?? defenderCharacter.derived?.hitPoints ?? 10;
      const defenderMaxHP = defenderCharacter.combat?.maxHP ?? defenderCharacter.derived?.hitPoints ?? 10;
      const damageResult2 = applyDamage(defenderHP, defenderMaxHP, damageDealt);

      await Character.updateOne(
        { _id: defenderCharacter._id },
        {
          $set: {
            'combat.currentHP': damageResult2.newHP,
            'combat.maxHP': defenderMaxHP,
            'combat.isDead': damageResult2.isDead,
            'combat.isIncapacitated': damageResult2.isIncapacitated
          },
          $push: {
            'combat.wounds': {
              damage: damageDealt,
              source: `${attackerCharacter.name} (${attackSkill}) - Aborted`,
              timestamp: new Date()
            }
          }
        }
      );

      updateFields['confrontation.damageDealt'] = damageDealt;
      updateFields['confrontation.isCriticalDamage'] = isCriticalDamage;
      updateFields['confrontation.damageFormula'] = damageFormula;

      logger.info(`Damage applied (aborted): ${damageDealt} HP to ${defenderCharacter.name}`);
    }

    // Update message
    const updated: any = await Chat.findOneAndUpdate(
      { _id: messageId, actionType: 'confrontation_reaction_request' },
      { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
      { new: true }
    );

    // Update encounter
    await CombatEncounter.updateOne(
      { _id: message.confrontation.encounterId },
      { $set: { status: 'completed', 'currentTurn.status': 'resolved' } }
    );

    // Emit WebSocket update
    if (updated) {
      await ConfrontationController.emitConfrontationMessage(req, updated);
    }

    logger.info(`Pending reaction aborted: ${messageId} by ${abortedByCharacterId}`);
  }

  /**
   * Force Confrontation Outcome (MASTER ONLY)
   * POST /game/chats/force-confrontation-outcome
   *
   * Allows master to forcibly resolve a pending confrontation with custom outcome.
   * Used to bypass stuck situations or apply narrative rulings.
   */
  static async forceConfrontationOutcome(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Contesto personaggio richiesto',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Validate master permission
      if (!character.gameplayRoles?.includes('master')) {
        res.status(403).json(errorResponse(
          'Solo il master può forzare esiti di confronti',
          'MASTER_PERMISSION_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const { messageId, forcedOutcome, defenderSuccessLevel } = req.body;

      // Validate required fields
      if (!messageId || !forcedOutcome) {
        res.status(400).json(errorResponse(
          'messageId and forcedOutcome are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // messageId must be a plain ObjectId string — reject query objects (e.g. { $ne: null })
      // before it's used as a filter value anywhere below (NoSQL injection guard)
      if (typeof messageId !== 'string' || !Types.ObjectId.isValid(messageId)) {
        res.status(400).json(errorResponse(
          'messageId non valido',
          'INVALID_MESSAGE_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find message
      const message: any = await Chat.findById(messageId);
      if (!message || message.confrontation?.phase !== 'waiting_reaction') {
        res.status(400).json(errorResponse(
          'Messaggio non valido o già risolto',
          'INVALID_MESSAGE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get characters
      const attackerCharacter = await Character.findById(message.confrontation.attackerCharacterId);
      const defenderCharacter = await Character.findById(message.confrontation.defenderCharacterId);

      if (!attackerCharacter || !defenderCharacter) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get skill values
      const attackSkill = message.confrontation.attackSkill;
      const defenseSkill = message.confrontation.availableDefenseSkills?.[0]?.skillName || 'Unknown';

      const attackerValue = await ConfrontationController.getSkillValueByName(attackerCharacter, attackSkill);
      const defenderValue = await ConfrontationController.getSkillValueByName(defenderCharacter, defenseSkill);

      // Roll dice (for record, outcome is forced)
      const attackRoll = ConfrontationController.rollDice('1d100').result;
      const defenseRoll = ConfrontationController.rollDice('1d100').result;

      // Calculate natural success levels
      const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;
      const naturalDefenseDegree = calculateSuccessDegree(defenseRoll, defenderValue).degree;

      // Apply forced outcome
      const finalDefenseDegree = defenderSuccessLevel || naturalDefenseDegree;
      const outcome = forcedOutcome; // 'attacker_wins' or 'defender_wins'

      // Update message
      const updateFields: any = {
        actionType: message.confrontation.type === 'combat' ? 'combat_action' : 'social_confrontation',
        visibility: 'public',
        'confrontation.phase': 'result',
        'confrontation.defenseSkill': defenseSkill,
        'confrontation.attackRoll': attackRoll,
        'confrontation.defenseRoll': defenseRoll,
        'confrontation.attackSuccessLevel': attackDegree,
        'confrontation.defenseSuccessLevel': finalDefenseDegree,
        'confrontation.outcome': outcome,
        'confrontation.forcedByMaster': true,
        'confrontation.forcedBy': character.characterId,
        'confrontation.forcedAt': new Date()
      };

      // Calculate damage if combat + attacker wins
      if (message.confrontation.type === 'combat' && outcome === 'attacker_wins') {
        const { calculateDamage, applyDamage } = await import('@modules/game/utils/damageCalculator');

        const damageFormula = '1d3'; // Unarmed default
        const damageResult = calculateDamage(
          damageFormula,
          attackerCharacter.derived?.bonusDamage || '0',
          attackDegree
        );

        const damageDealt = damageResult.total;
        const isCriticalDamage = damageResult.isCritical;

        // Apply damage to defender
        const defenderHP = defenderCharacter.combat?.currentHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const defenderMaxHP = defenderCharacter.combat?.maxHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const damageResult2 = applyDamage(defenderHP, defenderMaxHP, damageDealt);

        await Character.updateOne(
          { _id: defenderCharacter._id },
          {
            $set: {
              'combat.currentHP': damageResult2.newHP,
              'combat.maxHP': defenderMaxHP,
              'combat.isDead': damageResult2.isDead,
              'combat.isIncapacitated': damageResult2.isIncapacitated
            },
            $push: {
              'combat.wounds': {
                damage: damageDealt,
                source: `${attackerCharacter.name} (${attackSkill}) - Master Forced`,
                timestamp: new Date()
              }
            }
          }
        );

        updateFields['confrontation.damageDealt'] = damageDealt;
        updateFields['confrontation.isCriticalDamage'] = isCriticalDamage;
        updateFields['confrontation.damageFormula'] = damageFormula;
      }

      // Update message
      const updated: any = await Chat.findOneAndUpdate(
        { _id: messageId, actionType: 'confrontation_reaction_request' },
        { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
        { new: true }
      );

      // Update encounter
      await CombatEncounter.updateOne(
        { _id: message.confrontation.encounterId },
        { $set: { status: 'completed', 'currentTurn.status': 'resolved', 'currentTurn.defenseSkill': defenseSkill } }
      );

      // Emit WebSocket update
      await ConfrontationController.emitConfrontationMessage(req, updated);

      logger.info(`Confrontation forced by master: ${messageId} (${outcome}, ${character.characterName})`);
      res.json(createResponse({ action: updated, outcome }, 'Esito forzato dal master', getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Force confrontation outcome error:', error);
      res.status(500).json(errorResponse(
        'Failed to force confrontation outcome',
        'FORCE_OUTCOME_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
