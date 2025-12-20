import { Request, Response } from 'express';
import { BackgroundQuestion } from '../../../../packages/database/models/BackgroundQuestion';
import { Character } from '../../../../packages/database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';

export class BackgroundQuestionController {
  /**
   * GET /game/background-questions
   * Get all active background questions
   */
  static async getBackgroundQuestions(req: Request, res: Response): Promise<void> {
    try {
      const questions = await (BackgroundQuestion.find({ isActive: true }) as any)
        .sort({ order: 1 })
        .select('-createdBy -createdAt -updatedAt -__v').exec();

      const response: ApiResponse = {
        success: true,
        data: {
          questions: questions.map((q: any) => ({
            questionId: q.questionId,
            questionText: q.questionText,
            placeholder: q.placeholder,
            helpText: q.helpText,
            category: q.category,
            order: q.order,
            isRequired: q.isRequired,
            responseVisibility: q.responseVisibility,
            minLength: q.minLength,
            maxLength: q.maxLength,
            version: q.version
          })),
          totalQuestions: questions.length,
          requiredQuestions: questions.filter((q: any) => q.isRequired).length
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get background questions error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le domande di background',
        code: 'GET_BACKGROUND_QUESTIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/background-questions/category/:category
   * Get questions by category
   */
  static async getQuestionsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      
      const validCategories = ['phobias', 'traumas', 'beliefs', 'bonds', 'secrets', 'personality', 'history'];
      if (!validCategories.includes(category)) {
        const response: ApiResponse = {
          success: false,
          error: 'Categoria non valida',
          code: 'INVALID_CATEGORY',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const questions = await (BackgroundQuestion.find({ 
        category: category, 
        isActive: true 
      }) as any).sort({ order: 1 }).exec();

      const response: ApiResponse = {
        success: true,
        data: {
          category,
          questions: questions.map((q: any) => ({
            questionId: q.questionId,
            questionText: q.questionText,
            placeholder: q.placeholder,
            helpText: q.helpText,
            order: q.order,
            isRequired: q.isRequired,
            responseVisibility: q.responseVisibility,
            minLength: q.minLength,
            maxLength: q.maxLength
          }))
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get questions by category error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le domande per categoria',
        code: 'GET_QUESTIONS_BY_CATEGORY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/characters/:characterId/background-responses
   * Get character's background responses
   */
  static async getCharacterBackgroundResponses(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      
      // Determina se l'utente è un master
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.gameplayRoles?.includes('gestore') || false;

      const character = await (Character.findOne({
        _id: characterId,
        $or: [
          { userId: userId }, // Proprietario
          // TODO: aggiungere controllo per master che possono vedere tutti i personaggi
        ]
      }) as any).exec();

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Ottieni tutte le domande per determinare la visibilità
      const questions = await (BackgroundQuestion.find({ isActive: true }) as any).exec();

      // Filtra le risposte in base ai permessi
      let visibleResponses = [];
      
      if (character.userId.toString() === userId) {
        // Proprietario può vedere tutto
        visibleResponses = character.backgroundResponses;
      } else if (isMaster) {
        // Master possono vedere risposte pubbliche e master_only
        const allowedVisibilities = ['public', 'master_only'];
        const visibleQuestionIds = questions
          .filter((q: any) => allowedVisibilities.includes(q.responseVisibility))
          .map((q: any) => q.questionId);
        
        visibleResponses = character.backgroundResponses
          .filter((r: any) => visibleQuestionIds.includes(r.questionId));
      } else {
        // Altri utenti vedono solo risposte pubbliche
        const publicQuestionIds = questions
          .filter((q: any) => q.responseVisibility === 'public')
          .map((q: any) => q.questionId);
        
        visibleResponses = character.backgroundResponses
          .filter((r: any) => publicQuestionIds.includes(r.questionId));
      }

      // Arricchisci le risposte con le info delle domande
      const enrichedResponses = visibleResponses.map((response: any) => {
        const question = questions.find((q: any) => q.questionId === response.questionId);
        return {
          questionId: response.questionId,
          questionText: question?.questionText || 'Domanda non trovata',
          category: question?.category || 'unknown',
          response: response.response,
          answeredAt: response.answeredAt,
          responseVisibility: question?.responseVisibility || 'public'
        };
      });

      const response: ApiResponse = {
        success: true,
        data: {
          characterId,
          characterName: character.name,
          backgroundCompleted: character.backgroundCompleted,
          backgroundCompletedAt: character.backgroundCompletedAt,
          responses: enrichedResponses,
          totalResponses: visibleResponses.length,
          canViewAll: character.userId.toString() === userId
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character background responses error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le risposte di background del personaggio',
        code: 'GET_CHARACTER_RESPONSES_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * PUT /game/characters/:characterId/background-responses
   * Update character's background responses
   */
  static async updateBackgroundResponses(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { responses } = req.body;
      const userId = req.user!.userId;

      if (!Array.isArray(responses)) {
        const response: ApiResponse = {
          success: false,
          error: 'Le risposte devono essere un array',
          code: 'INVALID_RESPONSES_FORMAT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        status: { $in: ['DRAFT'] } // Solo personaggi editabili
      }) as any);

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato o non modificabile',
          code: 'CHARACTER_NOT_EDITABLE',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Ottieni le domande per validazione
      const questions = await (BackgroundQuestion.find({ isActive: true }) as any);
      const questionMap = new Map(questions.map((q: any) => [q.questionId, q]));

      // Valida e salva le risposte
      for (const responseData of responses as any[]) {
        const { questionId, response } = responseData;
        
        if (!questionId || !response) {
          continue; // Salta risposte incomplete
        }

        const question = questionMap.get(questionId);
        if (!question) {
          continue; // Salta domande non valide
        }

        // Valida lunghezza risposta
        if (question.minLength && response.trim().length < question.minLength) {
          const errorResponse: ApiResponse = {
            success: false,
            error: `Risposta troppo breve per la domanda ${questionId}`,
            code: 'RESPONSE_TOO_SHORT',
            details: { questionId, minLength: question.minLength },
            timestamp: new Date().toISOString()
          };
          res.status(400).json(errorResponse);
          return;
        }

        if (response.trim().length > question.maxLength) {
          const errorResponse: ApiResponse = {
            success: false,
            error: `Risposta troppo lunga per la domanda ${questionId}`,
            code: 'RESPONSE_TOO_LONG',
            details: { questionId, maxLength: question.maxLength },
            timestamp: new Date().toISOString()
          };
          res.status(400).json(errorResponse);
          return;
        }

        // Salva la risposta
        character.setBackgroundResponse(questionId, response, question.version);
      }

      // Controlla completamento
      const requiredQuestions = questions.filter((q: any) => q.isRequired).map((q: any) => q.questionId);
      const completionCheck = await character.checkBackgroundCompletion(requiredQuestions);

      await character.save();

      logger.info('Background responses updated', {
        characterId,
        userId,
        responsesCount: responses.length,
        completed: completionCheck.completed
      });

      const response: ApiResponse = {
        success: true,
        data: {
          character: {
            id: character.id,
            name: character.name,
            backgroundCompleted: character.backgroundCompleted,
            backgroundCompletedAt: character.backgroundCompletedAt,
            responsesCount: character.backgroundResponses.length
          },
          completion: completionCheck
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Update background responses error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare le risposte di background',
        code: 'UPDATE_RESPONSES_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}