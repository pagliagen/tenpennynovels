import { Request, Response } from 'express';
import { CharacterFinances, FinancialTransaction } from '../../../../packages/database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import { FinancialUtils } from '../utils/financialUtils';
import { CreditLineResetService } from '../services/CreditLineResetService';

export class FinancialController {
  /**
   * GET /game/finances/character/:characterId
   * Get character financial information
   */
  static async getCharacterFinances(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      // Check if user owns the character or is a master
      const { Character } = require('../../../../packages/database/models');
      const character = await Character.findOne({ 
        _id: characterId, 
        status: { $ne: 'DELETED' } 
      });

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

      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.gameplayRoles?.includes('amministratore') || false;

      if (!isOwner && !isMaster) {
        const response: ApiResponse = {
          success: false,
          error: 'Accesso negato',
          code: 'ACCESS_DENIED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Get character finances
      const finances = await CharacterFinances.findOne({ characterId });

      if (!finances) {
        const response: ApiResponse = {
          success: false,
          error: 'Finanze del personaggio non trovate',
          code: 'FINANCES_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: {
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
                        finances.properties.reduce((sum, prop) => sum + (prop.value || 0), 0)
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character finances error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le finanze del personaggio',
        code: 'GET_FINANCES_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/finances/transactions/:characterId
   * Get character financial transaction history
   */
  static async getTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { page = 1, limit = 20, type } = req.query;
      const userId = req.user!.userId;

      // Check access rights
      const { Character } = require('../../../../packages/database/models');
      const character = await Character.findOne({ 
        _id: characterId, 
        status: { $ne: 'DELETED' } 
      });

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

      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.gameplayRoles?.includes('amministratore') || false;

      if (!isOwner && !isMaster) {
        const response: ApiResponse = {
          success: false,
          error: 'Accesso negato',
          code: 'ACCESS_DENIED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          transactions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get transaction history error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare lo storico delle transazioni',
        code: 'GET_TRANSACTIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Parametri di trasferimento non validi',
          code: 'INVALID_TRANSFER_PARAMS',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Check if user owns the source character
      const { Character } = require('../../../../packages/database/models');
      const sourceCharacter = await Character.findOne({ 
        _id: fromCharacterId, 
        userId,
        status: { $ne: 'DELETED' } 
      });

      if (!sourceCharacter) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio sorgente non trovato o accesso negato',
          code: 'SOURCE_CHARACTER_ACCESS_DENIED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Check if target character exists
      const targetCharacter = await Character.findOne({ 
        _id: toCharacterId, 
        status: { $ne: 'DELETED' } 
      });

      if (!targetCharacter) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio destinatario non trovato',
          code: 'TARGET_CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Get finances for both characters
      const sourceFinances = await CharacterFinances.findOne({ characterId: fromCharacterId });
      let targetFinances = await CharacterFinances.findOne({ characterId: toCharacterId });

      if (!sourceFinances) {
        const response: ApiResponse = {
          success: false,
          error: 'Finanze del personaggio sorgente non trovate',
          code: 'SOURCE_FINANCES_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if source has enough money
      if (sourceFinances.cash < amount) {
        const response: ApiResponse = {
          success: false,
          error: 'Fondi insufficienti',
          code: 'INSUFFICIENT_FUNDS',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Initialize target finances if not exists
      if (!targetFinances) {
        // Get target character's social class and initialize finances
        const finanzaValue = targetCharacter.skills?.['Finanza'] || 30;
        const socialClass = await FinancialUtils.calculateSocialClass(finanzaValue);
        
        if (socialClass) {
          await FinancialUtils.initializeCharacterFinances(toCharacterId, socialClass);
          targetFinances = await CharacterFinances.findOne({ characterId: toCharacterId });
        } else {
          const response: ApiResponse = {
            success: false,
            error: 'Impossibile inizializzare le finanze del personaggio destinatario',
            code: 'TARGET_FINANCES_INIT_ERROR',
            timestamp: new Date().toISOString()
          };
          res.status(500).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          transfer: {
            fromCharacter: sourceCharacter.name,
            toCharacter: targetCharacter.name,
            amount,
            description,
            newSourceBalance: sourceFinances.cash,
            newTargetBalance: targetFinances!.cash
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Money transfer error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile trasferire denaro',
        code: 'TRANSFER_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Accesso amministrativo richiesto',
          code: 'ADMIN_ACCESS_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Validate input
      if (!characterId || !amount || amount === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Parametri di concessione non validi',
          code: 'INVALID_GRANT_PARAMS',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Get character finances
      let finances = await CharacterFinances.findOne({ characterId });

      if (!finances) {
        // Initialize finances if not exists
        const { Character } = require('../../../../packages/database/models');
        const character = await Character.findById(characterId);
        
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

        const finanzaValue = character.skills?.['Finanza'] || 30;
        const socialClass = await FinancialUtils.calculateSocialClass(finanzaValue);
        
        if (socialClass) {
          await FinancialUtils.initializeCharacterFinances(characterId, socialClass);
          finances = await CharacterFinances.findOne({ characterId });
        }
      }

      if (!finances) {
        const response: ApiResponse = {
          success: false,
          error: 'Impossibile inizializzare le finanze del personaggio',
          code: 'FINANCES_INIT_ERROR',
          timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          grant: {
            characterId,
            amount,
            description,
            newBalance: finances.cash,
            grantedBy: req.user!.userId
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Admin money grant error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile concedere denaro',
        code: 'ADMIN_GRANT_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Accesso amministratore richiesto',
          code: 'ADMIN_ACCESS_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Trigger manual reset
      const result = await CreditLineResetService.triggerManualReset();

      const response: ApiResponse = {
        success: result.success,
        data: {
          resetResult: result
        },
        timestamp: new Date().toISOString()
      };

      if (result.success) {
        res.status(200).json(response);
      } else {
        response.error = result.message;
        response.code = 'CREDIT_RESET_ERROR';
        res.status(500).json(response);
      }

    } catch (error: any) {
      const err = error as Error;
      logger.error('Admin credit reset error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile azzerare le linee di credito',
        code: 'ADMIN_CREDIT_RESET_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Accesso amministrativo richiesto',
          code: 'ADMIN_ACCESS_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          systemStatus: {
            totalCharactersWithFinances: totalFinances,
            totalTransactions,
            creditLineService: creditResetService,
            financialStats: creditLineStats[0] || {},
            socialClassDistribution,
            lastUpdated: new Date().toISOString()
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get system status error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare lo stato del sistema',
        code: 'GET_STATUS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}