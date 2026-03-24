import { Request, Response } from 'express';
import { Character, Location, Skill, Occupation } from '@database/models';
import { logger } from '../utils/logger';
import { aiGatewayClient } from '../../game/services/AIGatewayClient';

/**
 * BotController — flusso ASSEGNA BOT (sincrono)
 *
 * Step 1 — genera bot AI persona:
 *   POST /admin/bots/generate → attende local-ai (fino a 120s), risponde con i dati bot
 *
 * Step 2 — refinement (sincrono):
 *   PUT /admin/bots/:localAiBotId/refine → { bot }
 *
 * Step 3 — conferma location + genera character:
 *   POST /admin/bots/:localAiBotId/confirm → attende character-gen (fino a 5min),
 *   crea Character + aggiorna Location, risponde con { characterId }
 *
 * Cancella bot:
 *   DELETE /admin/bots/:localAiBotId
 *
 * Sync botConfig → local-ai:
 *   PUT /admin/bots/:characterId/sync
 */
export class BotController {

  // ─── Step 1: generate ────────────────────────────────────────────────────────

  /**
   * POST /admin/bots/generate
   * Body: { name?: string, description: string }
   * Chiama local-ai in modo sincrono e risponde con i dati del bot generato.
   */
  static async generate(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, locationId, locationName, locationDescription } = req.body;

      if (!description || description.trim().length < 5) {
        res.status(400).json({ result: false, error: 'description è obbligatoria' });
        return;
      }

      const requestId = `bot-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const result = await aiGatewayClient.generateBot({
        requestId,
        description: name ? `${name} — ${description}` : description,
        style: 'Londra vittoriana, fine 1800, Call of Cthulhu',
        locale: 'it',
        ...(locationName && {
          location: {
            id: locationId,
            name: locationName,
            description: locationDescription,
          },
        }),
      }) as any;

      if (!result?.success || !result?.data) {
        res.status(502).json({ result: false, error: 'Local-AI non raggiungibile o risposta non valida. Verifica che il servizio sia attivo.' });
        return;
      }

      const bot = result.data;
      logger.info(`[BotController] Bot generato: "${bot.name}" (${bot._id})`);

      res.json({
        result: true,
        data: {
          localAiBotId: bot._id || bot.id,
          bot,
        },
      });
    } catch (err: any) {
      logger.error('[BotController] generate error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }

  // ─── Step 2: refine (AI-powered) ─────────────────────────────────────────────

  /**
   * PUT /admin/bots/:localAiBotId/refine
   * Body: { hints: { name?, publicDescription?, personality?, narrativeStyle?, systemPrompt? } }
   *
   * Invia i dati attuali del bot + gli hint dell'admin ad Anthropic,
   * che li integra in modo coerente e aggiorna il DB di local-ai.
   */
  static async refine(req: Request, res: Response): Promise<void> {
    try {
      const localAiBotId = req.params.localAiBotId as string;

      // Il body del frontend è già strutturato come hints
      const result = await aiGatewayClient.refineBot(localAiBotId, {
        hints: req.body,
        style: 'Londra vittoriana, fine 1800, Call of Cthulhu',
        locale: 'it',
      }) as any;

      if (!result?.success || !result?.data) {
        res.status(502).json({ result: false, error: 'Impossibile raffinare il bot su local-ai' });
        return;
      }

      res.json({ result: true, data: { bot: result.data } });
    } catch (err: any) {
      logger.error('[BotController] refine error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }

  // ─── Step 3: confirm ─────────────────────────────────────────────────────────

  /**
   * POST /admin/bots/:localAiBotId/confirm
   * Body: { botData, locationId }
   * Chiama character-gen in modo sincrono, crea Character, aggiorna Location.
   */
  static async confirm(req: Request, res: Response): Promise<void> {
    try {
      const localAiBotId = req.params.localAiBotId as string;
      const { botData, locationId } = req.body;

      if (!localAiBotId || !locationId) {
        res.status(400).json({ result: false, error: 'localAiBotId e locationId sono obbligatori' });
        return;
      }

      const location = await Location.findById(locationId).lean();
      if (!location) {
        res.status(404).json({ result: false, error: 'Location non trovata' });
        return;
      }

      // Fetch game config (skills e occupations)
      const [skillDocs, occupationDocs] = await Promise.all([
        Skill.find({}).select('_id name baseValue category isPlaceholder').lean().catch(() => []),
        Occupation.find({}).select('_id name description').lean().catch(() => []),
      ]);

      const skills = (skillDocs as any[]).map((s: any) => {
        let bv = 0;
        if (typeof s.baseValue === 'number') bv = s.baseValue;
        else if (typeof s.baseValue === 'string') {
          const m = s.baseValue.match(/VALUE:(\d+)/i);
          bv = m ? parseInt(m[1], 10) : 0;
        }
        return { id: s._id.toString(), name: s.name, baseValue: bv, category: s.category, isPlaceholder: s.isPlaceholder };
      });

      const occupations = (occupationDocs as any[]).map((o: any) => ({
        id: o._id.toString(), name: o.name, description: o.description,
      }));

      const charRequestId = `char-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = botData?.name || 'Bot';
      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ') || 'NPC';

