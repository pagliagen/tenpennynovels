import { Request, Response } from 'express';
import { Types } from 'mongoose';
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
   * Invia i dati attuali del bot + gli hint dell'admin all'LLM configurato,
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

      // Validate locationId to prevent query injection
      if (!Types.ObjectId.isValid(locationId)) {
        res.status(400).json({ result: false, error: 'Invalid location ID format' });
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

      // Tronca stringhe AI-generated per rispettare i maxlength dello schema Character
      const t = (val: unknown, max: number): string | undefined => {
        if (val == null) return undefined;
        const s = typeof val === 'string' ? val : String(val);
        return s.slice(0, max);
      };

      // Crea il Character nel DB
      const character = await Character.create({
        name: t(charPayload.firstName || firstName, 50),
        surname: t(charPayload.lastName || lastName, 50),
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
        height: t(charPayload.height, 20),
        weight: t(charPayload.weight, 20),
        eyeColor: t(charPayload.eyeColor, 50),
        hairColor: t(charPayload.hairColor, 50),
        visibleMarks: t(charPayload.visibleMarks, 500),
        hiddenMarks: t(charPayload.hiddenMarks, 500),
        maritalStatus: t(charPayload.maritalStatus, 50),
        educationTitle: t(charPayload.educationTitle, 100),
        publicDescription: t(charPayload.publicDescription || botData?.publicDescription, 5000),
        privateDescription: t(charPayload.privateDescription, 5000),
        physicalDescription: t(charPayload.physicalDescription, 5000),
        occupation: charPayload.occupation,
        currentOccupation: t(charPayload.currentOccupation, 100),
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

      // Attiva il bot su local-ai (da pending → active)
      await aiGatewayClient.updateBot(localAiBotId, { status: 'active' });

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

  // ─── List & Detail ──────────────────────────────────────────────────────────

  /**
   * GET /admin/bots/list
   * Ritorna tutti i bot attivi da local-ai, arricchiti con info Character/Location.
   */
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const botsResult = await aiGatewayClient.getBots() as any;
      if (!botsResult?.success || !botsResult?.data) {
        res.status(502).json({ result: false, error: 'Local-AI non raggiungibile' });
        return;
      }

      const bots = botsResult.data as any[];

      // Arricchisci con info Character (location, characterId)
      const botIds = bots.map((b: any) => b._id?.toString() || b.id);
      const characters = await Character.find({
        isBot: true,
        'botConfig.localAiBotId': { $in: botIds },
      }).select('_id name surname currentLocation botConfig.localAiBotId').populate('currentLocation', '_id name slug').lean();

      const charByBotId = new Map<string, any>();
      for (const ch of characters) {
        const lid = (ch.botConfig as any)?.localAiBotId;
        if (lid) charByBotId.set(lid, ch);
      }

      const enriched = bots.map((bot: any) => {
        const ch = charByBotId.get(bot._id?.toString() || bot.id);
        return {
          ...bot,
          character: ch ? {
            _id: ch._id.toString(),
            name: ch.name,
            surname: ch.surname,
            location: ch.currentLocation ? {
              _id: (ch.currentLocation as any)._id?.toString(),
              name: (ch.currentLocation as any).name,
              slug: (ch.currentLocation as any).slug,
            } : null,
          } : null,
        };
      });

      res.json({ result: true, data: enriched });
    } catch (err: any) {
      logger.error('[BotController] list error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }

  /**
   * GET /admin/bots/:localAiBotId/detail
   * Ritorna bot + relazioni + memorie recenti da local-ai, arricchiti con info Character.
   */
  static async detail(req: Request, res: Response): Promise<void> {
    try {
      const localAiBotId = req.params.localAiBotId as string;

      const [botResult, relResult, memResult] = await Promise.all([
        aiGatewayClient.getBot(localAiBotId) as any,
        aiGatewayClient.getBotRelationships(localAiBotId) as any,
        aiGatewayClient.getBotMemories(localAiBotId) as any,
      ]);

      if (!botResult?.success || !botResult?.data) {
        res.status(404).json({ result: false, error: 'Bot non trovato su local-ai' });
        return;
      }

      // Trova il Character associato per info location
      const character = await Character.findOne({
        isBot: true,
        'botConfig.localAiBotId': localAiBotId,
      }).select('_id name surname currentLocation playerStatus').populate('currentLocation', '_id name slug').lean();

      res.json({
        result: true,
        data: {
          bot: botResult.data,
          relationships: relResult?.data || [],
          memories: memResult?.data || [],
          character: character ? {
            _id: character._id.toString(),
            name: character.name,
            surname: character.surname,
            playerStatus: character.playerStatus,
            location: character.currentLocation ? {
              _id: (character.currentLocation as any)._id?.toString(),
              name: (character.currentLocation as any).name,
              slug: (character.currentLocation as any).slug,
            } : null,
          } : null,
        },
      });
    } catch (err: any) {
      logger.error('[BotController] detail error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }

  /**
   * PUT /admin/bots/:localAiBotId
   * Aggiorna campi del bot su local-ai + sincronizza botConfig nel Character.
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const localAiBotId = req.params.localAiBotId as string;
      const updateData = req.body;

      const result = await aiGatewayClient.updateBot(localAiBotId, updateData) as any;
      if (!result?.success) {
        res.status(502).json({ result: false, error: 'Impossibile aggiornare il bot su local-ai' });
        return;
      }

      // Sincronizza botConfig nel Character
      const botData = result.data || updateData;
      const updateFields: Record<string, any> = { 'botConfig.syncedAt': new Date() };
      if (botData.name) updateFields['botConfig.name'] = botData.name;
      if (botData.gender) updateFields['botConfig.gender'] = botData.gender;
      if (botData.publicDescription) updateFields['botConfig.publicDescription'] = botData.publicDescription;
      if (botData.personality) updateFields['botConfig.personality'] = botData.personality;
      if (botData.systemPrompt) updateFields['botConfig.systemPrompt'] = botData.systemPrompt;
      if (botData.narrativeStyle !== undefined) updateFields['botConfig.narrativeStyle'] = botData.narrativeStyle;

      await Character.findOneAndUpdate(
        { 'botConfig.localAiBotId': localAiBotId },
        { $set: updateFields },
      );

      res.json({ result: true, data: result.data || botData });
    } catch (err: any) {
      logger.error('[BotController] update error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }

  /**
   * PUT /admin/bots/:localAiBotId/location
   * Body: { locationId }
   * Cambia la location del bot (aggiorna Character + vecchia/nuova Location).
   */
  static async changeLocation(req: Request, res: Response): Promise<void> {
    try {
      const localAiBotId = req.params.localAiBotId as string;
      const { locationId } = req.body;

      if (!locationId) {
        res.status(400).json({ result: false, error: 'locationId è obbligatorio' });
        return;
      }

      // Validate locationId to prevent query injection
      if (!Types.ObjectId.isValid(locationId)) {
        res.status(400).json({ result: false, error: 'Invalid location ID format' });
        return;
      }

      const newLocation = await Location.findById(locationId).lean();
      if (!newLocation) {
        res.status(404).json({ result: false, error: 'Location non trovata' });
        return;
      }

      const character = await Character.findOne({
        isBot: true,
        'botConfig.localAiBotId': localAiBotId,
      });
      if (!character) {
        res.status(404).json({ result: false, error: 'Character bot non trovato' });
        return;
      }

      const oldLocationId = character.currentLocation?.toString();

      // Rimuovi bot dalla vecchia location
      if (oldLocationId) {
        await Location.findByIdAndUpdate(oldLocationId, {
          $set: { bot_enabled: false, botCharacterId: null },
        });
      }

      // Assegna alla nuova location
      await Location.findByIdAndUpdate(locationId, {
        $set: { bot_enabled: true, botCharacterId: character._id },
      });

      character.currentLocation = locationId;
      await character.save();

      logger.info(`[BotController] Bot ${localAiBotId} spostato da ${oldLocationId} a ${locationId}`);

      res.json({ result: true, data: { locationId } });
    } catch (err: any) {
      logger.error('[BotController] changeLocation error:', err);
      res.status(500).json({ result: false, error: err.message || 'Errore interno' });
    }
  }

  /**
   * GET /admin/bots/:localAiBotId/memories/:characterId
   * Ritorna memorie del bot con un personaggio specifico.
   */
  static async characterMemories(req: Request, res: Response): Promise<void> {
    try {
      const localAiBotId = req.params.localAiBotId as string;
      const characterId = req.params.characterId as string;
      const result = await aiGatewayClient.getBotCharacterMemories(localAiBotId, characterId) as any;
      if (!result?.success) {
        res.status(502).json({ result: false, error: 'Impossibile recuperare le memorie' });
        return;
      }
      res.json({ result: true, data: result.data || [] });
    } catch (err: any) {
      logger.error('[BotController] characterMemories error:', err);
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
