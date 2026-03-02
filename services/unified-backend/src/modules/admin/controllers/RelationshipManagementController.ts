import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  RelationshipType,
  CharacterRelationship,
  RelationshipProposal,
  RelationshipAction,
  IRelationshipType,
  ICharacterRelationship,
  IRelationshipProposal
} from '@database/models/Relationship';
import { Character } from '@database/models/Character';
import { logger } from '../utils/logger';
import { auditLogger } from '../utils/auditLogger';
import { successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class RelationshipManagementController {

  /**
   * Get relationship types with filtering, searching and pagination
   */
  static async getRelationshipTypes(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        isActive = '',
        requiresMutualApproval = '',
        isExclusive = '',
        allowsSelfProposal = '',
        requiredGender = '',
        requiredSocialClass = '',
        sortBy = 'name',
        sortOrder = 'asc'
      } = req.query;

      // Build filter object
      const filter: any = {};
      
      // Text search
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { socialImplications: { $regex: search, $options: 'i' } }
        ];
      }

      // Status filters
      if (isActive !== '') {
        filter.isActive = isActive === 'true';
      }
      if (requiresMutualApproval !== '') {
        filter.requiresMutualApproval = requiresMutualApproval === 'true';
      }
      if (isExclusive !== '') {
        filter.isExclusive = isExclusive === 'true';
      }
      if (allowsSelfProposal !== '') {
        filter.allowsSelfProposal = allowsSelfProposal === 'true';
      }

      // Requirement filters
      if (requiredGender) {
        filter.requiredGender = requiredGender;
      }
      if (requiredSocialClass) {
        filter.requiredSocialClass = requiredSocialClass;
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      // Sorting
      const sortField = sortBy as string;
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      const sort: any = { [sortField]: sortDirection };

      // Execute query with population
      const [relationshipTypes, total] = await Promise.all([
        RelationshipType.find(filter)
          .populate('createdBy', 'username')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        RelationshipType.countDocuments(filter)
      ]);

      // Add usage statistics for each relationship type
      const relationshipTypesWithStats = await Promise.all(
        relationshipTypes.map(async (relType) => {
          const usage = await CharacterRelationship.countDocuments({
            relationshipTypeId: relType._id,
            isActive: true
          });

          const activeProposals = await RelationshipProposal.countDocuments({
            relationshipTypeId: relType._id,
            status: 'pending'
          });

          return {
            ...relType,
            usage: {
              activeRelationships: usage,
              pendingProposals: activeProposals
            }
          };
        })
      );

      const totalPages = Math.ceil(total / limitNum);

      res.json(successResponse(
        {
          relationshipTypes: relationshipTypesWithStats,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount: total,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            limit: limitNum
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching relationship types:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching relationship types',
        'FETCH_RELATIONSHIP_TYPES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get relationship types statistics and analytics
   */
  static async getRelationshipTypeStats(req: Request, res: Response): Promise<void> {
    try {
      // Basic counts
      const [
        totalTypes,
        activeTypes,
        mutualApprovalTypes,
        exclusiveTypes,
        selfProposalTypes
      ] = await Promise.all([
        RelationshipType.countDocuments({}),
        RelationshipType.countDocuments({ isActive: true }),
        RelationshipType.countDocuments({ requiresMutualApproval: true }),
        RelationshipType.countDocuments({ isExclusive: true }),
        RelationshipType.countDocuments({ allowsSelfProposal: true })
      ]);

      // Gender and social class restrictions
      const genderRestrictions = await RelationshipType.aggregate([
        { $unwind: '$requiredGender' },
        { $group: { _id: '$requiredGender', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      const socialClassRestrictions = await RelationshipType.aggregate([
        { $unwind: '$requiredSocialClass' },
        { $group: { _id: '$requiredSocialClass', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Usage statistics
      const usageStats = await RelationshipType.aggregate([
        {
          $lookup: {
            from: 'character_relationships',
            localField: '_id',
            foreignField: 'relationshipTypeId',
            as: 'relationships'
          }
        },
        {
          $addFields: {
            activeRelationships: {
              $size: {
                $filter: {
                  input: '$relationships',
                  cond: { $eq: ['$$this.isActive', true] }
                }
              }
            }
          }
        },
        {
          $sort: { activeRelationships: -1 }
        },
        {
          $limit: 10
        },
        {
          $project: {
            name: 1,
            activeRelationships: 1
          }
        }
      ]);

      // Respectability impact
      const respectabilityStats = await RelationshipType.aggregate([
        {
          $group: {
            _id: '$respectabilityModifier',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Recent activity
      const recentTypes = await RelationshipType.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'username')
        .select('name createdAt createdBy');

      res.json(successResponse(
        {
          overview: {
            total: totalTypes,
            active: activeTypes,
            inactive: totalTypes - activeTypes,
            requiresMutualApproval: mutualApprovalTypes,
            exclusive: exclusiveTypes,
            allowsSelfProposal: selfProposalTypes
          },
          restrictions: {
            byGender: genderRestrictions,
            bySocialClass: socialClassRestrictions
          },
          usage: {
            mostUsed: usageStats
          },
          respectability: respectabilityStats,
          recentActivity: recentTypes
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching relationship type statistics:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching statistics',
        'FETCH_RELATIONSHIP_TYPE_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get active character relationships with filtering and pagination
   */
  static async getCharacterRelationships(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        status = '',
        relationshipTypeId = '',
        characterId = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter: any = {};

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Relationship type filter
      if (relationshipTypeId) {
        filter.relationshipTypeId = new mongoose.Types.ObjectId(relationshipTypeId as string);
      }

      // Character filter
      if (characterId) {
        filter.$or = [
          { fromCharacterId: new mongoose.Types.ObjectId(characterId as string) },
          { toCharacterId: new mongoose.Types.ObjectId(characterId as string) }
        ];
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      // Sorting
      const sortField = sortBy as string;
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      const sort: any = { [sortField]: sortDirection };

      // Execute query with full population
      let query = CharacterRelationship.find(filter)
        .populate('fromCharacterId', 'name basicInfo.fullName')
        .populate('toCharacterId', 'name basicInfo.fullName')
        .populate('relationshipTypeId', 'name description respectabilityModifier')
        .populate('proposedBy', 'name basicInfo.fullName')
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

      // Apply text search if provided (after population)
      if (search) {
        // We need to do this after population, so we'll fetch more and filter
        query = query.limit(limitNum * 5); // Get more to account for filtering
      }

      const relationships = await query.lean();

      // Apply text search filter if needed
      let filteredRelationships = relationships;
      if (search) {
        filteredRelationships = relationships.filter((rel: any) => {
          const fromName = rel.fromCharacterId?.basicInfo?.fullName || rel.fromCharacterId?.name || '';
          const toName = rel.toCharacterId?.basicInfo?.fullName || rel.toCharacterId?.name || '';
          const typeName = rel.relationshipTypeId?.name || '';
          const searchText = search.toString().toLowerCase();
          
          return (
            fromName.toLowerCase().includes(searchText) ||
            toName.toLowerCase().includes(searchText) ||
            typeName.toLowerCase().includes(searchText) ||
            (rel.relationshipNotes || '').toLowerCase().includes(searchText) ||
            (rel.publicDescription || '').toLowerCase().includes(searchText)
          );
        }).slice(0, limitNum);
      }

      const total = await CharacterRelationship.countDocuments(filter);
      const totalPages = Math.ceil(total / limitNum);

      res.json(successResponse(
        {
          relationships: filteredRelationships,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount: total,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            limit: limitNum
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching character relationships:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching relationships',
        'FETCH_CHARACTER_RELATIONSHIPS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get relationship proposals with filtering and pagination
   */
  static async getRelationshipProposals(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        status = '',
        relationshipTypeId = '',
        characterId = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter: any = {};

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Relationship type filter
      if (relationshipTypeId) {
        filter.relationshipTypeId = new mongoose.Types.ObjectId(relationshipTypeId as string);
      }

      // Character filter
      if (characterId) {
        filter.$or = [
          { fromCharacterId: new mongoose.Types.ObjectId(characterId as string) },
          { toCharacterId: new mongoose.Types.ObjectId(characterId as string) }
        ];
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      // Sorting
      const sortField = sortBy as string;
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      const sort: any = { [sortField]: sortDirection };

      const [proposals, total] = await Promise.all([
        RelationshipProposal.find(filter)
          .populate('fromCharacterId', 'name basicInfo.fullName')
          .populate('toCharacterId', 'name basicInfo.fullName')
          .populate('relationshipTypeId', 'name description')
          .populate('response.respondedBy', 'name basicInfo.fullName')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        RelationshipProposal.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limitNum);

      res.json(successResponse(
        {
          proposals,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount: total,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            limit: limitNum
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching relationship proposals:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching proposals',
        'FETCH_RELATIONSHIP_PROPOSALS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get relationship statistics and analytics
   */
  static async getRelationshipStats(req: Request, res: Response): Promise<void> {
    try {
      // Relationship status counts
      const statusCounts = await CharacterRelationship.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Proposal status counts
      const proposalStatusCounts = await RelationshipProposal.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Most popular relationship types
      const popularTypes = await CharacterRelationship.aggregate([
        {
          $lookup: {
            from: 'relationship_types',
            localField: 'relationshipTypeId',
            foreignField: '_id',
            as: 'relationshipType'
          }
        },
        { $unwind: '$relationshipType' },
        {
          $group: {
            _id: {
              typeId: '$relationshipTypeId',
              typeName: '$relationshipType.name'
            },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            totalCount: { $sum: 1 }
          }
        },
        { $sort: { activeCount: -1 } },
        { $limit: 10 }
      ]);

      // Relationship strength and trust averages
      const strengthTrustStats = await CharacterRelationship.aggregate([
        {
          $match: { status: 'ESTABLISHED', isActive: true }
        },
        {
          $group: {
            _id: null,
            avgStrength: { $avg: '$currentStrength' },
            avgTrust: { $avg: '$trustLevel' },
            minStrength: { $min: '$currentStrength' },
            maxStrength: { $max: '$currentStrength' },
            minTrust: { $min: '$trustLevel' },
            maxTrust: { $max: '$trustLevel' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Character activity (most connected characters)
      const mostConnectedCharacters = await CharacterRelationship.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$fromCharacterId',
            relationshipCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'characters',
            localField: '_id',
            foreignField: '_id',
            as: 'character'
          }
        },
        { $unwind: '$character' },
        {
          $project: {
            characterName: '$character.basicInfo.fullName',
            relationshipCount: 1
          }
        },
        { $sort: { relationshipCount: -1 } },
        { $limit: 10 }
      ]);

      // Recent activity
      const recentActivity = await RelationshipAction.find({})
        .populate('performedBy', 'name basicInfo.fullName')
        .populate('affectedCharacter', 'name basicInfo.fullName')
        .sort({ performedAt: -1 })
        .limit(10)
        .lean();

      res.json(successResponse(
        {
          overview: {
            relationships: statusCounts,
            proposals: proposalStatusCounts
          },
          popularTypes,
          strengthAndTrust: strengthTrustStats[0] || {
            avgStrength: 0,
            avgTrust: 0,
            count: 0
          },
          mostConnectedCharacters,
          recentActivity
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching relationship statistics:', error);
      res.status(500).json(errorResponse(
        'Internal server error while fetching relationship statistics',
        'FETCH_RELATIONSHIP_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a new relationship type
   */
  static async createRelationshipType(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req as any;
      const {
        name,
        description,
        requiresMutualApproval = true,
        isExclusive = false,
        allowsSelfProposal = true,
        hasReciprocalType = false,
        reciprocalTypeId,
        maxInstances,
        requiredGender = [],
        requiredSocialClass = [],
        socialImplications,
        isPublicRelationship = true,
        respectabilityModifier = 0
      } = req.body;

      // Validation
      if (!name || name.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Relationship type name is required',
          'RELATIONSHIP_TYPE_NAME_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!description || description.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Description is required',
          'DESCRIPTION_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!socialImplications || socialImplications.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Social implications description is required',
          'SOCIAL_IMPLICATIONS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check if name already exists
      const existingType = await RelationshipType.findOne({ 
        name: new RegExp(`^${name.trim()}$`, 'i') 
      });

      if (existingType) {
        res.status(409).json(errorResponse(
          'Relationship type with this name already exists',
          'RELATIONSHIP_TYPE_NAME_EXISTS',
          undefined,
          409,
          getRequestId(req)
        ));
        return;
      }

      // Create new relationship type
      const relationshipType = new RelationshipType({
        name: name.trim(),
        description: description.trim(),
        requiresMutualApproval,
        isExclusive,
        allowsSelfProposal,
        hasReciprocalType,
        reciprocalTypeId: reciprocalTypeId || undefined,
        maxInstances: maxInstances || undefined,
        requiredGender: Array.isArray(requiredGender) ? requiredGender : [],
        requiredSocialClass: Array.isArray(requiredSocialClass) ? requiredSocialClass : [],
        socialImplications: socialImplications.trim(),
        isPublicRelationship,
        respectabilityModifier: Math.min(5, Math.max(-5, respectabilityModifier)),
        createdBy: user._id
      });

      await relationshipType.save();

      // Audit log
      auditLogger.logSuccess({
        action: 'CREATE_RELATIONSHIP_TYPE',
        userId: user._id.toString(),
        username: user.username,
        details: { relationshipTypeId: relationshipType._id, name: relationshipType.name },
      });

      logger.info(`Relationship type created: ${relationshipType.name}`, { 
        relationshipTypeId: relationshipType._id, 
        adminId: user._id 
      });

      res.status(201).json(createResponse(
        { relationshipType },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error creating relationship type:', error);
      res.status(500).json(errorResponse(
        'Internal server error while creating relationship type',
        'CREATE_RELATIONSHIP_TYPE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update a relationship type
   */
  static async updateRelationshipType(req: Request<{ relationshipTypeId: string }>, res: Response): Promise<void> {
    try {
      const { relationshipTypeId } = req.params;
      const { user } = req as any;
      const { reason, ...updateData } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Update reason is required',
          'UPDATE_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const relationshipType = await RelationshipType.findById(relationshipTypeId);
      if (!relationshipType) {
        res.status(404).json(errorResponse(
          'Relationship type not found',
          'RELATIONSHIP_TYPE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Store original data for audit
      const originalData = relationshipType.toObject();

      // Apply updates
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          (relationshipType as any)[key] = updateData[key];
        }
      });

      // Validate respectability modifier range
      if (updateData.respectabilityModifier !== undefined) {
        relationshipType.respectabilityModifier = Math.min(5, Math.max(-5, updateData.respectabilityModifier));
      }

      await relationshipType.save();

      // Audit log
      auditLogger.logSuccess({
        action: 'UPDATE_RELATIONSHIP_TYPE',
        userId: user._id.toString(),
        username: user.username,
        details: { 
          relationshipTypeId: relationshipType._id, 
          name: relationshipType.name,
          reason: reason.trim(),
          changes: updateData 
        },
      });

      logger.info(`Relationship type updated: ${relationshipType.name}`, { 
        relationshipTypeId: relationshipType._id, 
        adminId: user._id,
        reason: reason.trim()
      });

      res.json(updateResponse(
        { relationshipType },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error updating relationship type:', error);
      res.status(500).json(errorResponse(
        'Internal server error while updating relationship type',
        'UPDATE_RELATIONSHIP_TYPE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a relationship type (soft delete)
   */
  static async deleteRelationshipType(req: Request<{ relationshipTypeId: string }>, res: Response): Promise<void> {
    try {
      const { relationshipTypeId } = req.params;
      const { user } = req as any;
      const { reason, forceDelete = false } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Deletion reason is required',
          'DELETION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const relationshipType = await RelationshipType.findById(relationshipTypeId);
      if (!relationshipType) {
        res.status(404).json(errorResponse(
          'Relationship type not found',
          'RELATIONSHIP_TYPE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check for existing relationships
      const existingRelationships = await CharacterRelationship.countDocuments({
        relationshipTypeId: relationshipType._id,
        isActive: true
      });

      const pendingProposals = await RelationshipProposal.countDocuments({
        relationshipTypeId: relationshipType._id,
        status: 'pending'
      });

      if ((existingRelationships > 0 || pendingProposals > 0) && !forceDelete) {
        res.status(409).json(errorResponse(
          `Cannot delete relationship type. It has ${existingRelationships} active relationships and ${pendingProposals} pending proposals. Use forceDelete to proceed.`,
          'RELATIONSHIP_TYPE_HAS_ACTIVE_RELATIONSHIPS',
          {
            activeRelationships: existingRelationships,
            pendingProposals: pendingProposals
          },
          409,
          getRequestId(req)
        ));
        return;
      }

      // Soft delete (deactivate)
      relationshipType.isActive = false;
      await relationshipType.save();

      // If force delete, handle existing relationships
      if (forceDelete && (existingRelationships > 0 || pendingProposals > 0)) {
        // End all active relationships
        await CharacterRelationship.updateMany(
          { relationshipTypeId: relationshipType._id, isActive: true },
          {
            status: 'ENDED',
            isActive: false,
            endedAt: new Date(),
            endReason: `Relationship type deleted: ${reason.trim()}`
          }
        );

        // Expire all pending proposals
        await RelationshipProposal.updateMany(
          { relationshipTypeId: relationshipType._id, status: 'pending' },
          {
            status: 'expired',
            isActive: false
          }
        );
      }

      // Audit log
      auditLogger.logSuccess({
        action: 'DELETE_RELATIONSHIP_TYPE',
        userId: user._id.toString(),
        username: user.username,
        details: { 
          relationshipTypeId: relationshipType._id, 
          name: relationshipType.name,
          reason: reason.trim(),
          forceDelete,
          affectedRelationships: existingRelationships,
          affectedProposals: pendingProposals
        },
      });

      logger.info(`Relationship type deleted: ${relationshipType.name}`, { 
        relationshipTypeId: relationshipType._id, 
        adminId: user._id,
        reason: reason.trim(),
        forceDelete
      });

      res.json(deleteResponse(
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error deleting relationship type:', error);
      res.status(500).json(errorResponse(
        'Internal server error while deleting relationship type',
        'DELETE_RELATIONSHIP_TYPE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Moderate a character relationship (admin override)
   */
  static async moderateRelationship(req: Request<{ relationshipId: string }>, res: Response): Promise<void> {
    try {
      const { relationshipId } = req.params;
      const { user } = req as any;
      const { action, reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Moderation reason is required',
          'MODERATION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const relationship = await CharacterRelationship.findById(relationshipId)
        .populate('fromCharacterId', 'name basicInfo.fullName')
        .populate('toCharacterId', 'name basicInfo.fullName')
        .populate('relationshipTypeId', 'name');

      if (!relationship) {
        res.status(404).json({
          success: false,
          error: 'Relationship not found'
        });
        return;
      }

      let actionTaken = '';

      switch (action) {
        case 'force_approve':
          relationship.status = 'ESTABLISHED';
          relationship.fromCharacterApproved = true;
          relationship.toCharacterApproved = true;
          relationship.establishedDate = new Date();
          actionTaken = 'Force approved relationship';
          break;

        case 'reject':
          relationship.status = 'REJECTED';
          relationship.isActive = false;
          actionTaken = 'Rejected relationship';
          break;

        case 'end':
          relationship.status = 'ENDED';
          relationship.isActive = false;
          relationship.endedAt = new Date();
          relationship.endReason = `Admin moderation: ${reason.trim()}`;
          actionTaken = 'Ended relationship';
          break;

        case 'dispute':
          relationship.status = 'DISPUTED';
          actionTaken = 'Marked relationship as disputed';
          break;

        default:
          res.status(400).json(errorResponse(
            'Invalid moderation action. Use: force_approve, reject, end, or dispute',
            'INVALID_MODERATION_ACTION',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
      }

      await relationship.save();

      // Create relationship action record
      const relationshipAction = new RelationshipAction({
        actionType: 'dispute', // Admin actions are logged as disputes
        relationshipId: relationship._id,
        performedBy: user._id,
        affectedCharacter: relationship.fromCharacterId,
        actionData: {
          reason: reason.trim(),
          message: `Admin moderation: ${actionTaken}`
        },
        status: 'processed',
        processedAt: new Date()
      });

      await relationshipAction.save();

      // Audit log
      auditLogger.logSuccess({
        action: 'MODERATE_RELATIONSHIP',
        userId: user._id.toString(),
        username: user.username,
        details: { 
          relationshipId: relationship._id,
          action,
          reason: reason.trim(),
          fromCharacter: (relationship.fromCharacterId as any)?.basicInfo?.fullName,
          toCharacter: (relationship.toCharacterId as any)?.basicInfo?.fullName,
          relationshipType: (relationship.relationshipTypeId as any)?.name
        },
      });

      logger.info(`Relationship moderated: ${actionTaken}`, { 
        relationshipId: relationship._id, 
        adminId: user._id,
        reason: reason.trim(),
        action
      });

      res.json(successResponse(
        {
          relationship,
          actionTaken
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error moderating relationship:', error);
      res.status(500).json(errorResponse(
        'Internal server error while moderating relationship',
        'MODERATE_RELATIONSHIP_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk operations on relationship types
   */
  static async bulkOperations(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req as any;
      const { operation, relationshipTypeIds, reason, ...operationData } = req.body;

      if (!operation || !Array.isArray(relationshipTypeIds) || relationshipTypeIds.length === 0) {
        res.status(400).json(errorResponse(
          'Operation and relationship type IDs array are required',
          'MISSING_BULK_OPERATION_DATA',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Reason is required for bulk operations',
          'BULK_OPERATION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      let processed = 0;
      let skipped = 0;
      const errors: any[] = [];
      let summary: any = {};

      for (const relationshipTypeId of relationshipTypeIds) {
        try {
          const relationshipType = await RelationshipType.findById(relationshipTypeId);
          if (!relationshipType) {
            errors.push({
              relationshipTypeId,
              error: 'Relationship type not found'
            });
            skipped++;
            continue;
          }

          switch (operation) {
            case 'activate':
              relationshipType.isActive = true;
              await relationshipType.save();
              summary.activated = (summary.activated || 0) + 1;
              break;

            case 'deactivate':
              relationshipType.isActive = false;
              await relationshipType.save();
              summary.deactivated = (summary.deactivated || 0) + 1;
              break;

            case 'update_mutual_approval':
              relationshipType.requiresMutualApproval = operationData.requiresMutualApproval === true;
              await relationshipType.save();
              summary.mutualApprovalUpdated = (summary.mutualApprovalUpdated || 0) + 1;
              break;

            case 'update_respectability':
              if (operationData.respectabilityModifier !== undefined) {
                relationshipType.respectabilityModifier = Math.min(5, Math.max(-5, operationData.respectabilityModifier));
                await relationshipType.save();
                summary.respectabilityUpdated = (summary.respectabilityUpdated || 0) + 1;
              }
              break;

            default:
              errors.push({
                relationshipTypeId,
                relationshipTypeName: relationshipType.name,
                error: 'Invalid operation'
              });
              skipped++;
              continue;
          }

          processed++;

        } catch (error: any) {
          errors.push({
            relationshipTypeId,
            error: error.message
          });
          skipped++;
        }
      }

      // Audit log
      auditLogger.logSuccess({
        action: 'BULK_RELATIONSHIP_TYPE_OPERATION',
        userId: user._id.toString(),
        username: user.username,
        details: { 
          operation,
          reason: reason.trim(),
          processed,
          skipped,
          summary,
          relationshipTypeIds
        },
      });

      logger.info(`Bulk operation on relationship types completed`, { 
        operation,
        processed,
        skipped,
        adminId: user._id,
        reason: reason.trim()
      });

      res.json(successResponse(
        {
          processed,
          skipped,
          errors,
          summary
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error in bulk relationship type operations:', error);
      res.status(500).json(errorResponse(
        'Internal server error while performing bulk operations',
        'BULK_RELATIONSHIP_TYPE_OPERATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

}