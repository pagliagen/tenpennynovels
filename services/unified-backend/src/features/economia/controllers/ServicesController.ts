import { Request, Response } from 'express';
import { CharacterFinances } from '../models/CharacterFinances';
import { Service } from '../models/Service';
import { logger } from '@modules/game/logger';
import { errorResponse, successResponse, getRequestId } from '@shared/utils/apiResponse';
import { removeExpiredCancelledServices } from '../services/serviceCancellationCleanup';

/**
 * A service still occupies its VC cost as long as it hasn't reached the end
 * of its already-paid-for monthly cycle (pointsFreeAt in the future, or never cancelled).
 */
function isStillCommitted(entry: { cancelledAt?: Date; pointsFreeAt?: Date }, now: Date): boolean {
  if (!entry.cancelledAt) return true;
  return !entry.pointsFreeAt || entry.pointsFreeAt > now;
}

function computeCommittedTotal(activeServices: any[], now: Date): number {
  return activeServices
    .filter((entry) => isStillCommitted(entry, now))
    .reduce((sum, entry) => sum + entry.monthlyCost, 0);
}

/**
 * End of the monthly cycle already paid for: the next multiple of one month
 * from activatedAt that is >= now.
 */
function computePointsFreeAt(activatedAt: Date, now: Date): Date {
  const freeAt = new Date(activatedAt);
  while (freeAt <= now) {
    freeAt.setMonth(freeAt.getMonth() + 1);
  }
  return freeAt;
}

