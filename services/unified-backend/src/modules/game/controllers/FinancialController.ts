import { Request, Response } from 'express';
import { CharacterFinances } from '@database/models';
import { logger } from '../utils/logger';
import { CreditLineResetService } from '../services/CreditLineResetService';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';

export class FinancialController {
  /**
   * GET /game/finances/character/:characterId
   * Get character financial information
   */
  static async getCharacterFinances(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      // Check if user owns the character or is a master
      const { Character } = require('../../../database/models');
      const character = await Character.findOne({ 
        _id: characterId
      });

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

      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.isGestore || false;

      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse(
          'Accesso negato',
          'ACCESS_DENIED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get character finances
      const finances = await CharacterFinances.findOne({ characterId });

      if (!finances) {
        res.status(404).json(errorResponse(
          'Finanze del personaggio non trovate',
          'FINANCES_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      res.json(successResponse(
        {
          finances: {
            characterId: finances.characterId,
            socialClass: finances.socialClass,
            cash: finances.cash,
            bankDeposit: finances.bankDeposit,
            creditLine: finances.creditLine,
            maxCreditLine: finances.maxCreditLine,
            creditResetDate: finances.creditResetDate,
            properties: finances.properties,
            totalWealth: finances.cash + finances.bankDeposit +
                        finances.properties.reduce((sum: number, prop: any) => sum + (prop.value || 0), 0)
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character finances error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le finanze del personaggio',
        'GET_FINANCES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/finances/admin/reset-credit
   * Manual credit line reset (admins only)
   */
  static async adminResetCredit(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is an admin
      const isAdmin = req.character?.isGestore || false;

      if (!isAdmin) {
        res.status(403).json(errorResponse(
          'Accesso amministratore richiesto',
          'ADMIN_ACCESS_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Trigger manual reset
      const result = await CreditLineResetService.triggerManualReset();

      if (result.success) {
        res.json(successResponse(
          {
            resetResult: result
          },
          undefined,
          getRequestId(req)
        ));
      } else {
        res.status(500).json(errorResponse(
          result.message || 'Credit reset failed',
          'CREDIT_RESET_ERROR',
          undefined,
          500,
          getRequestId(req)
        ));
      }

    } catch (error: any) {
      const err = error as Error;
      logger.error('Admin credit reset error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile azzerare le linee di credito',
        'ADMIN_CREDIT_RESET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/finances/admin/status
   * Get financial system status (admins only)
   */
  static async getSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is a master/admin
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.isGestore || false;

      if (!isMaster) {
        res.status(403).json(errorResponse(
          'Accesso amministrativo richiesto',
          'ADMIN_ACCESS_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get system statistics
      const totalFinances = await CharacterFinances.countDocuments();
      
      const creditLineStats = await CharacterFinances.aggregate([
        {
          $group: {
            _id: null,
            totalCash: { $sum: '$cash' },
            totalDeposits: { $sum: '$bankDeposit' },
            totalCreditUsed: { $sum: { $subtract: ['$maxCreditLine', '$creditLine'] } },
            avgCreditLine: { $avg: '$creditLine' }
          }
        }
      ]);

      const socialClassDistribution = await CharacterFinances.aggregate([
        {
          $group: {
            _id: '$socialClass',
            count: { $sum: 1 },
            avgCash: { $avg: '$cash' },
            avgCredit: { $avg: '$creditLine' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const creditResetService = CreditLineResetService.getStatus();

      res.json(successResponse(
        {
          systemStatus: {
            totalCharactersWithFinances: totalFinances,
            creditLineService: creditResetService,
            financialStats: creditLineStats[0] || {},
            socialClassDistribution,
            lastUpdated: new Date().toISOString()
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get system status error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare lo stato del sistema',
        'GET_STATUS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}