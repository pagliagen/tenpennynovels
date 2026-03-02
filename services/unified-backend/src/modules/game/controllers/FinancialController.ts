import { Request, Response } from 'express';
import { CharacterFinances, FinancialTransaction } from '@database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import { FinancialUtils } from '../utils/financialUtils';
import { CreditLineResetService } from '../services/CreditLineResetService';
import { successResponse, errorResponse, listResponse, createResponse, getRequestId } from '../utils/apiResponse';

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
        _id: characterId, 
        status: { $ne: 'DELETED' } 
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
                       req.character?.gameplayRoles?.includes('amministratore') || false;

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
   * GET /game/finances/transactions/:characterId
   * Get character financial transaction history
   */
  static async getTransactionHistory(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { page = 1, limit = 20, type } = req.query;
      const userId = req.user!.userId;

      // Check access rights
      const { Character } = require('../../../database/models');
      const character = await Character.findOne({ 
        _id: characterId, 
        status: { $ne: 'DELETED' } 
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
                       req.character?.gameplayRoles?.includes('amministratore') || false;

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

      // Build query
      const query: any = { characterId };
      if (type) {
        query.type = type;
      }

      // Get transactions with pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const transactions = await FinancialTransaction
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      const totalCount = await FinancialTransaction.countDocuments(query);

      res.json(listResponse(
        transactions,
        {
          page: pageNum,
          pageSize: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get transaction history error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare lo storico delle transazioni',
        'GET_TRANSACTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/finances/transfer
   * Transfer money between characters
   */
  static async transferMoney(req: Request, res: Response): Promise<void> {
    try {
      const { fromCharacterId, toCharacterId, amount, description } = req.body;
      const userId = req.user!.userId;

      // Validate input
      if (!fromCharacterId || !toCharacterId || !amount || amount <= 0) {
        res.status(400).json(errorResponse(
          'Parametri di trasferimento non validi',
          'INVALID_TRANSFER_PARAMS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check if user owns the source character
      const { Character } = require('../../../database/models');
      const sourceCharacter = await Character.findOne({ 
        _id: fromCharacterId, 
        userId,
        status: { $ne: 'DELETED' } 
      });

      if (!sourceCharacter) {
        res.status(403).json(errorResponse(
          'Personaggio sorgente non trovato o accesso negato',
          'SOURCE_CHARACTER_ACCESS_DENIED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Check if target character exists
      const targetCharacter = await Character.findOne({ 
        _id: toCharacterId, 
        status: { $ne: 'DELETED' } 
      });

      if (!targetCharacter) {
        res.status(404).json(errorResponse(
          'Personaggio destinatario non trovato',
          'TARGET_CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get finances for both characters
      const sourceFinances = await CharacterFinances.findOne({ characterId: fromCharacterId });
      let targetFinances = await CharacterFinances.findOne({ characterId: toCharacterId });

      if (!sourceFinances) {
        res.status(404).json(errorResponse(
          'Finanze del personaggio sorgente non trovate',
          'SOURCE_FINANCES_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if source has enough money
      if (sourceFinances.cash < amount) {
        res.status(400).json(errorResponse(
          'Fondi insufficienti',
          'INSUFFICIENT_FUNDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Initialize target finances if not exists
      if (!targetFinances) {
        // Get target character's social class and initialize finances
        const finanzaValue = targetCharacter.skills?.['Finanza'] || 30;
        const socialClass = await FinancialUtils.calculateSocialClass(finanzaValue);
        
        if (socialClass) {
          await FinancialUtils.initializeCharacterFinances(toCharacterId, socialClass.config);
          targetFinances = await CharacterFinances.findOne({ characterId: toCharacterId });
        } else {
          res.status(500).json(errorResponse(
            'Impossibile inizializzare le finanze del personaggio destinatario',
            'TARGET_FINANCES_INIT_ERROR',
            undefined,
            500,
            getRequestId(req)
          ));
          return;
        }
      }

      // Perform the transfer
      sourceFinances.cash -= amount;
      targetFinances!.cash += amount;

      await sourceFinances.save();
      await targetFinances!.save();

      // Log transactions
      await FinancialUtils.logTransaction(
        fromCharacterId,
        'transfer_out',
        -amount,
        `Transfer to ${targetCharacter.name}: ${description || 'Money transfer'}`
      );

      await FinancialUtils.logTransaction(
        toCharacterId,
        'transfer_in',
        amount,
        `Transfer from ${sourceCharacter.name}: ${description || 'Money transfer'}`
      );

      logger.info('Money transfer completed', {
        fromCharacterId,
        toCharacterId,
        amount,
        description
      });

      res.json(successResponse(
        {
          transfer: {
            fromCharacter: sourceCharacter.name,
            toCharacter: targetCharacter.name,
            amount,
            description,
            newSourceBalance: sourceFinances.cash,
            newTargetBalance: targetFinances!.cash
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Money transfer error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile trasferire denaro',
        'TRANSFER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/finances/admin/grant
   * Administrative money grant (masters/admins only)
   */
  static async adminMoneyGrant(req: Request, res: Response): Promise<void> {
    try {
      const { characterId, amount, description } = req.body;
      
      // Check if user is a master/admin
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.gameplayRoles?.includes('amministratore') || false;

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

      // Validate input
      if (!characterId || !amount || amount === 0) {
        res.status(400).json(errorResponse(
          'Parametri di concessione non validi',
          'INVALID_GRANT_PARAMS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get character finances
      let finances = await CharacterFinances.findOne({ characterId });

      if (!finances) {
        // Initialize finances if not exists
        const { Character } = require('../../../database/models');
        const character = await Character.findById(characterId);
        
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

        const finanzaValue = character.skills?.['Finanza'] || 30;
        const socialClass = await FinancialUtils.calculateSocialClass(finanzaValue);
        
        if (socialClass) {
          await FinancialUtils.initializeCharacterFinances(characterId, socialClass.config);
          finances = await CharacterFinances.findOne({ characterId });
        }
      }

      if (!finances) {
        res.status(500).json(errorResponse(
          'Impossibile inizializzare le finanze del personaggio',
          'FINANCES_INIT_ERROR',
          undefined,
          500,
          getRequestId(req)
        ));
        return;
      }

      // Apply the grant
      finances.cash += amount;
      await finances.save();

      // Log the transaction
      await FinancialUtils.logTransaction(
        characterId,
        'admin_grant',
        amount,
        `Admin grant by ${req.user!.userId}: ${description || 'Administrative money grant'}`
      );

      logger.info('Admin money grant applied', {
        characterId,
        amount,
        description,
        grantedBy: req.user!.userId
      });

      res.json(successResponse(
        {
          grant: {
            characterId,
            amount,
            description,
            newBalance: finances.cash,
            grantedBy: req.user!.userId
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Admin money grant error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile concedere denaro',
        'ADMIN_GRANT_ERROR',
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
      const isAdmin = req.character?.gameplayRoles?.includes('amministratore') || false;

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
                       req.character?.gameplayRoles?.includes('amministratore') || false;

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
      const totalTransactions = await FinancialTransaction.countDocuments();
      
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
            totalTransactions,
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