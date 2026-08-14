import { Request, Response } from 'express';
import { Character } from '@core/character/models/Character';
import { CharacterDiaryEntry } from '@database/models/CharacterDiaryEntry';
import { CharacterEncounterNote } from '@database/models/CharacterEncounterNote';
import { GamingSession } from '@database/models/GamingSession';
import { Chat } from '@core/chat/models/Chat';
import { logger } from '../logger';
import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';

async function resolveViewer(characterId: string, userId: string) {
  const character = await Character.findById(characterId);
  if (!character) return { character: null, isOwner: false, isMaster: false };
  const isOwner = character.userId.toString() === userId;
  return { character, isOwner, isMaster: false };
}

export class CharacterDiaryController {
  // ---------------------------------------------------------------------
  // Diario classico
  // ---------------------------------------------------------------------

  static async listDiaryEntries(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const entries = await CharacterDiaryEntry.find({ characterId }).sort({ entryDate: -1 }).lean();
      res.json(successResponse({ entries }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error listing diary entries:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async createDiaryEntry(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      const { title, content, entryDate } = req.body || {};

      if (!title?.trim() || !content?.trim()) {
        res.status(400).json(errorResponse('Titolo e contenuto sono obbligatori', 'MISSING_FIELDS', undefined, 400, getRequestId(req)));
        return;
      }

      const { character, isOwner } = await resolveViewer(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può scrivere nel proprio diario', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const entry = await CharacterDiaryEntry.create({
        characterId,
        title: title.trim(),
        content: content.trim(),
        entryDate: entryDate ? new Date(entryDate) : new Date()
      });

      res.status(201).json(successResponse({ entry }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error creating diary entry:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async updateDiaryEntry(req: Request<{ characterId: string; entryId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, entryId } = req.params;
      const userId = req.user!.userId;
      const { title, content, entryDate } = req.body || {};

      const { character, isOwner } = await resolveViewer(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può modificare il proprio diario', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const entry = await CharacterDiaryEntry.findOne({ _id: entryId, characterId });
      if (!entry) {
        res.status(404).json(errorResponse('Voce di diario non trovata', 'DIARY_ENTRY_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      if (title !== undefined) entry.title = String(title).trim();
      if (content !== undefined) entry.content = String(content).trim();
      if (entryDate !== undefined) entry.entryDate = new Date(entryDate);
      await entry.save();

      res.json(successResponse({ entry }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error updating diary entry:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async deleteDiaryEntry(req: Request<{ characterId: string; entryId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, entryId } = req.params;
      const userId = req.user!.userId;
      const { character, isOwner } = await resolveViewer(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può eliminare voci dal proprio diario', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }
      await CharacterDiaryEntry.deleteOne({ _id: entryId, characterId });
      res.json(successResponse({ deleted: true }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error deleting diary entry:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  // ---------------------------------------------------------------------
  // Personaggi incontrati
  // ---------------------------------------------------------------------

  static async listEncounters(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const encounters = await CharacterEncounterNote.find({ ownerCharacterId: characterId }).sort({ updatedAt: -1 }).lean();
      res.json(successResponse({ encounters }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error listing encounters:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async createEncounter(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      const { targetCharacterId, targetName, notes } = req.body || {};

      if (!targetName?.trim() || !notes?.trim()) {
        res.status(400).json(errorResponse('Nome del personaggio e note sono obbligatori', 'MISSING_FIELDS', undefined, 400, getRequestId(req)));
        return;
      }

      const { character, isOwner } = await resolveViewer(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può annotare i personaggi incontrati', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const encounter = await CharacterEncounterNote.create({
        ownerCharacterId: characterId,
        targetCharacterId: targetCharacterId || undefined,
        targetName: targetName.trim(),
        notes: notes.trim()
      });

      res.status(201).json(successResponse({ encounter }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error creating encounter note:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async updateEncounter(req: Request<{ characterId: string; encounterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, encounterId } = req.params;
      const userId = req.user!.userId;
      const { notes, targetName } = req.body || {};

      const { character, isOwner } = await resolveViewer(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può modificare le note', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const encounter = await CharacterEncounterNote.findOne({ _id: encounterId, ownerCharacterId: characterId });
      if (!encounter) {
        res.status(404).json(errorResponse('Nota non trovata', 'ENCOUNTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (notes !== undefined) encounter.notes = String(notes).trim();
      if (targetName !== undefined) encounter.targetName = String(targetName).trim();
      await encounter.save();

      res.json(successResponse({ encounter }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error updating encounter note:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async deleteEncounter(req: Request<{ characterId: string; encounterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, encounterId } = req.params;
      const userId = req.user!.userId;
      const { character, isOwner } = await resolveViewer(characterId, userId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!isOwner) {
        res.status(403).json(errorResponse('Solo il proprietario può eliminare le note', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }
      await CharacterEncounterNote.deleteOne({ _id: encounterId, ownerCharacterId: characterId });
      res.json(successResponse({ deleted: true }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error deleting encounter note:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  // ---------------------------------------------------------------------
  // Role (sessioni di gioco a cui il personaggio ha partecipato)
  // ---------------------------------------------------------------------

  static async listSessions(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      // Le Auto-Session (create da Location.getOrCreateSession per la sola
      // chat "standard") non compaiono più qui: sostituite da ChatScene,
      // esposte separatamente via /characters/:characterId/chat-scenes.
      const sessions = await GamingSession.find({
        'participants.characterId': characterId,
        isAutoGenerated: { $ne: true }
      })
        .sort({ sessionDate: -1 })
        .limit(50)
        .select('title sessionType primaryLocation sessionDate startTime endTime status summary')
        .lean();

      res.json(successResponse({ sessions }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error listing character sessions:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * GET /characters/:characterId/sessions/:sessionId/transcript
   * "Scarica giocata": restituisce i messaggi visti da questo personaggio nella sessione.
   * Riusa Chat.getLocationHistory (stessa fonte usata dal pannello master per il log permanente).
   */
  static async downloadTranscript(req: Request<{ characterId: string; sessionId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, sessionId } = req.params;
      const userId = req.user!.userId;
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const session = await GamingSession.findById(sessionId).lean();
      if (!session) {
        res.status(404).json(errorResponse('Sessione non trovata', 'SESSION_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const messages = await (Chat as any).getLocationHistory(
        session.primaryLocation.toString(),
        characterId,
        2000,
        sessionId,
        isMaster
      );

      const chronological = [...messages].reverse();
      const transcript = chronological
        .map((m: any) => `[${new Date(m.timestamp).toLocaleString('it-IT')}] ${m.characterName}: ${m.content}`)
        .join('\n');

      res.json(successResponse({
        sessionTitle: session.title,
        sessionDate: session.sessionDate,
        messageCount: chronological.length,
        transcript
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error building session transcript:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
