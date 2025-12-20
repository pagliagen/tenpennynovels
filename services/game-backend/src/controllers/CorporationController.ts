import { Request, Response } from 'express';
import { Character, Corporation, CorporationMembershipRequest, CorporationInvitation } from '../../../../packages/database/models';
import { ApiResponse, CorporationType, CorporationRole } from '../types/game';
import { logger } from '../utils/logger';

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
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          corporations: corporationsWithEligibility
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get corporations error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le corporazioni',
        code: 'GET_CORPORATIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/corporations/:corporationId
   * Get corporation details
   */
  static async getCorporation(req: Request, res: Response): Promise<void> {
    try {
      const { corporationId } = req.params;
      const characterId = req.character!.characterId;

      const corporation = await (Corporation.findById(corporationId)
        .populate('members') as any);

      if (!corporation || !corporation.settings?.publiclyVisible) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
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
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get corporation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare la corporazione',
        code: 'GET_CORPORATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /game/corporations/:corporationId/join
   * Join or request to join corporation
   */
  static async joinCorporation(req: Request, res: Response): Promise<void> {
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
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if already a member
      const isMember = corporation.members?.some(
        (member: any) => member.characterId.toString() === characterId
      );

      if (isMember) {
        const response: ApiResponse = {
          success: false,
          error: 'Sei già membro di questa corporazione',
          code: 'ALREADY_MEMBER',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Check existing invitation or request
      const existingRequest = await (CorporationInvitation.findOne({
        corporationId,
        characterId,
        status: 'pending'
      }) as any);

      if (existingRequest) {
        const response: ApiResponse = {
          success: false,
          error: 'Richiesta già in sospeso',
          code: 'REQUEST_PENDING',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Check eligibility
      const eligibility = await CorporationController.checkEligibility(corporation, character);
      if (!eligibility.canJoin) {
        const response: ApiResponse = {
          success: false,
          error: 'Non sei idoneo per unirti a questa corporazione',
          code: 'NOT_ELIGIBLE',
          details: { reason: eligibility.reason },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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

        const response: ApiResponse = {
          success: true,
          message: 'Richiesta di adesione inviata per approvazione',
          data: {
            request: {
              id: request.id,
              status: request.status,
              createdAt: request.createdAt
            }
          },
          timestamp: new Date().toISOString()
        };

        res.status(201).json(response);

      } else {
        // Auto-join for corporations that don't require approval
        await CorporationController.addMember(corporation, character, 'member');

        logger.info('Character auto-joined corporation', {
          corporationId,
          characterId,
          corporationName: corporation.name
        });

        const response: ApiResponse = {
          success: true,
          message: `Ti sei unito con successo a ${corporation.name}`,
          data: {
            membership: {
              corporationId,
              corporationName: corporation.name,
              role: 'member',
              joinedAt: new Date()
            }
          },
          timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
      }

    } catch (error: any) {
      const err = error as Error;
      logger.error('Join corporation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile unirsi alla corporazione',
        code: 'JOIN_CORPORATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /game/corporations/:corporationId/leave
   * Leave corporation
   */
  static async leaveCorporation(req: Request, res: Response): Promise<void> {
    try {
      const { corporationId } = req.params;
      const characterId = req.character!.characterId;

      const corporation = await (Corporation.findById(corporationId) as any);
      if (!corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if character is member
      const memberIndex = corporation.members?.findIndex(
        (member: any) => member.characterId.toString() === characterId
      );

      if (memberIndex === -1 || memberIndex === undefined) {
        const response: ApiResponse = {
          success: false,
          error: 'Non sei membro di questa corporazione',
          code: 'NOT_MEMBER',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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
          const response: ApiResponse = {
            success: false,
            error: 'Non puoi lasciare: non ci sono altri ufficiali',
            code: 'CANNOT_LEAVE_NO_OFFICERS',
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
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

      const response: ApiResponse = {
        success: true,
        message: `Hai lasciato ${corporation.name}`,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Leave corporation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile lasciare la corporazione',
        code: 'LEAVE_CORPORATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/corporations/:corporationId/invitations
   * Get pending invitations/requests (officers only)
   */
  static async getInvitations(req: Request, res: Response): Promise<void> {
    try {
      const { corporationId } = req.params;
      const characterId = req.character!.characterId;

      // Check if character is officer/leader
      const corporation = await (Corporation.findById(corporationId) as any);
      if (!corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const member = corporation.members?.find(
        (m: any) => m.characterId.toString() === characterId
      );

      if (!member || (member.role !== 'officer' && member.role !== 'leader')) {
        const response: ApiResponse = {
          success: false,
          error: 'Permessi insufficienti',
          code: 'INSUFFICIENT_PERMISSIONS',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Get pending invitations
      const invitations = await (CorporationInvitation.find({
        corporationId,
        status: 'pending'
      }).sort({ createdAt: -1 }) as any);

      const response: ApiResponse = {
        success: true,
        data: {
          invitations: invitations.map((inv: any) => ({
            id: inv.id,
            characterId: inv.characterId,
            characterName: inv.characterName,
            message: inv.message,
            requestedBy: inv.requestedBy,
            createdAt: inv.createdAt
          }))
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get invitations error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare gli inviti',
        code: 'GET_INVITATIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * PUT /game/corporations/:corporationId/invitations/:invitationId
   * Approve or reject invitation/request
   */
  static async handleInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { corporationId, invitationId } = req.params;
      const { action, role } = req.body; // action: 'approve' | 'reject'
      const characterId = req.character!.characterId;

      // Verify corporation and permissions
      const corporation = await (Corporation.findById(corporationId) as any);
      if (!corporation) {
        const response: ApiResponse = {
          success: false,
          error: 'Corporazione non trovata',
          code: 'CORPORATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const member = corporation.members?.find(
        (m: any) => m.characterId.toString() === characterId
      );

      if (!member || (member.role !== 'officer' && member.role !== 'leader')) {
        const response: ApiResponse = {
          success: false,
          error: 'Permessi insufficienti',
          code: 'INSUFFICIENT_PERMISSIONS',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Get invitation
      const invitation = await (CorporationInvitation.findOne({
        _id: invitationId,
        corporationId,
        status: 'pending'
      }) as any);

      if (!invitation) {
        const response: ApiResponse = {
          success: false,
          error: 'Invito non trovato',
          code: 'INVITATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      if (action === 'approve') {
        // Add character to corporation
        const character = await (Character.findById(invitation.characterId) as any);
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

      const response: ApiResponse = {
        success: true,
        message: `Invito ${action === 'approve' ? 'approvato' : 'respinto'} con successo`,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Handle invitation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile gestire l\'invito',
        code: 'HANDLE_INVITATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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