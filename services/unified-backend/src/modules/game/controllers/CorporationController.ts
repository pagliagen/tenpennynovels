import { Request, Response } from 'express';
import { Character, Corporation, CorporationMembershipRequest, CorporationInvitation } from '@database/models';
import { ApiResponse } from '../types/game';
import { CorporationRole } from '@shared/types/corporation';
import { logger } from '../logger';
import { successResponse, errorResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';

export class CorporationController {
  /**
   * GET /game/corporations
   * Get all visible corporations
   */
  static async getCorporations(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const character = await (Character.findById(characterId) as any);

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

      // Get all visible corporations using correct field from Corporation model
      const corporations = await (Corporation.find({ 
        'settings.publiclyVisible': true 
      }).populate('members.characterId') as any);

      // Check which corporations character can join
      const corporationsWithEligibility = await Promise.all(
        corporations.map(async (corp: any) => {
          const eligibility = await CorporationController.checkEligibility(corp, character);
          const isMember = corp.members?.some(
            (member: any) => member.characterId?.toString() === characterId
          );

          return {
            id: corp.id,
            name: corp.name,
            description: corp.description,
            type: corp.type,
            memberCount: corp.members?.length || 0,
            treasury: corp.treasury?.balance || 0,
            isPublic: corp.settings?.publiclyVisible || false,
            isMember,
            canJoin: eligibility.canJoin,
            eligibilityReason: eligibility.reason,
            requiresApproval: corp.settings?.requireApprovalForRequests || true,
            founded: corp.createdAt
          };
        })
      );

      res.json(successResponse(
        {
          corporations: corporationsWithEligibility
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get corporations error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le corporazioni',
        'GET_CORPORATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/corporations/:corporationId
   * Get corporation details
   */
  static async getCorporation(req: Request<{ corporationId: string }>, res: Response): Promise<void> {
    try {
      const { corporationId } = req.params;
      const characterId = req.character!.characterId;

      const corporation = await (Corporation.findById(corporationId)
        .populate('members') as any);

      if (!corporation || !corporation.settings?.publiclyVisible) {
        res.status(404).json(errorResponse(
          'Corporazione non trovata',
          'CORPORATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if character is member
      const isMember = corporation.members?.some(
        (member: any) => member.characterId.toString() === characterId
      );

      // Get member role if applicable
      const memberRole = isMember 
        ? corporation.members?.find((m: any) => m.characterId.toString() === characterId)?.role
        : null;

      res.json(successResponse(
        {
          corporation: {
            id: corporation.id,
            name: corporation.name,
            description: corporation.description,
            type: corporation.type,
            isPublic: corporation.isPublic,
            requiresApproval: corporation.requiresApproval,
            treasury: corporation.treasury || 0,
            founded: corporation.createdAt,
            members: corporation.members?.map((member: any) => ({
              characterId: member.characterId,
              characterName: member.characterName,
              role: member.role,
              joinedAt: member.joinedAt,
              contributions: member.contributions || 0
            })) || [],
            memberCount: corporation.members?.length || 0,
            isMember,
            memberRole,
            // Show detailed info only to members
            detailedInfo: isMember ? {
              locations: corporation.ownedLocations || [],
              shops: corporation.ownedShops || [],
              activeProjects: corporation.activeProjects || []
            } : null
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get corporation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la corporazione',
        'GET_CORPORATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/corporations/:corporationId/join
   * Join or request to join corporation
   */
  static async joinCorporation(req: Request<{ corporationId: string }>, res: Response): Promise<void> {
    try {
      const { corporationId } = req.params;
      const { message } = req.body;
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;

      // Get character and corporation
      const [character, corporation] = await Promise.all([
        Character.findById(characterId),
        Corporation.findById(corporationId).populate('members')
      ]) as any[];

      if (!character || !corporation || !corporation.visible) {
        res.status(404).json(errorResponse(
          'Corporazione non trovata',
          'CORPORATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if already a member
      const isMember = corporation.members?.some(
        (member: any) => member.characterId.toString() === characterId
      );

      if (isMember) {
        res.status(400).json(errorResponse(
          'Sei già membro di questa corporazione',
          'ALREADY_MEMBER',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check existing invitation or request
      const existingRequest = await (CorporationInvitation.findOne({
        corporationId,
        characterId,
        status: 'pending'
      }) as any);

      if (existingRequest) {
        res.status(400).json(errorResponse(
          'Richiesta già in sospeso',
          'REQUEST_PENDING',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check eligibility
      const eligibility = await CorporationController.checkEligibility(corporation, character);
      if (!eligibility.canJoin) {
        res.status(400).json(errorResponse(
          'Non sei idoneo per unirti a questa corporazione',
          'NOT_ELIGIBLE',
          { reason: eligibility.reason },
          400,
          getRequestId(req)
        ));
        return;
      }

      if (corporation.requiresApproval) {
        // Create join request
        const request = new CorporationInvitation({
          corporationId,
          characterId,
          characterName,
          requestedBy: characterId,
          message: message || '',
          status: 'pending',
          createdAt: new Date()
        });

        await request.save();

        // TODO: Publish Redis event for admin notification
        // redis.publish('corporation:join_request', { corporationId, characterId, requestId: request.id });

        logger.info('Corporation join request created', {
          corporationId,
          characterId,
          requestId: request.id
        });

        res.status(201).json(createResponse(
          {
            request: {
              id: request.id,
              status: request.status,
              createdAt: request.createdAt
            }
          },
          'Richiesta di adesione inviata per approvazione',
          getRequestId(req)
        ));

      } else {
        // Auto-join for corporations that don't require approval
        const memberRole = corporation.roles?.find((r: any) => r.name === 'member' || r.level === 1) || corporation.roles?.[0];
        if (memberRole) {
          await CorporationController.addMember(corporation, character, memberRole);
        } else {
          logger.warn('No member role found for corporation', { corporationId });
        }

        logger.info('Character auto-joined corporation', {
          corporationId,
          characterId,
          corporationName: corporation.name
        });

        res.json(successResponse(
          {
            membership: {
              corporationId,
              corporationName: corporation.name,
              role: 'member',
              joinedAt: new Date()
            }
          },
          `Ti sei unito con successo a ${corporation.name}`,
          getRequestId(req)
        ));
      }

    } catch (error: any) {
      const err = error as Error;
      logger.error('Join corporation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile unirsi alla corporazione',
        'JOIN_CORPORATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/corporations/:corporationId/leave
   * Leave corporation
   */
  static async leaveCorporation(req: Request<{ corporationId: string }>, res: Response): Promise<void> {
    try {
      const { corporationId } = req.params;
      const characterId = req.character!.characterId;

      const corporation = await (Corporation.findById(corporationId) as any);
      if (!corporation) {
        res.status(404).json(errorResponse(
          'Corporazione non trovata',
          'CORPORATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if character is member
      const memberIndex = corporation.members?.findIndex(
        (member: any) => member.characterId.toString() === characterId
      );

      if (memberIndex === -1 || memberIndex === undefined) {
        res.status(400).json(errorResponse(
          'Non sei membro di questa corporazione',
          'NOT_MEMBER',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const member = corporation.members![memberIndex];

      // Check if leaving would leave no officers
      if (member.role === 'officer' || member.role === 'leader') {
        const remainingOfficers = corporation.members?.filter(
          (m: any) => (m.role === 'officer' || m.role === 'leader') && 
              m.characterId.toString() !== characterId
        ).length || 0;

        if (remainingOfficers === 0) {
          res.status(400).json(errorResponse(
            'Non puoi lasciare: non ci sono altri ufficiali',
            'CANNOT_LEAVE_NO_OFFICERS',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }
      }

      // Remove member
      corporation.members!.splice(memberIndex, 1);
      await corporation.save();

      // Remove from character's corporations
      const character = await (Character.findById(characterId) as any);
      if (character) {
        character.corporations = character.corporations?.filter(
          (corpId: any) => corpId.toString() !== corporationId
        ) || [];
        await character.save();
      }

      // TODO: Publish Redis event
      // redis.publish('corporation:member_left', { corporationId, characterId });

      logger.info('Character left corporation', {
        corporationId,
        characterId,
        previousRole: member.role
      });

      res.json(successResponse(
        undefined,
        `Hai lasciato ${corporation.name}`,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Leave corporation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile lasciare la corporazione',
        'LEAVE_CORPORATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/corporations/:corporationId/invitations
   * Get pending invitations/requests (officers only)
   */
  static async getInvitations(req: Request<{ corporationId: string }>, res: Response): Promise<void> {
    try {
      const { corporationId } = req.params;
      const characterId = req.character!.characterId;

      // Check if character is officer/leader
      const corporation = await (Corporation.findById(corporationId) as any);
      if (!corporation) {
        res.status(404).json(errorResponse(
          'Corporazione non trovata',
          'CORPORATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const member = corporation.members?.find(
        (m: any) => m.characterId.toString() === characterId
      );

      if (!member || (member.role !== 'officer' && member.role !== 'leader')) {
        res.status(403).json(errorResponse(
          'Permessi insufficienti',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get pending invitations
      const invitations = await (CorporationInvitation.find({
        corporationId,
        status: 'pending'
      }).sort({ createdAt: -1 }) as any);

      res.json(successResponse(
        {
          invitations: invitations.map((inv: any) => ({
            id: inv.id,
            characterId: inv.characterId,
            characterName: inv.characterName,
            message: inv.message,
            requestedBy: inv.requestedBy,
            createdAt: inv.createdAt
          }))
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get invitations error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare gli inviti',
        'GET_INVITATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PUT /game/corporations/:corporationId/invitations/:invitationId
   * Approve or reject invitation/request
   */
  static async handleInvitation(req: Request<{ corporationId: string, invitationId: string }>, res: Response): Promise<void> {
    try {
      const { corporationId, invitationId } = req.params;
      const { action, role } = req.body; // action: 'approve' | 'reject'
      const characterId = req.character!.characterId;

      // Verify corporation and permissions
      const corporation = await (Corporation.findById(corporationId) as any);
      if (!corporation) {
        res.status(404).json(errorResponse(
          'Corporazione non trovata',
          'CORPORATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const member = corporation.members?.find(
        (m: any) => m.characterId.toString() === characterId
      );

      if (!member || (member.role !== 'officer' && member.role !== 'leader')) {
        res.status(403).json(errorResponse(
          'Permessi insufficienti',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get invitation
      const invitation = await (CorporationInvitation.findOne({
        _id: invitationId,
        corporationId,
        status: 'pending'
      }) as any);

      if (!invitation) {
        res.status(404).json(errorResponse(
          'Invito non trovato',
          'INVITATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (action === 'approve') {
        // Add character to corporation
        const character = await (Character.findById(invitation.characterId) as any);
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

        const memberRole = (role as CorporationRole) || 'member';
        await CorporationController.addMember(corporation, character, memberRole);

        invitation.status = 'approved';
        invitation.approvedBy = characterId;
        invitation.approvedAt = new Date();

        logger.info('Corporation invitation approved', {
          corporationId,
          characterId: invitation.characterId,
          approvedBy: characterId,
          role: memberRole
        });

      } else if (action === 'reject') {
        invitation.status = 'rejected';
        invitation.rejectedBy = characterId;
        invitation.rejectedAt = new Date();

        logger.info('Corporation invitation rejected', {
          corporationId,
          characterId: invitation.characterId,
          rejectedBy: characterId
        });
      }

      await invitation.save();

      // TODO: Publish Redis event
      // redis.publish('corporation:invitation_handled', { 
      //   invitationId, 
      //   action, 
      //   corporationId, 
      //   characterId: invitation.characterId 
      // });

      res.json(updateResponse(
        undefined,
        `Invito ${action === 'approve' ? 'approvato' : 'respinto'} con successo`,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Handle invitation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile gestire l\'invito',
        'HANDLE_INVITATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // Helper Methods

  private static async checkEligibility(corporation: any, character: any): Promise<{ canJoin: boolean; reason?: string }> {
    // Check automatic corporation rules
    if (corporation.type === 'automatic') {
      if (corporation.requirements) {
        // Check stat requirements
        if (corporation.requirements.stats) {
          for (const [stat, minValue] of Object.entries(corporation.requirements.stats) as [string, number][]) {
            if ((character.stats[stat] || 0) < (minValue as number)) {
              return { 
                canJoin: false, 
                reason: `Requires ${stat} ${minValue}+` 
              };
            }
          }
        }

        // Check skill requirements
        if (corporation.requirements.skills) {
          for (const [skill, minValue] of Object.entries(corporation.requirements.skills) as [string, number][]) {
            if ((character.skills[skill] || 0) < (minValue as number)) {
              return { 
                canJoin: false, 
                reason: `Requires ${skill} ${minValue}+` 
              };
            }
          }
        }

        // Check occupation requirements
        if (corporation.requirements.occupations?.length > 0) {
          if (!corporation.requirements.occupations.includes(character.occupation)) {
            return { 
              canJoin: false, 
              reason: `Requires specific occupation` 
            };
          }
        }

        // Check item requirements
        if (corporation.requirements.items?.length > 0) {
          // TODO: Check character inventory for required items
          // const hasRequiredItems = await checkCharacterItems(character, corporation.requirements.items);
          // if (!hasRequiredItems) return { canJoin: false, reason: 'Missing required items' };
        }
      }
    }

    return { canJoin: true };
  }

  private static async addMember(corporation: any, character: any, role: CorporationRole): Promise<void> {
    // Add to corporation members
    const newMember = {
      characterId: character.id,
      characterName: character.name,
      role,
      joinedAt: new Date(),
      contributions: 0
    };

    corporation.members = corporation.members || [];
    corporation.members.push(newMember);
    await corporation.save();

    // Add to character's corporations
    character.corporations = character.corporations || [];
    character.corporations.push(corporation.id);
    await character.save();

    // TODO: Publish Redis event
    // redis.publish('corporation:member_added', { 
    //   corporationId: corporation.id, 
    //   characterId: character.id, 
    //   role 
    // });
  }
}