import { Request, Response } from 'express';
import { CharacterFinances } from '../models/CharacterFinances';
import { FinancialUtils } from '../services/FinancialUtils';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { logger } from '@modules/admin/utils/logger';
import { errorResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';

interface UpdateFinancesBody {
  cash?: number;
  bankDeposit?: number;
  financeSkillValue?: number;
  creditLine?: {
    maxWeekly?: number;
    currentAvailable?: number;
  };
}

export class CharacterFinancesManagementController {
  /**
   * GET /admin/characters/:characterId/finances
   */
  static async getFinances(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;

      const finances = await CharacterFinances.findOne({ characterId });
      if (!finances) {
        res.status(404).json(errorResponse(
          'Finanze non trovate — il personaggio deve essere approvato',
          'FINANCES_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      res.json(updateResponse(finances, undefined, getRequestId(req)));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get character finances (admin) error:', { error: err.message, stack: err.stack });
      res.status(500).json(errorResponse(
        'Impossibile recuperare le finanze del personaggio',
        'ADMIN_GET_FINANCES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PATCH /admin/characters/:characterId/finances
   * Body: { cash?, bankDeposit?, financeSkillValue?, creditLine?: { maxWeekly?, currentAvailable? } }
   */
  static async updateFinances(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const body = req.body as UpdateFinancesBody;

      const finances = await CharacterFinances.findOne({ characterId });
      if (!finances) {
        res.status(404).json(errorResponse(
          'Finanze non trovate — il personaggio deve essere approvato',
          'FINANCES_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Validate before writing anything — no partial saves on invalid input
      if (body.cash !== undefined && body.cash < 0) {
        res.status(400).json(errorResponse('cash non può essere negativo', 'INVALID_CASH', undefined, 400, getRequestId(req)));
        return;
      }
      if (body.bankDeposit !== undefined && body.bankDeposit < 0) {
        res.status(400).json(errorResponse('bankDeposit non può essere negativo', 'INVALID_BANK_DEPOSIT', undefined, 400, getRequestId(req)));
        return;
      }
      if (body.financeSkillValue !== undefined && (body.financeSkillValue < 1 || body.financeSkillValue > 99)) {
        res.status(400).json(errorResponse('Il Valore di Credito deve essere tra 1 e 99', 'INVALID_FINANCE_SKILL', undefined, 400, getRequestId(req)));
        return;
      }

      const newMaxWeekly = body.creditLine?.maxWeekly ?? finances.creditLine.maxWeekly;
      const newCurrentAvailable = body.creditLine?.currentAvailable ?? finances.creditLine.currentAvailable;
      if (newMaxWeekly < 0 || newCurrentAvailable < 0) {
        res.status(400).json(errorResponse('I valori della rendita settimanale non possono essere negativi', 'INVALID_CREDIT_LINE', undefined, 400, getRequestId(req)));
        return;
      }
      if (newCurrentAvailable > newMaxWeekly) {
        res.status(400).json(errorResponse(
          'Il credito attualmente disponibile non può superare la rendita settimanale massima',
          'CREDIT_LINE_EXCEEDS_MAX',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Recompute socialClass from the new VC — the two fields must not drift apart,
      // since socialClass gates item/service eligibility elsewhere in the system.
      if (body.financeSkillValue !== undefined && body.financeSkillValue !== finances.financeSkillValue) {
        const result = await FinancialUtils.calculateSocialClass(body.financeSkillValue);
        if (!result) {
          res.status(400).json(errorResponse(
            'Nessuna classe sociale configurata per questo Valore di Credito',
            'NO_SOCIAL_CLASS_FOR_VC',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }
        finances.financeSkillValue = body.financeSkillValue;
        finances.socialClass = result.socialClass;
      }

      if (body.cash !== undefined) finances.cash = body.cash;
      if (body.bankDeposit !== undefined) finances.bankDeposit = body.bankDeposit;
      finances.creditLine.maxWeekly = newMaxWeekly;
      finances.creditLine.currentAvailable = newCurrentAvailable;
      finances.lastCalculated = new Date();

      await finances.save();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Character finances updated by admin', {
        ...auditInfo,
        characterId,
        cash: finances.cash,
        bankDeposit: finances.bankDeposit,
        financeSkillValue: finances.financeSkillValue,
        socialClass: finances.socialClass,
        creditLine: finances.creditLine
      });

      res.json(updateResponse(finances, undefined, getRequestId(req)));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Update character finances (admin) error:', { error: err.message, stack: err.stack });
      res.status(500).json(errorResponse(
        'Impossibile aggiornare le finanze del personaggio',
        'ADMIN_UPDATE_FINANCES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