      // Chiamata sincrona a character-gen (può richiedere 2-5 minuti)
      const genResult = await aiGatewayClient.generateCharacter({
        requestId: charRequestId,
        character: {
          firstName,
          lastName,
          gender: botData?.gender || 'male',
          description: botData?.publicDescription || botData?.personality?.background || name,
        },
        gameConfig: { skills, occupations, statsBudget: 450, skillsBudget: 250 },
      }) as any;

      if (!genResult?.success || !genResult?.character) {
        res.status(502).json({ result: false, error: 'Errore nella generazione del personaggio da character-gen' });
        return;
      }

      const charPayload = genResult.character;

      // Converti birthDate da YYYY-MM-DD (ISO) a gg/mm/yyyy come atteso dal modello
      const convertBirthDate = (iso?: string): string | undefined => {
        if (!iso) return undefined;
        const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${parseInt(m[3])}/${parseInt(m[2])}/${m[1]}`;
        return undefined;
      };

      // Crea il Character nel DB
      const character = await Character.create({
        name: charPayload.firstName || firstName,
        surname: charPayload.lastName || lastName,
        gender: charPayload.gender || botData?.gender || 'male',
        characterType: 'png',
        isBot: true,
        bot_id: localAiBotId,
        userId: (req as any).user?.userId,   // l'admin che crea il bot
        botConfig: {
          localAiBotId,
          name: botData?.name,
          gender: botData?.gender,
          publicDescription: botData?.publicDescription,
          personality: botData?.personality,
          systemPrompt: botData?.systemPrompt,
          narrativeStyle: botData?.narrativeStyle,
          syncedAt: new Date(),
        },
        currentLocation: locationId,
        playerStatus: 'approved',

        birthDate: convertBirthDate(charPayload.birthDate),
        age: charPayload.age,
        apparentAge: charPayload.apparentAge,
        height: charPayload.height,
        weight: charPayload.weight,
        eyeColor: charPayload.eyeColor,
        hairColor: charPayload.hairColor,
        visibleMarks: charPayload.visibleMarks,
        hiddenMarks: charPayload.hiddenMarks,
        maritalStatus: charPayload.maritalStatus,
        educationTitle: charPayload.educationTitle,
        publicDescription: charPayload.publicDescription || botData?.publicDescription,
        privateDescription: charPayload.privateDescription,
        physicalDescription: charPayload.physicalDescription,
        occupation: charPayload.occupation,
        currentOccupation: charPayload.currentOccupation,
        stats: charPayload.stats,
        skills: charPayload.skills,
        background: charPayload.background,
        backgroundCompleted: true,
        backgroundCompletedAt: new Date(),
      });

      // Aggiorna la location
      await Location.findByIdAndUpdate(locationId, {
        $set: { bot_enabled: true, botCharacterId: character._id },
      });

      logger.info(`[BotController] Character bot creato: ${character._id} → location ${locationId}`);

      res.json({
        result: true,
        data: {
          characterId: character._id.toString(),
          localAiBotId,
          locationId,
        },
      });
    } catch (err: any) {
      logger.error('[BotController] confirm error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }

  // ─── Cancella bot ────────────────────────────────────────────────────────────

  /**
   * DELETE /admin/bots/:localAiBotId
   */
  static async remove(req: Request, res: Response): Promise<void> {
    try {
      const localAiBotId = req.params.localAiBotId as string;
      await aiGatewayClient.deleteBot(localAiBotId);
      res.json({ result: true });
    } catch (err: any) {
      logger.error('[BotController] remove error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }

  // ─── Sync botConfig → local-ai ───────────────────────────────────────────────

  /**
   * PUT /admin/bots/:characterId/sync
   */
  static async syncToLocalAi(req: Request, res: Response): Promise<void> {
    try {
      const character = await Character.findById(req.params.characterId).lean();
      if (!character || !character.botConfig?.localAiBotId) {
        res.status(404).json({ result: false, error: 'Personaggio bot non trovato' });
        return;
      }

      const { localAiBotId, syncedAt: _syncedAt, ...botFields } = character.botConfig as any;
      const updated = await aiGatewayClient.updateBot(localAiBotId, botFields);
      if (!updated) {
        res.status(502).json({ result: false, error: 'Impossibile sincronizzare con local-ai' });
        return;
      }

      await Character.findByIdAndUpdate(req.params.characterId, {
        $set: { 'botConfig.syncedAt': new Date() },
      });

      res.json({ result: true, data: { synced: true } });
    } catch (err: any) {
      logger.error('[BotController] syncToLocalAi error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }
}