export class ServicesController {
  /**
   * GET /game/economy/services
   * Catalog of continuative services, filtered by social class, enriched with
   * the character's current committed total and active subscriptions.
   */
  static async getServices(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

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

      const now = new Date();
      const services = await Service.find({ isActive: true }).lean();

      const availableServices = services.filter((service) =>
        !service.socialClassesEligible?.length ||
        service.socialClassesEligible.includes(finances.socialClass)
      );

      const committedTotal = computeCommittedTotal(finances.activeServices, now);
      const capacity = finances.financeSkillValue;

      const catalog = availableServices.map((service) => ({
        _id: service._id,
        name: service.name,
        description: service.description,
        category: service.category,
        monthlyCost: service.monthlyCost,
        canSubscribe: committedTotal + service.monthlyCost <= capacity
      }));

      res.json(successResponse(
        {
          capacity,
          committedTotal,
          available: capacity - committedTotal,
          catalog,
          activeServices: finances.activeServices.filter((entry: any) => isStillCommitted(entry, now)),
          properties: finances.properties.map((property: any, index: number) => ({
            index,
            type: property.type,
            name: property.name
          }))
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get services catalog error:', { error: err.message, stack: err.stack });
      res.status(500).json(errorResponse(
        'Impossibile recuperare il catalogo dei servizi',
        'SERVICES_CATALOG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/economy/services/:serviceId/subscribe
   * Body: { propertyIndex?: number } — required only for category 'sicurezza'
   */
  static async subscribeService(req: Request<{ serviceId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { serviceId } = req.params;
      const { propertyIndex } = req.body as { propertyIndex?: number };

      const [finances, service] = await Promise.all([
        CharacterFinances.findOne({ characterId }),
        Service.findOne({ _id: serviceId, isActive: true })
      ]);

      if (!finances) {
        res.status(404).json(errorResponse('Finanze del personaggio non trovate', 'FINANCES_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (!service) {
        res.status(404).json(errorResponse('Servizio non trovato', 'SERVICE_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      if (service.socialClassesEligible?.length && !service.socialClassesEligible.includes(finances.socialClass)) {
        res.status(403).json(errorResponse('La classe sociale del personaggio non può sottoscrivere questo servizio', 'SERVICE_CLASS_INELIGIBLE', undefined, 403, getRequestId(req)));
        return;
      }

      const now = new Date();

      if (service.category === 'sicurezza') {
        if (propertyIndex === undefined || propertyIndex === null) {
          res.status(400).json(errorResponse('propertyIndex è obbligatorio per i servizi di sicurezza', 'PROPERTY_INDEX_REQUIRED', undefined, 400, getRequestId(req)));
          return;
        }
        if (!finances.properties[propertyIndex]) {
          res.status(400).json(errorResponse('Proprietà non trovata', 'PROPERTY_NOT_FOUND', undefined, 400, getRequestId(req)));
          return;
        }
        const alreadyActive = finances.activeServices.some((entry: any) =>
          isStillCommitted(entry, now) &&
          entry.serviceId.toString() === serviceId &&
          entry.propertyIndex === propertyIndex
        );
        if (alreadyActive) {
          res.status(409).json(errorResponse('Questa misura di sicurezza è già attiva su questa abitazione', 'SERVICE_ALREADY_ACTIVE', undefined, 409, getRequestId(req)));
          return;
        }
      } else {
        const alreadyActive = finances.activeServices.some((entry: any) =>
          isStillCommitted(entry, now) && entry.serviceId.toString() === serviceId
        );
        if (alreadyActive) {
          res.status(409).json(errorResponse('Servizio già attivo', 'SERVICE_ALREADY_ACTIVE', undefined, 409, getRequestId(req)));
          return;
        }
      }

      const committedTotal = computeCommittedTotal(finances.activeServices, now);
      if (committedTotal + service.monthlyCost > finances.financeSkillValue) {
        res.status(400).json(errorResponse(
          'Valore di Credito insufficiente per sottoscrivere questo servizio',
          'INSUFFICIENT_VC',
          { required: service.monthlyCost, available: finances.financeSkillValue - committedTotal },
          400,
          getRequestId(req)
        ));
        return;
      }

      finances.activeServices.push({
        serviceId: service._id,
        category: service.category,
        monthlyCost: service.monthlyCost,
        activatedAt: now,
        ...(service.category === 'sicurezza' ? { propertyIndex } : {})
      } as any);
      await finances.save();

      res.json(successResponse({ activeServices: finances.activeServices }, undefined, getRequestId(req)));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Subscribe service error:', { error: err.message, stack: err.stack });
      res.status(500).json(errorResponse('Impossibile sottoscrivere il servizio', 'SERVICE_SUBSCRIBE_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /game/economy/services/:serviceId/unsubscribe
   * Body: { propertyIndex?: number } — required only for category 'sicurezza'
   * Marks the subscription for cancellation: points free up only at the end of
   * the already-paid-for monthly cycle, not immediately.
   */
  static async unsubscribeService(req: Request<{ serviceId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { serviceId } = req.params;
      const { propertyIndex } = req.body as { propertyIndex?: number };

      const finances = await CharacterFinances.findOne({ characterId });
      if (!finances) {
        res.status(404).json(errorResponse('Finanze del personaggio non trovate', 'FINANCES_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const now = new Date();
      const entry = finances.activeServices.find((e: any) =>
        isStillCommitted(e, now) &&
        e.serviceId.toString() === serviceId &&
        (e.category !== 'sicurezza' || e.propertyIndex === propertyIndex)
      );

      if (!entry) {
        res.status(404).json(errorResponse('Servizio attivo non trovato', 'ACTIVE_SERVICE_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }
      if (entry.cancelledAt) {
        res.status(409).json(errorResponse('Servizio già disdetto', 'SERVICE_ALREADY_CANCELLED', undefined, 409, getRequestId(req)));
        return;
      }

      entry.cancelledAt = now;
      entry.pointsFreeAt = computePointsFreeAt(entry.activatedAt, now);
      await finances.save();

      res.json(successResponse({ cancelledAt: entry.cancelledAt, pointsFreeAt: entry.pointsFreeAt }, undefined, getRequestId(req)));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Unsubscribe service error:', { error: err.message, stack: err.stack });
      res.status(500).json(errorResponse('Impossibile disdire il servizio', 'SERVICE_UNSUBSCRIBE_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /game/economy/admin/force-service-renewal
   * Manual trigger for the cancellation cleanup job (admin/testing).
   */
  static async adminForceRenewal(req: Request, res: Response): Promise<void> {
    try {
      const result = await removeExpiredCancelledServices();
      res.json(successResponse({ result }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Admin force service renewal error:', { error: err.message, stack: err.stack });
      res.status(500).json(errorResponse('Impossibile eseguire la pulizia dei servizi', 'SERVICE_CLEANUP_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
