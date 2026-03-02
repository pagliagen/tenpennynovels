import { Request, Response } from 'express';
import { Relationship } from '@database/models/Relationship';
import { Character } from '@database/models/Character';
import { logger } from '../utils/logger';
import { AuthUtils } from '../middleware/auth';
import { auditLogger } from '@modules/admin/utils/auditLogger';
import { gameEventPublisher } from '../services/GameEventPublisher';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';

export class RelationshipController {
  
  static async getMyRelationships(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      // Get all relationships where this character is involved
      const relationships = await Relationship.CharacterRelationship.find({
        $or: [
          { fromCharacterId: characterId },
          { toCharacterId: characterId }
        ]
      })
      .populate('fromCharacterId', 'name surname gameplayRoles')
      .populate('toCharacterId', 'name surname gameplayRoles')
      .populate('relationshipTypeId', 'name description isPublicRelationship respectabilityModifier')
      .sort({ establishedAt: -1 });

      // Format relationships for response
      const formattedRelationships = relationships.map(rel => ({
        id: rel._id,
        relationshipType: {
          id: rel.relationshipTypeId._id,
          name: rel.relationshipTypeName,
          description: rel.relationshipTypeId.description,
          isPublic: rel.relationshipTypeId.isPublicRelationship,
          respectabilityModifier: rel.relationshipTypeId.respectabilityModifier
        },
        otherCharacter: {
          id: rel.fromCharacterId._id.toString() === characterId.toString()
            ? rel.toCharacterId._id
            : rel.fromCharacterId._id,
          name: rel.fromCharacterId._id.toString() === characterId.toString()
            ? rel.toCharacterId.name
            : rel.fromCharacterId.name,
          surname: rel.fromCharacterId._id.toString() === characterId.toString()
            ? rel.toCharacterId.surname
            : rel.fromCharacterId.surname
        },
        status: rel.status,
        isInitiator: rel.fromCharacterId._id.toString() === characterId.toString(),
        establishedAt: rel.establishedAt,
        description: rel.description,
        isPublic: rel.isPublic
      }));

      logger.info('Character relationships retrieved', {
        characterId,
        relationshipsCount: formattedRelationships.length
      });

      res.json(successResponse(
        {
          relationships: formattedRelationships
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving character relationships:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getRelationshipTypes(req: Request, res: Response): Promise<void> {
    try {
      // Get all active relationship types
      const relationshipTypes = await Relationship.RelationshipType.find({
        isActive: true
      }).sort({ name: 1 });

      const formattedTypes = relationshipTypes.map(type => ({
        id: type._id,
        name: type.name,
        description: type.description,
        requiresMutualApproval: type.requiresMutualApproval,
        isExclusive: type.isExclusive,
        allowsSelfProposal: type.allowsSelfProposal,
        socialImplications: type.socialImplications,
        isPublic: type.isPublicRelationship,
        respectabilityModifier: type.respectabilityModifier,
        maxInstances: type.maxInstances,
        requiredGender: type.requiredGender,
        requiredSocialClass: type.requiredSocialClass
      }));

      res.json(successResponse(
        {
          relationshipTypes: formattedTypes
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving relationship types:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async proposeRelationship(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;
      const { targetCharacterId, relationshipTypeId, description, isPublic } = req.body;

      // Validate required fields
      if (!targetCharacterId || !relationshipTypeId) {
        res.status(400).json(errorResponse(
          'Personaggio target e tipo di relazione sono obbligatori',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check if target character exists
      const targetCharacter = await Character.findById(targetCharacterId).select('name surname gender socialClass');
      if (!targetCharacter) {
        res.status(404).json(errorResponse(
          'Personaggio target non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if trying to create relationship with self
      if (targetCharacterId === characterId.toString()) {
        res.status(400).json(errorResponse(
          'Non puoi creare una relazione con te stesso',
          'INVALID_TARGET',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get relationship type
      const relationshipType = await Relationship.RelationshipType.findById(relationshipTypeId);
      if (!relationshipType || !relationshipType.isActive) {
        res.status(404).json(errorResponse(
          'Tipo di relazione non trovato o inattivo',
          'RELATIONSHIP_TYPE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if character can propose this type
      if (!relationshipType.allowsSelfProposal) {
        res.status(403).json(errorResponse(
          'Questo tipo di relazione non può essere auto-proposto',
          'SELF_PROPOSAL_NOT_ALLOWED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Validate gender constraints if any
      if (relationshipType.requiredGender && relationshipType.requiredGender.length > 0) {
        if (!relationshipType.requiredGender.includes(targetCharacter.gender)) {
          res.status(400).json(errorResponse(
            `This relationship type requires target character to be ${relationshipType.requiredGender.join(' or ')}`,
            'GENDER_REQUIREMENT_NOT_MET',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }
      }

      // Validate social class constraints if any
      if (relationshipType.requiredSocialClass && relationshipType.requiredSocialClass.length > 0) {
        if (!relationshipType.requiredSocialClass.includes(targetCharacter.socialClass)) {
          res.status(400).json(errorResponse(
            `This relationship type requires target character to be ${relationshipType.requiredSocialClass.join(' or ')} class`,
            'SOCIAL_CLASS_REQUIREMENT_NOT_MET',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }
      }

      // Check for existing relationship between these characters
      const existingRelationship = await Relationship.CharacterRelationship.findOne({
        $or: [
          { fromCharacterId: characterId, toCharacterId: targetCharacterId },
          { fromCharacterId: targetCharacterId, toCharacterId: characterId }
        ],
        relationshipTypeId: relationshipTypeId,
        status: { $in: ['PROPOSED', 'PENDING_MUTUAL', 'ESTABLISHED'] }
      });

      if (existingRelationship) {
        res.status(409).json(errorResponse(
          'Una relazione di questo tipo esiste già tra questi personaggi',
          'RELATIONSHIP_ALREADY_EXISTS',
          undefined,
          409,
          getRequestId(req)
        ));
        return;
      }

      // Check exclusive relationship constraints
      if (relationshipType.isExclusive) {
        const existingExclusive = await Relationship.CharacterRelationship.findOne({
          $or: [
            { fromCharacterId: characterId },
            { toCharacterId: characterId }
          ],
          relationshipTypeId: relationshipTypeId,
          status: 'ESTABLISHED'
        });

        if (existingExclusive) {
          res.status(409).json(errorResponse(
            'Hai già una relazione esclusiva di questo tipo',
            'EXCLUSIVE_RELATIONSHIP_EXISTS',
            undefined,
            409,
            getRequestId(req)
          ));
          return;
        }
      }

      // Check max instances constraint
      if (relationshipType.maxInstances) {
        const currentCount = await Relationship.CharacterRelationship.countDocuments({
          $or: [
            { fromCharacterId: characterId },
            { toCharacterId: characterId }
          ],
          relationshipTypeId: relationshipTypeId,
          status: 'ESTABLISHED'
        });

        if (currentCount >= relationshipType.maxInstances) {
          res.status(409).json(errorResponse(
            `Numero massimo di relazioni ${relationshipType.name} raggiunto`,
            'MAX_INSTANCES_REACHED',
            undefined,
            409,
            getRequestId(req)
          ));
          return;
        }
      }

      // Create relationship proposal
      const newRelationship = new Relationship.CharacterRelationship({
        fromCharacterId: characterId,
        toCharacterId: targetCharacterId,
        relationshipTypeId: relationshipTypeId,
        relationshipTypeName: relationshipType.name,
        status: relationshipType.requiresMutualApproval ? 'PENDING_MUTUAL' : 'ESTABLISHED',
        fromCharacterApproved: true, // Proposer automatically approves
        toCharacterApproved: !relationshipType.requiresMutualApproval, // Auto-approve if no mutual approval needed
        description: description || '',
        isPublic: isPublic !== undefined ? isPublic : relationshipType.isPublicRelationship,
        proposedAt: new Date(),
        establishedAt: !relationshipType.requiresMutualApproval ? new Date() : undefined
      });

      await newRelationship.save();

      // Create reciprocal relationship if needed
      let reciprocalRelationship = null;
      if (relationshipType.hasReciprocalType && relationshipType.reciprocalTypeId) {
        const reciprocalType = await Relationship.RelationshipType.findById(relationshipType.reciprocalTypeId);
        if (reciprocalType) {
          reciprocalRelationship = new Relationship.CharacterRelationship({
            fromCharacterId: targetCharacterId,
            toCharacterId: characterId,
            relationshipTypeId: relationshipType.reciprocalTypeId,
            relationshipTypeName: reciprocalType.name,
            status: relationshipType.requiresMutualApproval ? 'PENDING_MUTUAL' : 'ESTABLISHED',
            fromCharacterApproved: !relationshipType.requiresMutualApproval,
            toCharacterApproved: true,
            description: description || '',
            isPublic: isPublic !== undefined ? isPublic : reciprocalType.isPublicRelationship,
            proposedAt: new Date(),
            establishedAt: !relationshipType.requiresMutualApproval ? new Date() : undefined,
            linkedRelationshipId: newRelationship._id
          });
          await reciprocalRelationship.save();
          
          // Link back to reciprocal
          newRelationship.linkedRelationshipId = reciprocalRelationship._id;
          await newRelationship.save();
        }
      }

      // Audit log
      await auditLogger.log({
        action: 'RELATIONSHIP_PROPOSED',
        actorType: 'CHARACTER',
        actorId: characterId.toString(),
        actorName: characterName,
        resourceType: 'RELATIONSHIP',
        resourceId: newRelationship._id.toString(),
        details: {
          targetCharacterId,
          relationshipType: relationshipType.name,
          requiresMutualApproval: relationshipType.requiresMutualApproval
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Publish game event for real-time notifications
      await gameEventPublisher.publishRelationshipEvent({
        type: 'RELATIONSHIP_PROPOSED',
        characterId: characterId.toString(),
        relationshipId: newRelationship._id.toString(),
        data: {
          toCharacterId: targetCharacterId,
          relationshipType: relationshipType.name,
          requiresApproval: relationshipType.requiresMutualApproval
        }
      });

      logger.info('Relationship proposed', {
        relationshipId: newRelationship._id,
        fromCharacter: characterId,
        toCharacter: targetCharacterId,
        relationshipType: relationshipType.name
      });

      res.status(201).json(createResponse(
        {
          relationship: {
            id: newRelationship._id,
            relationshipType: relationshipType.name,
            status: newRelationship.status,
            targetCharacter: {
              id: targetCharacter._id,
              name: targetCharacter.name,
              surname: targetCharacter.surname
            },
            requiresApproval: relationshipType.requiresMutualApproval,
            proposedAt: newRelationship.proposedAt
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error proposing relationship:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async respondToProposal(req: Request<{ relationshipId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;
      const { relationshipId } = req.params;
      const { action } = req.body;

      if (!action || !['accept', 'reject'].includes(action)) {
        res.status(400).json(errorResponse(
          'L\'azione deve essere "accept" o "reject"',
          'INVALID_ACTION',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find the relationship proposal
      const relationship = await Relationship.CharacterRelationship.findById(relationshipId)
        .populate('relationshipTypeId', 'name requiresMutualApproval hasReciprocalType')
        .populate('fromCharacterId', 'name surname')
        .populate('toCharacterId', 'name surname');

      if (!relationship) {
        res.status(404).json(errorResponse(
          'Proposta di relazione non trovata',
          'RELATIONSHIP_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if character is the target of the proposal
      if (relationship.toCharacterId._id.toString() !== characterId.toString()) {
        res.status(403).json(errorResponse(
          'Puoi rispondere solo alle proposte dirette a te',
          'NOT_TARGET_CHARACTER',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Check if proposal is in correct status
      if (!['PROPOSED', 'PENDING_MUTUAL'].includes(relationship.status)) {
        res.status(400).json(errorResponse(
          'Non puoi rispondere a questa proposta',
          'INVALID_STATUS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      let updatedStatus: string;
      let establishedAt: Date | undefined;

      if (action === 'accept') {
        relationship.toCharacterApproved = true;
        updatedStatus = 'ESTABLISHED';
        establishedAt = new Date();
        
        // Update linked reciprocal relationship if exists
        if (relationship.linkedRelationshipId) {
          await Relationship.CharacterRelationship.findByIdAndUpdate(
            relationship.linkedRelationshipId,
            {
              fromCharacterApproved: true,
              status: 'ESTABLISHED',
              establishedAt: establishedAt
            }
          );
        }
      } else {
        updatedStatus = 'REJECTED';
        
        // Reject linked reciprocal relationship if exists
        if (relationship.linkedRelationshipId) {
          await Relationship.CharacterRelationship.findByIdAndUpdate(
            relationship.linkedRelationshipId,
            { status: 'REJECTED' }
          );
        }
      }

      relationship.status = updatedStatus;
      if (establishedAt) relationship.establishedAt = establishedAt;
      await relationship.save();

      // Audit log
      await auditLogger.log({
        action: `RELATIONSHIP_${action.toUpperCase()}ED`,
        actorType: 'CHARACTER',
        actorId: characterId.toString(),
        actorName: characterName,
        resourceType: 'RELATIONSHIP',
        resourceId: relationship._id.toString(),
        details: {
          proposerCharacterId: relationship.fromCharacterId._id.toString(),
          relationshipType: relationship.relationshipTypeName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Publish game event
      await gameEventPublisher.publishRelationshipEvent({
        type: `RELATIONSHIP_${action.toUpperCase()}ED`,
        characterId: relationship.fromCharacterId._id.toString(),
        relationshipId: relationship._id.toString(),
        data: {
          toCharacterId: characterId.toString(),
          relationshipType: relationship.relationshipTypeName
        }
      });

      logger.info(`Relationship proposal ${action}ed`, {
        relationshipId: relationship._id,
        responder: characterId,
        proposer: relationship.fromCharacterId._id
      });

      res.json(successResponse(
        {
          relationship: {
            id: relationship._id,
            status: updatedStatus,
            relationshipType: relationship.relationshipTypeName,
            establishedAt: establishedAt
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error responding to relationship proposal:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async endRelationship(req: Request<{ relationshipId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;
      const { relationshipId } = req.params;

      const relationship = await Relationship.CharacterRelationship.findById(relationshipId)
        .populate('fromCharacterId', 'name surname')
        .populate('toCharacterId', 'name surname');

      if (!relationship) {
        res.status(404).json(errorResponse(
          'Relazione non trovata',
          'RELATIONSHIP_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if character is part of this relationship
      const isFromCharacter = relationship.fromCharacterId._id.toString() === characterId.toString();
      const isToCharacter = relationship.toCharacterId._id.toString() === characterId.toString();

      if (!isFromCharacter && !isToCharacter) {
        res.status(403).json(errorResponse(
          'Non fai parte di questa relazione',
          'NOT_PART_OF_RELATIONSHIP',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Check if relationship can be ended
      if (relationship.status !== 'ESTABLISHED') {
        res.status(400).json(errorResponse(
          'Solo le relazioni stabilite possono essere terminate',
          'INVALID_STATUS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // End the relationship
      relationship.status = 'ENDED';
      relationship.endedAt = new Date();
      relationship.endedBy = characterId;
      await relationship.save();

      // End linked reciprocal relationship if exists
      if (relationship.linkedRelationshipId) {
        await Relationship.CharacterRelationship.findByIdAndUpdate(
          relationship.linkedRelationshipId,
          {
            status: 'ENDED',
            endedAt: new Date(),
            endedBy: characterId
          }
        );
      }

      // Audit log
      await auditLogger.log({
        action: 'RELATIONSHIP_ENDED',
        actorType: 'CHARACTER',
        actorId: characterId.toString(),
        actorName: characterName,
        resourceType: 'RELATIONSHIP',
        resourceId: relationship._id.toString(),
        details: {
          otherCharacterId: isFromCharacter ? relationship.toCharacterId._id : relationship.fromCharacterId._id,
          relationshipType: relationship.relationshipTypeName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Publish game event
      await gameEventPublisher.publishRelationshipEvent({
        type: 'RELATIONSHIP_ENDED',
        characterId: relationship.fromCharacterId._id.toString(),
        relationshipId: relationship._id.toString(),
        data: {
          toCharacterId: relationship.toCharacterId._id.toString(),
          relationshipType: relationship.relationshipTypeName,
          endedBy: characterId.toString()
        }
      });

      logger.info('Relationship ended', {
        relationshipId: relationship._id,
        endedBy: characterId
      });

      res.json(successResponse(
        {
          message: 'Relationship ended successfully'
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error ending relationship:', error);
      res.status(500).json(errorResponse(
        'Internal server error',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}