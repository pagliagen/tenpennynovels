import { Request, Response } from 'express';
import { BackgroundQuestion } from '../../../database/models/BackgroundQuestion';
import { Character } from '../../../database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, updateResponse, getRequestId } from '../utils/apiResponse';

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

      res.json(successResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get background questions error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le domande di background',
        'GET_BACKGROUND_QUESTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(400).json(errorResponse(
          'Categoria non valida',
          'INVALID_CATEGORY',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const questions = await (BackgroundQuestion.find({ 
        category: category, 
        isActive: true 
      }) as any).sort({ order: 1 }).exec();

      res.json(successResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get questions by category error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le domande per categoria',
        'GET_QUESTIONS_BY_CATEGORY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
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

      res.json(successResponse(
        {
          characterId,
          characterName: character.name,
          backgroundCompleted: character.backgroundCompleted,
          backgroundCompletedAt: character.backgroundCompletedAt,
          responses: enrichedResponses,
          totalResponses: visibleResponses.length,
          canViewAll: character.userId.toString() === userId
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character background responses error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le risposte di background del personaggio',
        'GET_CHARACTER_RESPONSES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(400).json(errorResponse(
          'Le risposte devono essere un array',
          'INVALID_RESPONSES_FORMAT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        status: { $in: ['DRAFT'] } // Solo personaggi editabili
      }) as any);

      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato o non modificabile',
          'CHARACTER_NOT_EDITABLE',
          undefined,
          404,
          getRequestId(req)
        ));
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
          res.status(400).json(errorResponse(
            `Risposta troppo breve per la domanda ${questionId}`,
            'RESPONSE_TOO_SHORT',
            { questionId, minLength: question.minLength },
            400,
            getRequestId(req)
          ));
          return;
        }

        if (response.trim().length > question.maxLength) {
          res.status(400).json(errorResponse(
            `Risposta troppo lunga per la domanda ${questionId}`,
            'RESPONSE_TOO_LONG',
            { questionId, maxLength: question.maxLength },
            400,
            getRequestId(req)
          ));
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

      res.json(updateResponse(
        {
          character: {
            id: character.id,
            name: character.name,
            backgroundCompleted: character.backgroundCompleted,
            backgroundCompletedAt: character.backgroundCompletedAt,
            responsesCount: character.backgroundResponses.length
          },
          completion: completionCheck
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Update background responses error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare le risposte di background',
        'UPDATE_RESPONSES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}