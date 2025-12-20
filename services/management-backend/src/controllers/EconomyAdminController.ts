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
        const response: ApiResponse = {
          success: false,
          error: 'ID personaggio richiesto',
          code: 'CHARACTER_ID_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!grant.amount || grant.amount <= 0) {
        const response: ApiResponse = {
          success: false,
          error: 'L\'importo deve essere maggiore di 0',
          code: 'INVALID_AMOUNT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!grant.type || !['cash', 'deposit'].includes(grant.type)) {
        const response: ApiResponse = {
          success: false,
          error: 'Il tipo deve essere cash o deposit',
          code: 'INVALID_GRANT_TYPE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!grant.category || !['reward', 'compensation', 'correction', 'event_prize'].includes(grant.category)) {
        const response: ApiResponse = {
          success: false,
          error: 'Categoria di concessione non valida',
          code: 'INVALID_GRANT_CATEGORY',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!grant.reason || grant.reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo della concessione è richiesto',
          code: 'GRANT_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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

      const response: ApiResponse<{ transactionId: string; characterId: string; amount: number }> = {
        success: true,
        data: {
          transactionId,
          characterId: grant.characterId,
          amount: grant.amount
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error granting money:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile concedere denaro',
        code: 'GRANT_MONEY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        currentPage: page,
        totalPages: 1,
        totalItems: mockTransactions.length,
        limit,
        hasMore: false
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed transaction history', {
        ...auditInfo,
        filters: { characterId, type, category, dateFrom, dateTo },
        page,
        limit
      });

      const response: ApiResponse<{ transactions: EconomicTransaction[]; pagination: PaginationInfo }> = {
        success: true,
        data: {
          transactions: mockTransactions,
          pagination: mockPagination
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching transactions:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le transazioni',
        code: 'FETCH_TRANSACTIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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

      const response: ApiResponse<EconomicReports> = {
        success: true,
        data: mockReports,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching economic reports:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i report economici',
        code: 'FETCH_ECONOMIC_REPORTS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'ID personaggio richiesto',
          code: 'CHARACTER_ID_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (amount === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'L\'importo non può essere zero',
          code: 'INVALID_AMOUNT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!type || !['cash', 'deposit'].includes(type)) {
        const response: ApiResponse = {
          success: false,
          error: 'Il tipo deve essere cash o deposit',
          code: 'INVALID_ADJUSTMENT_TYPE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'adeguamento è richiesto',
          code: 'ADJUSTMENT_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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

      const response: ApiResponse<{ transactionId: string; characterId: string; amount: number; action: string }> = {
        success: true,
        data: {
          transactionId,
          characterId,
          amount,
          action
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error adjusting money:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile adeguare il denaro',
        code: 'ADJUST_MONEY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get character's financial overview
   * GET /admin/economy/character/:characterId
   */
  static async getCharacterFinances(req: Request, res: Response): Promise<void> {
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

      const response: ApiResponse<any> = {
        success: true,
        data: mockFinances,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching character finances:', { 
        error: error instanceof Error ? error.message : String(error), 
        characterId: req.params.characterId 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le finanze del personaggio',
        code: 'FETCH_CHARACTER_FINANCES_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Array di ID personaggi richiesto',
          code: 'CHARACTER_IDS_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!amount || amount <= 0) {
        const response: ApiResponse = {
          success: false,
          error: 'L\'importo deve essere maggiore di 0',
          code: 'INVALID_AMOUNT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo della concessione è richiesto',
          code: 'GRANT_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // TODO: Implement bulk money grant
      const results = characterIds.map((id: string) => ({
        characterId: id,
        transactionId: 'tx_bulk_' + Date.now() + '_' + id,
        success: true,
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

      const response: ApiResponse<{ results: any[]; totalAmount: number; characterCount: number }> = {
        success: true,
        data: {
          results,
          totalAmount: amount * characterIds.length,
          characterCount: characterIds.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error in bulk money grant:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile concedere denaro in blocco',
        code: 'BULK_GRANT_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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

      const response: ApiResponse<any> = {
        success: true,
        data: mockConfig,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching economy config:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare la configurazione economica',
        code: 'FETCH_ECONOMY_CONFIG_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}