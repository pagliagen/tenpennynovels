import { Request, Response } from 'express';
import { Relationship } from '../../../../packages/database/models/Relationship';
import { Character } from '../../../../packages/database/models/Character';
import { logger } from '../utils/logger';
import { AuthUtils } from '../utils/auth';
import { auditLogger } from '../utils/auditLogger';
import { gameEventPublisher } from '../services/GameEventPublisher';

export class RelationshipController {
  
  static async getMyRelationships(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;

      // Get all relationships where this character is involved
      const relationships = await Relationship.CharacterRelationship.find({
        $or: [
          { fromCharacterId: character._id },
          { toCharacterId: character._id }
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
          id: rel.fromCharacterId._id.toString() === character._id.toString() 
            ? rel.toCharacterId._id 
            : rel.fromCharacterId._id,
          name: rel.fromCharacterId._id.toString() === character._id.toString() 
            ? rel.toCharacterId.name 
            : rel.fromCharacterId.name,
          surname: rel.fromCharacterId._id.toString() === character._id.toString() 
            ? rel.toCharacterId.surname 
            : rel.fromCharacterId.surname
        },
        status: rel.status,
        isInitiator: rel.fromCharacterId._id.toString() === character._id.toString(),
        establishedAt: rel.establishedAt,
        description: rel.description,
        isPublic: rel.isPublic
      }));

      logger.info('Character relationships retrieved', {
        characterId: character._id,
        relationshipsCount: formattedRelationships.length
      });

