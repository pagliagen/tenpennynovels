import { Request, Response } from 'express';
import { 
  ApiResponse, 
  MoneyGrant, 
  EconomicTransaction,
  EconomicReports,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class EconomyAdminController {
  /**
   * Grant money to a character
   * POST /admin/economy/grant
   */
  static async grantMoney(req: Request, res: Response): Promise<void> {
    try {
      const grant: MoneyGrant = req.body;

      // Validate grant data
      if (!grant.characterId || grant.characterId.trim().length === 0) {
        res.status(400).json(errorResponse(
          'ID personaggio richiesto',
          'CHARACTER_ID_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!grant.amount || grant.amount <= 0) {
        res.status(400).json(errorResponse(
          'L\'importo deve essere maggiore di 0',
          'INVALID_AMOUNT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!grant.type || !['cash', 'deposit'].includes(grant.type)) {
        res.status(400).json(errorResponse(
          'Il tipo deve essere cash o deposit',
          'INVALID_GRANT_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!grant.category || !['reward', 'compensation', 'correction', 'event_prize'].includes(grant.category)) {
        res.status(400).json(errorResponse(
          'Categoria di concessione non valida',
          'INVALID_GRANT_CATEGORY',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!grant.reason || grant.reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo della concessione è richiesto',
          'GRANT_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // TODO: Implement money grant logic
      // - Validate character exists
      // - Update character's money (cash or deposit)
      // - Create transaction record
      // - Send notification to player if requested
      // - Create audit log entry
      // - Publish Redis event

      const transactionId = 'tx_' + Date.now();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Money granted by admin', {
        ...auditInfo,
        transactionId,
        characterId: grant.characterId,
        amount: grant.amount,
        type: grant.type,
        reason: grant.reason,
        approvalRequired: grant.approvalRequired,
        category: 'economy_management'
      });

      // TODO: Send Redis event
      // await redisClient.publish('economy:money_granted', {
      //   transactionId,
      //   characterId: grant.characterId,
      //   amount: grant.amount,
      //   type: grant.type,
      //   grantedBy: req.user?.userId,
      //   reason: grant.reason,
      //   timestamp: new Date().toISOString()
      // });

      res.json(createResponse(
        {
          transactionId,
          characterId: grant.characterId,
          amount: grant.amount
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error granting money:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile concedere denaro',
        'GRANT_MONEY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get transaction history with filtering
   * GET /admin/economy/transactions
   */
  static async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const characterId = req.query.characterId as string;
      const type = req.query.type as string;
      const category = req.query.category as string;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const sortBy = req.query.sortBy as string || 'timestamp';
      const sortOrder = req.query.sortOrder as string || 'desc';

      // TODO: Implement database query with filters
      const mockTransactions: EconomicTransaction[] = [
        {
          id: 'tx_1',
          type: 'admin_grant',
          amount: 50,
          amountFormatted: '£2 10s',
          character: {
            id: 'char1',
            name: 'John Smith'
          },
          grantedBy: {
            id: 'admin1',
            username: 'admin'
          },
          reason: 'Reward for excellent roleplay',
          category: 'reward',
          timestamp: '2024-01-15T14:30:00Z'
        },
        {
          id: 'tx_2',
          type: 'shop_purchase',
          amount: -25,
          amountFormatted: '£1 5s',
          character: {
            id: 'char1',
            name: 'John Smith'
          },
          reason: 'Purchased medical supplies',
          category: 'shop',
          timestamp: '2024-01-15T13:15:00Z'
        }
      ];

      const mockPagination: PaginationInfo = {
        page,
        totalPages: 1,
        totalItems: mockTransactions.length,
        pageSize: limit,
        hasNextPage: false,
        hasPrevPage: false
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed transaction history', {
        ...auditInfo,
        filters: { characterId, type, category, dateFrom, dateTo },
        page,
        limit
      });

      res.json(listResponse(
        mockTransactions,
        mockPagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching transactions:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le transazioni',
        'FETCH_TRANSACTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get comprehensive economic reports and analytics
   * GET /admin/economy/reports
   */
  static async getEconomicReports(req: Request, res: Response): Promise<void> {
    try {
      const period = req.query.period as string || '30d';

      // TODO: Implement database queries for comprehensive economic analysis
      const mockReports: EconomicReports = {
        moneySupply: {
          totalCash: 125000,
          totalDeposits: 850000,
          totalSupply: 975000,
          supplyGrowth: '+2.5%',
          avgPlayerBalance: 780,
          medianPlayerBalance: 450
        },
        transactionActivity: {
          totalTransactions: 2450,
          playerToPlayer: 890,
          shopPurchases: 1200,
          adminGrants: 180,
          corporationPayments: 180,
          averageTransactionSize: 45
        },
        itemEconomy: {
          mostTradedItems: [
            { itemId: 'item1', itemName: 'Medical Bag', transactions: 45 },
            { itemId: 'item2', itemName: 'Top Hat', transactions: 38 }
          ],
          priceInflation: [
            { itemId: 'item1', priceChange: '+5%' },
            { itemId: 'item3', priceChange: '-2%' }
          ]
        },
        corporationFinances: {
          totalTreasuryFunds: 45000,
          avgTreasuryBalance: 2250,
          corporationsInDebt: 3,
          totalMonthlyRevenue: 8500,
          totalMonthlyExpenses: 7200
        },
        alerts: [
          {
            type: 'inflation',
            item: 'Medical Supplies',
            message: 'Medical supplies showing unusual price increase (+15%)',
            severity: 'medium'
          },
          {
            type: 'corporation_debt',
            corporation: 'East London Traders',
            message: 'Corporation treasury below minimum threshold',
            severity: 'high'
          }
        ]
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed economic reports', {
        ...auditInfo,
        period
      });

      res.json(successResponse(
        mockReports,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching economic reports:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i report economici',
        'FETCH_ECONOMIC_REPORTS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Adjust money for a character (debit/credit)
   * POST /admin/economy/adjust
   */
  static async adjustMoney(req: Request, res: Response): Promise<void> {
    try {
      const { characterId, amount, type, reason, category } = req.body;

      // Validate adjustment data
      if (!characterId || characterId.trim().length === 0) {
        res.status(400).json(errorResponse(
          'ID personaggio richiesto',
          'CHARACTER_ID_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (amount === 0) {
        res.status(400).json(errorResponse(
          'L\'importo non può essere zero',
          'INVALID_AMOUNT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!type || !['cash', 'deposit'].includes(type)) {
        res.status(400).json(errorResponse(
          'Il tipo deve essere cash o deposit',
          'INVALID_ADJUSTMENT_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo dell\'adeguamento è richiesto',
          'ADJUSTMENT_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // TODO: Implement money adjustment logic
      // - Validate character exists and has sufficient funds (for negative adjustments)
      // - Update character's money
      // - Create transaction record
      // - Create audit log entry
      // - Publish Redis event

      const transactionId = 'tx_adj_' + Date.now();
      const action = amount > 0 ? 'credit' : 'debit';

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Money adjusted by admin', {
        ...auditInfo,
        transactionId,
        characterId,
        amount,
        type,
        action,
        reason,
        category: 'economy_management'
      });

      res.json(updateResponse(
        {
          transactionId,
          characterId,
          amount,
          action
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error adjusting money:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile adeguare il denaro',
        'ADJUST_MONEY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get character's financial overview
   * GET /admin/economy/character/:characterId
   */
  static async getCharacterFinances(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.params.characterId;

      // TODO: Implement database query for character financial data
      const mockFinances = {
        character: {
          id: characterId,
          name: 'John Smith',
          occupation: 'Doctor'
        },
        balance: {
          cash: 125,
          deposit: 850,
          total: 975,
          formatted: {
            cash: '£6 5s',
            deposit: '£42 10s',
            total: '£48 15s'
          }
        },
        recentTransactions: [
          {
            id: 'tx_1',
            type: 'admin_grant',
            amount: 50,
            amountFormatted: '£2 10s',
            reason: 'Reward for excellent roleplay',
            timestamp: '2024-01-15T14:30:00Z'
          }
        ],
        statistics: {
          totalEarned: 2450,
          totalSpent: 1475,
          avgDailySpending: 45,
          lastTransaction: '2024-01-15T14:30:00Z'
        },
        salaryInfo: {
          occupationSalary: 120,
          corporationSalary: 25,
          totalMonthlySalary: 145,
          nextPayment: '2024-02-01T00:00:00Z'
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed character finances', {
        ...auditInfo,
        characterId,
        characterName: mockFinances.character.name
      });

      res.json(successResponse(
        mockFinances,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching character finances:', { 
        error: error instanceof Error ? error.message : String(error), 
        characterId: req.params.characterId 
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le finanze del personaggio',
        'FETCH_CHARACTER_FINANCES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk grant money to multiple characters
   * POST /admin/economy/bulk-grant
   */
  static async bulkGrantMoney(req: Request, res: Response): Promise<void> {
    try {
      const { characterIds, amount, type, reason, category } = req.body;

      // Validate bulk grant data
      if (!Array.isArray(characterIds) || characterIds.length === 0) {
        res.status(400).json(errorResponse(
          'Array di ID personaggi richiesto',
          'CHARACTER_IDS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!amount || amount <= 0) {
        res.status(400).json(errorResponse(
          'L\'importo deve essere maggiore di 0',
          'INVALID_AMOUNT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo della concessione è richiesto',
          'GRANT_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // TODO: Implement bulk money grant
      const results = characterIds.map((id: string) => ({
        characterId: id,
        transactionId: 'tx_bulk_' + Date.now() + '_' + id,
        amount
      }));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Bulk money grant by admin', {
        ...auditInfo,
        characterIds,
        characterCount: characterIds.length,
        amount,
        type,
        reason,
        totalAmount: amount * characterIds.length,
        category: 'economy_management'
      });

      res.json(createResponse(
        {
          results,
          totalAmount: amount * characterIds.length,
          characterCount: characterIds.length
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error in bulk money grant:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile concedere denaro in blocco',
        'BULK_GRANT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get economy configuration and limits
   * GET /admin/economy/config
   */
  static async getEconomyConfig(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement config retrieval from database
      const mockConfig = {
        limits: {
          maxSingleGrant: 1000,
          maxDailyGrants: 5000,
          maxCharacterBalance: 50000,
          minCharacterBalance: -500
        },
        settings: {
          startingCash: 50,
          startingDeposit: 200,
          dailySalaryEnabled: true,
          inflationRate: 0.02,
          taxationEnabled: false
        },
        currencies: {
          baseUnit: 'pence',
          displayFormat: 'pounds_shillings_pence',
          exchangeRates: {
            poundToPence: 240,
            shillingToPence: 12
          }
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed economy configuration', auditInfo);

      res.json(successResponse(
        mockConfig,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching economy config:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la configurazione economica',
        'FETCH_ECONOMY_CONFIG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}