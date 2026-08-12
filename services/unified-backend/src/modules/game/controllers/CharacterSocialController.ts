import { Request, Response } from 'express';
import { Character, Corporation } from '@database/models';
import { logger } from '../logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';


/**
 * CharacterCorporationsController
 *
 * ✅ SPRINT 2 REFACTORING: Extracted from CharacterController god object (1964 lines)
 *
 * Handles character-corporation relationship endpoints.
 */
export class CharacterSocialController {
  /**
   * GET /characters/:characterId/corporations
   * Get corporations associated with a character
   */
  static async getCharacterCorporations(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      // Verify character exists and belongs to user
      const character = await Character.findOne({
        _id: characterId,
        userId: userId
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

      // Find corporations where this character is a member
      const corporations = await Corporation.find({
        'members.characterId': characterId
      }).select('name description type membershipType isRecruiting members');

      // Extract character's membership info for each corporation
      const characterCorporations = corporations.map(corp => {
        const membership = corp.members.find(
          (member: any) => member.characterId.toString() === characterId
        );

        return {
          _id: corp._id,
          name: corp.name,
          description: corp.description,
          type: corp.type,
          membership: {
            roleId: membership?.roleId,
            joinedAt: membership?.joinedAt,
            membershipType: membership?.membershipType,
            isActive: membership?.isActive
          }
        };
      });

      res.json(successResponse(
        {
          characterId,
          characterName: character.name,
          corporations: characterCorporations
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character corporations error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare le corporazioni del personaggio',
        'GET_CHARACTER_CORPORATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