      res.json({
        success: true,
        data: {
          relationships: formattedRelationships
        }
      });

    } catch (error: any) {
      logger.error('Error retrieving character relationships:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  static async getRelationshipTypes(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

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

      res.json({
        success: true,
        data: {
          relationshipTypes: formattedTypes
        }
      });

    } catch (error: any) {
      logger.error('Error retrieving relationship types:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  static async proposeRelationship(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;
      const { targetCharacterId, relationshipTypeId, description, isPublic } = req.body;

      // Validate required fields
      if (!targetCharacterId || !relationshipTypeId) {
        res.status(400).json({
          success: false,
          error: 'Personaggio target e tipo di relazione sono obbligatori'
        });
        return;
      }

      // Check if target character exists
      const targetCharacter = await Character.findById(targetCharacterId).select('name surname gender socialClass');
      if (!targetCharacter) {
        res.status(404).json({
          success: false,
          error: 'Personaggio target non trovato'
        });
        return;
      }

      // Check if trying to create relationship with self
      if (targetCharacterId === character._id.toString()) {
        res.status(400).json({
          success: false,
          error: 'Non puoi creare una relazione con te stesso'
        });
        return;
      }

      // Get relationship type
      const relationshipType = await Relationship.RelationshipType.findById(relationshipTypeId);
      if (!relationshipType || !relationshipType.isActive) {
        res.status(404).json({
          success: false,
          error: 'Tipo di relazione non trovato o inattivo'
        });
        return;
      }

      // Check if character can propose this type
      if (!relationshipType.allowsSelfProposal) {
        res.status(403).json({
          success: false,
          error: 'Questo tipo di relazione non può essere auto-proposto'
        });
        return;
      }

      // Validate gender constraints if any
      if (relationshipType.requiredGender && relationshipType.requiredGender.length > 0) {
        if (!relationshipType.requiredGender.includes(targetCharacter.gender)) {
          res.status(400).json({
            success: false,
            error: `This relationship type requires target character to be ${relationshipType.requiredGender.join(' or ')}`
          });
          return;
        }
      }

      // Validate social class constraints if any
      if (relationshipType.requiredSocialClass && relationshipType.requiredSocialClass.length > 0) {
        const targetSocialClass = AuthUtils.determineSocialClass(targetCharacter);
        if (!relationshipType.requiredSocialClass.includes(targetSocialClass)) {
          res.status(400).json({
            success: false,
            error: `This relationship type requires target character to be ${relationshipType.requiredSocialClass.join(' or ')} class`
          });
          return;
        }
      }

      // Check for existing relationship between these characters
      const existingRelationship = await Relationship.CharacterRelationship.findOne({
        $or: [
          { fromCharacterId: character._id, toCharacterId: targetCharacterId },
          { fromCharacterId: targetCharacterId, toCharacterId: character._id }
        ],
        relationshipTypeId: relationshipTypeId,
        status: { $in: ['PROPOSED', 'PENDING_MUTUAL', 'ESTABLISHED'] }
      });

      if (existingRelationship) {
        res.status(409).json({
          success: false,
          error: 'Una relazione di questo tipo esiste già tra questi personaggi'
        });
        return;
      }

      // Check exclusive relationship constraints
      if (relationshipType.isExclusive) {
        const existingExclusive = await Relationship.CharacterRelationship.findOne({
          $or: [
            { fromCharacterId: character._id },
            { toCharacterId: character._id }
          ],
          relationshipTypeId: relationshipTypeId,
          status: 'ESTABLISHED'
        });

        if (existingExclusive) {
          res.status(409).json({
            success: false,
            error: 'Hai già una relazione esclusiva di questo tipo'
          });
          return;
        }
      }

      // Check max instances constraint
      if (relationshipType.maxInstances) {
        const currentCount = await Relationship.CharacterRelationship.countDocuments({
          $or: [
            { fromCharacterId: character._id },
            { toCharacterId: character._id }
          ],
          relationshipTypeId: relationshipTypeId,
          status: 'ESTABLISHED'
        });

        if (currentCount >= relationshipType.maxInstances) {
          res.status(409).json({
            success: false,
            error: `Numero massimo di relazioni ${relationshipType.name} raggiunto`
          });
          return;
        }
      }

      // Create relationship proposal
      const newRelationship = new Relationship.CharacterRelationship({
        fromCharacterId: character._id,
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
            toCharacterId: character._id,
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
        actorId: character._id.toString(),
        actorName: `${character.name} ${character.surname}`,
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
        relationshipId: newRelationship._id.toString(),
        fromCharacterId: character._id.toString(),
        toCharacterId: targetCharacterId,
        relationshipType: relationshipType.name,
        requiresApproval: relationshipType.requiresMutualApproval
      });

      logger.info('Relationship proposed', {
        relationshipId: newRelationship._id,
        fromCharacter: character._id,
        toCharacter: targetCharacterId,
        relationshipType: relationshipType.name
      });

      res.status(201).json({
        success: true,
        data: {
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
        }
      });

    } catch (error: any) {
      logger.error('Error proposing relationship:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  static async respondToProposal(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;
      const { relationshipId } = req.params;
      const { action } = req.body;

      if (!action || !['accept', 'reject'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'L\'azione deve essere "accept" o "reject"'
        });
        return;
      }

      // Find the relationship proposal
      const relationship = await Relationship.CharacterRelationship.findById(relationshipId)
        .populate('relationshipTypeId', 'name requiresMutualApproval hasReciprocalType')
        .populate('fromCharacterId', 'name surname')
        .populate('toCharacterId', 'name surname');

      if (!relationship) {
        res.status(404).json({
          success: false,
          error: 'Proposta di relazione non trovata'
        });
        return;
      }

      // Check if character is the target of the proposal
      if (relationship.toCharacterId._id.toString() !== character._id.toString()) {
        res.status(403).json({
          success: false,
          error: 'Puoi rispondere solo alle proposte dirette a te'
        });
        return;
      }

      // Check if proposal is in correct status
      if (!['PROPOSED', 'PENDING_MUTUAL'].includes(relationship.status)) {
        res.status(400).json({
          success: false,
          error: 'Non puoi rispondere a questa proposta'
        });
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
        actorId: character._id.toString(),
        actorName: `${character.name} ${character.surname}`,
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
        relationshipId: relationship._id.toString(),
        fromCharacterId: relationship.fromCharacterId._id.toString(),
        toCharacterId: character._id.toString(),
        relationshipType: relationship.relationshipTypeName
      });

      logger.info(`Relationship proposal ${action}ed`, {
        relationshipId: relationship._id,
        responder: character._id,
        proposer: relationship.fromCharacterId._id
      });

      res.json({
        success: true,
        data: {
          relationship: {
            id: relationship._id,
            status: updatedStatus,
            relationshipType: relationship.relationshipTypeName,
            establishedAt: establishedAt
          }
        }
      });

    } catch (error: any) {
      logger.error('Error responding to relationship proposal:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  static async endRelationship(req: Request, res: Response): Promise<void> {
    try {
      const authResult = AuthUtils.authenticate(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      const character = authResult.character;
      const { relationshipId } = req.params;

      const relationship = await Relationship.CharacterRelationship.findById(relationshipId)
        .populate('fromCharacterId', 'name surname')
        .populate('toCharacterId', 'name surname');

      if (!relationship) {
        res.status(404).json({
          success: false,
          error: 'Relazione non trovata'
        });
        return;
      }

      // Check if character is part of this relationship
      const isFromCharacter = relationship.fromCharacterId._id.toString() === character._id.toString();
      const isToCharacter = relationship.toCharacterId._id.toString() === character._id.toString();

      if (!isFromCharacter && !isToCharacter) {
        res.status(403).json({
          success: false,
          error: 'Non fai parte di questa relazione'
        });
        return;
      }

      // Check if relationship can be ended
      if (relationship.status !== 'ESTABLISHED') {
        res.status(400).json({
          success: false,
          error: 'Solo le relazioni stabilite possono essere terminate'
        });
        return;
      }

      // End the relationship
      relationship.status = 'ENDED';
      relationship.endedAt = new Date();
      relationship.endedBy = character._id;
      await relationship.save();

      // End linked reciprocal relationship if exists
      if (relationship.linkedRelationshipId) {
        await Relationship.CharacterRelationship.findByIdAndUpdate(
          relationship.linkedRelationshipId,
          {
            status: 'ENDED',
            endedAt: new Date(),
            endedBy: character._id
          }
        );
      }

      // Audit log
      await auditLogger.log({
        action: 'RELATIONSHIP_ENDED',
        actorType: 'CHARACTER',
        actorId: character._id.toString(),
        actorName: `${character.name} ${character.surname}`,
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
        relationshipId: relationship._id.toString(),
        fromCharacterId: relationship.fromCharacterId._id.toString(),
        toCharacterId: relationship.toCharacterId._id.toString(),
        relationshipType: relationship.relationshipTypeName,
        endedBy: character._id.toString()
      });

      logger.info('Relationship ended', {
        relationshipId: relationship._id,
        endedBy: character._id
      });

      res.json({
        success: true,
        data: {
          message: 'Relationship ended successfully'
        }
      });

    } catch (error: any) {
      logger.error('Error ending relationship:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}