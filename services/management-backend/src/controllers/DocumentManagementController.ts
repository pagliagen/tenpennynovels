import { Request, Response } from 'express';
import mongoose from 'mongoose';
import slugify from 'slugify';
import fs from 'fs';
import path from 'path';
import {
  ApiResponse
} from '../types/management';
import { logger } from '../utils/logger';
import { DocumentGroup, DocumentModel } from '../models/Document';
import { getRedisPublisher } from '../config/redis';
import { EmbeddingEventPublisher } from '../utils/events/embedding-publisher';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class DocumentManagementController {

  /**
   * Get list of document groups with their documents
   * GET /admin/documents/groups?type=ambientazione|regolamento
   */
  static async getDocumentGroups(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.query;

      if (!type || !['ambientazione', 'regolamento'].includes(type as string)) {
        res.status(400).json(errorResponse(
          'Tipo documento richiesto (ambientazione o regolamento)',
          'DOCUMENT_TYPE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`Fetching document groups for type: ${type}`);

      // For now, we'll work with the existing structure and convert it
      // The existing documents use a 'group' field instead of groupId reference
      const documents = await mongoose.connection.db!.collection('documents')
        .find({ type: type as string })
        .sort({ group: 1, order: 1, title: 1 })
        .toArray();

      // Get existing DocumentGroups to check isActive status
      const existingGroups = await DocumentGroup.find({ type: type as string }).lean();
      const groupStatusMap = new Map(
        existingGroups.map(group => [group.name, group])
      );

      // Group documents by their 'group' field
      const groupedDocs = new Map();
      
      documents.forEach(doc => {
        const groupName = doc.group || 'Senza Gruppo';
        if (!groupedDocs.has(groupName)) {
          const existingGroup = groupStatusMap.get(groupName);
          groupedDocs.set(groupName, {
            id: `group_${groupName.replace(/\s+/g, '_')}`,
            name: groupName,
            description: existingGroup?.description || `Gruppo di documenti ${groupName}`,
            type: type as string,
            order: existingGroup?.order || 0,
            isActive: existingGroup?.isActive !== undefined ? existingGroup.isActive : true,
            createdAt: existingGroup?.createdAt || new Date(),
            updatedAt: existingGroup?.updatedAt || new Date(),
            documents: []
          });
        }

        // Convert document to expected format
        const safeDoc = {
          id: doc._id.toString(),
          title: doc.title,
          content: doc.content || '',
          groupId: `group_${groupName.replace(/\s+/g, '_')}`,
          group: doc.group,
          type: doc.type,
          visibility: doc.isPublic ? 'pubblico' : 'ristretto',
          status: 'published',
          order: doc.order || 0,
          slug: doc.slug,
          summary: doc.description,
          tags: doc.tags || [],
          authorId: doc.createdBy?.userId || 'system',
          authorName: doc.createdBy?.username || 'Sistema',
          createdAt: doc.createdAt,
          updatedAt: doc.lastUpdated || doc.createdAt,
          publishedAt: doc.publishedAt,
          lastEditedBy: doc.lastEditedBy,
          version: doc.version || 1
        };

        groupedDocs.get(groupName).documents.push(safeDoc);
      });

      // Add empty groups from document_groups collection
      const emptyGroups = await mongoose.connection.db!.collection('document_groups')
        .find({ type, isActive: true })
        .toArray();

      for (const emptyGroup of emptyGroups) {
        if (!groupedDocs.has(emptyGroup.name)) {
          groupedDocs.set(emptyGroup.name, {
            id: `group_${emptyGroup.name.replace(/\s+/g, '_')}`,
            name: emptyGroup.name,
            description: emptyGroup.description,
            type: type as string,
            order: emptyGroup.order || 0,
            isActive: emptyGroup.isActive !== false,
            createdAt: emptyGroup.createdAt,
            updatedAt: emptyGroup.updatedAt,
            documents: []
          });
        }
      }

      // Convert to array and sort groups
      const groupsWithDocs = Array.from(groupedDocs.values()).sort((a, b) => {
        // Custom sort order for specific groups
        const sortOrder = {
          'Introduzione': 1,
          'Londra 1890': 2,
          'Approfondimenti': 3,
          'Regole di Gioco': 1,
          'Sistema di Gioco': 2
        };
        
        const aOrder = sortOrder[a.name as keyof typeof sortOrder] || 999;
        const bOrder = sortOrder[b.name as keyof typeof sortOrder] || 999;
        
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        
        return a.name.localeCompare(b.name);
      });

      logger.info(`Found ${groupsWithDocs.length} groups with ${documents.length} total documents for type: ${type}`);

      res.json(successResponse(
        groupsWithDocs,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching document groups:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: req.query?.type
      });

      res.status(500).json(errorResponse(
        'Errore nel recupero dei gruppi documenti',
        'FETCH_DOCUMENT_GROUPS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a new document group
   * POST /admin/documents/groups
   */
  static async createDocumentGroup(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, type, order, isActive } = req.body;

      if (!name || !type) {
        res.status(400).json(errorResponse(
          'Nome e tipo gruppo sono richiesti',
          'GROUP_NAME_TYPE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!['ambientazione', 'regolamento'].includes(type)) {
        res.status(400).json(errorResponse(
          'Tipo non valido (ambientazione o regolamento)',
          'INVALID_GROUP_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`Creating document group: ${name} (${type})`);

      // Check if group with this name already exists
      const existingGroup = await mongoose.connection.db!.collection('document_groups')
        .findOne({ name, type });

      if (existingGroup) {
        res.status(400).json(errorResponse(
          'Un gruppo con questo nome esiste già',
          'GROUP_NAME_EXISTS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Create the group record in database
      const groupData = {
        id: `group_${name.replace(/\s+/g, '_')}`,
        name,
        description: description || `Gruppo di documenti ${name}`,
        type,
        order: order || 0,
        isActive: isActive !== undefined ? isActive : true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert the group into database
      await mongoose.connection.db!.collection('document_groups').insertOne(groupData);

      logger.info(`Document group created successfully: ${name}`);
      res.status(201).json(createResponse(
        groupData,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error creating document group:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body
      });

      res.status(500).json(errorResponse(
        'Errore nella creazione del gruppo documenti',
        'CREATE_DOCUMENT_GROUP_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update a document group
   * PUT /admin/documents/groups/:id
   */
  static async updateDocumentGroup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      logger.info(`Updating document group: ${id}`, req.body);

      // Extract group name from ID (format: group_name)
      const groupName = id.replace('group_', '').replace(/_/g, ' ');
      const newGroupName = name || groupName;

      // Find or create the DocumentGroup in the database (case-insensitive match)
      let documentGroup = await DocumentGroup.findOne({ 
        name: { $regex: new RegExp(`^${groupName}$`, 'i') } 
      });
      
      if (!documentGroup) {
        // If group doesn't exist, create it with current documents info
        const firstDocument = await mongoose.connection.db!.collection('documents')
          .findOne({ group: groupName });
        
        if (firstDocument) {
          documentGroup = new DocumentGroup({
            name: groupName,
            description: description || `Gruppo di documenti ${groupName}`,
            type: firstDocument!.type,
            order: 0,
            isActive: isActive !== undefined ? isActive : true
          });
          await documentGroup.save();
          logger.info(`Created new DocumentGroup: ${groupName}`);
        } else {
          // Fallback: find any document that might match this group name pattern
          // Look for documents that might belong to this group by searching similar names
          const relatedDocument = await mongoose.connection.db!.collection('documents')
            .findOne({ 
              $or: [
                { group: { $regex: groupName, $options: 'i' } },
                { type: 'ambientazione' }, // Default fallback
              ]
            });
          
          const docType = relatedDocument?.type || 'ambientazione';
          documentGroup = new DocumentGroup({
            name: groupName,
            description: description || `Gruppo di documenti ${groupName}`,
            type: docType,
            order: 0,
            isActive: isActive !== undefined ? isActive : true
          });
          await documentGroup.save();
          logger.info(`Created fallback DocumentGroup: ${groupName} (type: ${docType})`);
        }
      } else {
        // Update existing group
        if (name) documentGroup.name = newGroupName;
        if (description !== undefined) documentGroup.description = description;
        if (isActive !== undefined) documentGroup.isActive = isActive;
        
        await documentGroup.save();
        logger.info(`Updated existing DocumentGroup: ${groupName} -> ${newGroupName}`);
      }

      // If group name is changing, update all documents in this group
      if (name && name !== groupName) {
        const result = await mongoose.connection.db!.collection('documents')
          .updateMany(
            { group: groupName },
            { 
              $set: { 
                group: newGroupName,
                lastUpdated: new Date()
              }
            }
          );

        logger.info(`Updated ${result.modifiedCount} documents with new group name`);
      }

      const groupData = {
        id: `group_${documentGroup.name.replace(/\s+/g, '_')}`,
        name: documentGroup.name,
        description: documentGroup.description,
        type: documentGroup.type,
        order: documentGroup.order,
        isActive: documentGroup.isActive,
        createdAt: documentGroup.createdAt,
        updatedAt: documentGroup.updatedAt
      };

      logger.info(`Document group updated successfully: ${documentGroup.name}`);
      res.json(updateResponse(
        groupData,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error updating document group:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        groupId: req.params?.id,
        body: req.body
      });

      res.status(500).json(errorResponse(
        'Errore nell\'aggiornamento del gruppo documenti',
        'UPDATE_DOCUMENT_GROUP_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a document group
   * DELETE /admin/documents/groups/:id
   */
  static async deleteDocumentGroup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      logger.info(`Deleting document group: ${id}`);

      // Extract group name from ID
      const groupName = id.replace('group_', '').replace(/_/g, ' ');
      logger.info(`Deleting document group: ${groupName}`);

      // Find the document group (case-insensitive match)
      const documentGroup = await DocumentGroup.findOne({ 
        name: { $regex: new RegExp(`^${groupName}$`, 'i') } 
      });

      logger.info(`Document group found: ${documentGroup}`);

      if (!documentGroup) {
        res.status(404).json(errorResponse(
          'Gruppo documenti non trovato',
          'DOCUMENT_GROUP_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if group has documents
      const documentsCount = await mongoose.connection.db!.collection('documents')
        .countDocuments({ group: documentGroup.name });

      if (documentsCount > 0) {
        res.status(400).json(errorResponse(
          `Impossibile eliminare il gruppo: contiene ${documentsCount} documenti`,
          'GROUP_HAS_DOCUMENTS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Delete the DocumentGroup entity
      await DocumentGroup.deleteOne({ _id: documentGroup._id });

      logger.info(`Document group deleted successfully: ${groupName}`);
      res.json(deleteResponse(
        'Gruppo eliminato con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error deleting document group:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        groupId: req.params?.id
      });

      res.status(500).json(errorResponse(
        'Errore nell\'eliminazione del gruppo documenti',
        'DELETE_DOCUMENT_GROUP_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Reorder documents within a group
   * PUT /admin/documents/groups/:id/reorder
   */
  static async reorderDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { documentIds } = req.body;

      if (!documentIds || !Array.isArray(documentIds)) {
        res.status(400).json(errorResponse(
          'Array di ID documenti richiesto',
          'DOCUMENT_IDS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`Reordering documents in group: ${id}`, { documentIds });

      // Update the order of each document
      const bulkOps = documentIds.map((docId: string, index: number) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(docId) },
          update: { 
            $set: { 
              order: index + 1,
              lastUpdated: new Date()
            }
          }
        }
      }));

      const result = await mongoose.connection.db!.collection('documents')
        .bulkWrite(bulkOps);

      logger.info(`Reordered ${result.modifiedCount} documents in group: ${id}`);

      res.json(updateResponse(
        { 
          message: 'Documenti riordinati con successo',
          modifiedCount: result.modifiedCount 
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error reordering documents:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        groupId: req.params?.id,
        body: req.body
      });

      res.status(500).json(errorResponse(
        'Errore nel riordinamento dei documenti',
        'REORDER_DOCUMENTS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a new document
   * POST /admin/documents
   */
  static async createDocument(req: Request, res: Response): Promise<void> {
    try {
      const { title, content, groupId, type, visibility, status, summary, tags, order } = req.body;

      if (!title || !content || !groupId || !type) {
        res.status(400).json(errorResponse(
          'Titolo, contenuto, gruppo e tipo sono richiesti',
          'DOCUMENT_FIELDS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!['ambientazione', 'regolamento'].includes(type)) {
        res.status(400).json(errorResponse(
          'Tipo non valido (ambientazione o regolamento)',
          'INVALID_DOCUMENT_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`Creating document: ${title} (${type})`);

      // Extract group name from groupId
      const groupName = groupId.replace('group_', '').replace(/_/g, ' ');
      const slug = slugify(title, { lower: true, strict: true });

      // Check if slug already exists
      const existingDoc = await mongoose.connection.db!.collection('documents')
        .findOne({ type, slug });
      
      if (existingDoc) {
        res.status(400).json(errorResponse(
          'Un documento con questo titolo esiste già',
          'DOCUMENT_TITLE_EXISTS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get user info from request (set by auth middleware)
      const userId = (req as any).user?.userId || 'unknown';
      const username = (req as any).user?.username || 'Admin';

      const documentData = {
        slug,
        title,
        description: summary,
        type,
        group: groupName, // Legacy field
        groupId, // Future reference
        isPublic: visibility === 'pubblico',
        visibility: visibility || 'pubblico',
        status: status || 'published',
        order: order || 0,
        tags: tags || [],
        activeVersion: 1,
        totalSections: 1,
        lastUpdated: new Date(),
        createdAt: new Date(),
        createdBy: {
          userId,
          username
        },
        authorId: userId,
        authorName: username,
        version: 1
      };

      const result = await mongoose.connection.db!.collection('documents')
        .insertOne(documentData);

      // Also create a document section for compatibility with game-backend
      const sectionData = {
        documentId: result.insertedId,
        version: 1,
        type,
        title,
        slug,
        content,
        order: 1,
        isActive: true,
        isPublic: visibility === 'pubblico',
        createdAt: new Date(),
        createdBy: {
          userId,
          username
        }
      };

      await mongoose.connection.db!.collection('documentSections')
        .insertOne(sectionData);

      // Publish Redis event for async embedding generation
      try {
        const redisPublisher = getRedisPublisher();
        const embeddingPublisher = new EmbeddingEventPublisher(redisPublisher);
        await embeddingPublisher.publishDocumentEvent(
          result.insertedId.toString(),
          title,
          content,
          type as 'ambientazione' | 'regolamento' | 'lore',
          false // isUpdate = false
        );
        logger.info(`Published embedding event for document: ${title}`);
      } catch (error) {
        // Don't fail the request if event publishing fails
        logger.error('Failed to publish embedding event:', error);
      }

      const createdDocument = {
        id: result.insertedId.toString(),
        title,
        content,
        groupId,
        group: groupName,
        type,
        visibility: visibility || 'pubblico',
        status: status || 'published',
        order: order || 0,
        slug,
        summary,
        tags: tags || [],
        authorId: userId,
        authorName: username,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      logger.info(`Document created successfully: ${title}`);
      res.status(201).json(createResponse(
        createdDocument,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error creating document:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body
      });

      res.status(500).json(errorResponse(
        'Errore nella creazione del documento',
        'CREATE_DOCUMENT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update an existing document
   * PUT /admin/documents/:id
   */
  static async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, content, groupId, visibility, status, summary, tags, order, css } = req.body;

      logger.info(`Updating document: ${id}`, req.body);

      const docObjectId = new mongoose.Types.ObjectId(id);
      
      // Check if document exists
      const existingDoc = await mongoose.connection.db!.collection('documents')
        .findOne({ _id: docObjectId });

      if (!existingDoc) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get user info from request
      const userId = (req as any).user?.userId || 'unknown';
      const username = (req as any).user?.username || 'Admin';

      // Build update data
      const updateData: any = {
        lastUpdated: new Date(),
        lastEditedBy: username,
        version: (existingDoc!.version || 1) + 1
      };

      if (title) {
        updateData.title = title;
        updateData.slug = slugify(title, { lower: true, strict: true });
      }
      
      if (summary !== undefined) {
        updateData.description = summary;
      }

      if (visibility) {
        updateData.visibility = visibility;
        updateData.isPublic = visibility === 'pubblico';
      }

      if (status) {
        updateData.status = status;
      }

      if (order !== undefined) {
        updateData.order = order;
      }

      if (tags !== undefined) {
        updateData.tags = tags;
      }

      if (groupId) {
        const groupName = groupId.replace('group_', '').replace(/_/g, ' ');
        updateData.group = groupName;
        updateData.groupId = groupId;
      }

      // Handle CSS updates
      if (css !== undefined) {
        updateData.customCss = css;
        
        // If CSS is provided as string, try to parse it as JSON array
        if (typeof css === 'string') {
          try {
            const cssClasses = JSON.parse(css);
            updateData.cssClasses = Array.isArray(cssClasses) ? cssClasses : [];
          } catch (e) {
            // If not JSON, store as raw CSS
            updateData.customCss = css;
          }
        } else if (Array.isArray(css)) {
          updateData.cssClasses = css;
        }
      }

      // Update document
      await mongoose.connection.db!.collection('documents')
        .updateOne({ _id: docObjectId }, { $set: updateData });

      // If content is being updated, create a new section version
      if (content) {
        const newVersion = (existingDoc!.activeVersion || 1) + 1;

        const sectionData = {
          documentId: docObjectId,
          version: newVersion,
          type: existingDoc!.type,
          title: title || existingDoc!.title,
          slug: title ? slugify(title, { lower: true, strict: true }) : existingDoc!.slug,
          content,
          order: 1,
          isActive: true,
          isPublic: visibility ? visibility === 'pubblico' : existingDoc!.isPublic,
          createdAt: new Date(),
          createdBy: {
            userId,
            username
          }
        };

        await mongoose.connection.db!.collection('documentSections')
          .insertOne(sectionData);

        updateData.activeVersion = newVersion;

        // Publish Redis event for async embedding regeneration
        try {
          const redisPublisher = getRedisPublisher();
          const embeddingPublisher = new EmbeddingEventPublisher(redisPublisher);
          await embeddingPublisher.publishDocumentEvent(
            id,
            title || existingDoc!.title,
            content,
            existingDoc!.type as 'ambientazione' | 'regolamento' | 'lore',
            true // isUpdate = true
          );
          logger.info(`Published embedding update event for document: ${title || existingDoc!.title}`);
        } catch (error) {
          // Don't fail the request if event publishing fails
          logger.error('Failed to publish embedding update event:', error);
        }
      }

      // Final update with new version if content changed
      if (content) {
        await mongoose.connection.db!.collection('documents')
          .updateOne({ _id: docObjectId }, { $set: { activeVersion: updateData.activeVersion } });
      }

      // Fetch updated document
      const updatedDoc = await mongoose.connection.db!.collection('documents')
        .findOne({ _id: docObjectId });

      if (!updatedDoc) {
        throw new Error('Failed to fetch updated document');
      }

      const safeDoc = {
        id: updatedDoc!._id.toString(),
        title: updatedDoc!.title,
        content: content || existingDoc!.content,
        groupId: updatedDoc!.groupId,
        group: updatedDoc!.group,
        type: updatedDoc!.type,
        visibility: updatedDoc!.visibility,
        status: updatedDoc!.status,
        order: updatedDoc!.order,
        slug: updatedDoc!.slug,
        summary: updatedDoc!.description,
        tags: updatedDoc!.tags || [],
        authorId: updatedDoc!.authorId,
        authorName: updatedDoc!.authorName,
        createdAt: updatedDoc!.createdAt,
        updatedAt: updatedDoc!.lastUpdated,
        lastEditedBy: updatedDoc!.lastEditedBy,
        version: updatedDoc!.version
      };

      logger.info(`Document updated successfully: ${updatedDoc!.title}`);
      res.json(updateResponse(
        safeDoc,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error updating document:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        documentId: req.params?.id,
        body: req.body
      });

      res.status(500).json(errorResponse(
        'Errore nell\'aggiornamento del documento',
        'UPDATE_DOCUMENT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a document
   * DELETE /admin/documents/:id
   */
  static async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      logger.info(`Deleting document: ${id}`);

      const docObjectId = new mongoose.Types.ObjectId(id);

      // Check if document exists
      const existingDoc = await mongoose.connection.db!.collection('documents')
        .findOne({ _id: docObjectId });

      if (!existingDoc) {
        res.status(404).json(errorResponse(
          'Documento non trovato',
          'DOCUMENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Before deleting, ensure the group is preserved in document_groups collection
      if (existingDoc!.group) {
        // Check if this group exists in DocumentGroup collection
        const existingGroup = await DocumentGroup.findOne({ name: existingDoc!.group });
        
        if (!existingGroup) {
          // If group doesn't exist in DocumentGroup collection but document has a group,
          // create the group record to preserve it when document is deleted
          const groupData = new DocumentGroup({
            name: existingDoc!.group,
            description: `Gruppo di documenti ${existingDoc!.group}`,
            type: existingDoc!.type,
            order: 0,
            isActive: true
          });
          await groupData.save();
          logger.info(`Preserved empty group: ${existingDoc!.group}`);
        }
      }

      // Delete document and all its sections
      await Promise.all([
        mongoose.connection.db!.collection('documents')
          .deleteOne({ _id: docObjectId }),
        mongoose.connection.db!.collection('documentSections')
          .deleteMany({ documentId: docObjectId })
      ]);

      logger.info(`Document deleted successfully: ${existingDoc!.title}`);
      res.json(deleteResponse(
        'Documento eliminato con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error deleting document:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        documentId: req.params?.id
      });

      res.status(500).json(errorResponse(
        'Errore nell\'eliminazione del documento',
        'DELETE_DOCUMENT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update global CSS classes for documents
   * PUT /admin/documents/css
   */
  static async updateGlobalCSS(req: Request, res: Response): Promise<void> {
    try {
      const { cssClasses } = req.body;

      if (!Array.isArray(cssClasses)) {
        res.status(400).json(errorResponse(
          'cssClasses deve essere un array',
          'INVALID_CSS_CLASSES',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate CSS classes structure
      const validatedClasses = cssClasses.filter((cls: any) => {
        return cls && typeof cls === 'object' && cls.name && cls.properties;
      });

      const cssFilePath = path.join(process.cwd(), 'public', 'assets', 'documents');
      if (!fs.existsSync(cssFilePath)) {
        fs.mkdirSync(cssFilePath, { recursive: true });
      }

      // Generate custom_css.json file
      const jsonFilePath = path.join(cssFilePath, 'custom_css.json');
      fs.writeFileSync(jsonFilePath, JSON.stringify({
        cssClasses: validatedClasses,
        generatedAt: new Date().toISOString(),
        version: Date.now()
      }, null, 2));

      // Generate custom.css file
      const cssContent = this.generateCSSFromClasses(validatedClasses);
      const cssFileOutputPath = path.join(cssFilePath, 'custom.css');
      fs.writeFileSync(cssFileOutputPath, cssContent);

      logger.info(`Generated global CSS files`, {
        jsonFile: jsonFilePath,
        cssFile: cssFileOutputPath,
        classCount: validatedClasses.length
      });

      res.json(updateResponse(
        {
          cssClasses: validatedClasses,
          filesGenerated: {
            json: jsonFilePath,
            css: cssFileOutputPath
          },
          version: Date.now()
        },
        'CSS globale aggiornato con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error updating global CSS:', error);
      
      res.status(500).json(errorResponse(
        'Errore nell\'aggiornamento del CSS globale',
        'UPDATE_GLOBAL_CSS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get global CSS file content
   * GET /admin/documents/css
   */
  static async getGlobalCSS(req: Request, res: Response): Promise<void> {
    try {
      const jsonFilePath = path.join(process.cwd(), 'public', 'assets', 'documents', 'custom_css.json');
      
      if (!fs.existsSync(jsonFilePath)) {
        // Return empty CSS structure if file doesn't exist
        res.json(successResponse(
          {
            cssClasses: [],
            generatedAt: new Date().toISOString(),
            version: 0
          },
          'Nessun CSS globale definito',
          getRequestId(req)
        ));
        return;
      }

      const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
      const cssData = JSON.parse(jsonContent);
      
      res.json(successResponse(
        cssData,
        'CSS globale caricato con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error loading global CSS data:', error);
      
      res.status(500).json(errorResponse(
        'Errore nel caricamento del CSS globale',
        'LOAD_GLOBAL_CSS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Generate CSS content from CSS classes array
   * @private
   */
  private static generateCSSFromClasses(cssClasses: any[]): string {
    let css = '/* Auto-generated CSS from document management */\n\n';
    
    cssClasses.forEach((cls: any) => {
      css += `.${cls.name} {\n`;
      Object.entries(cls.properties).forEach(([prop, value]) => {
        css += `  ${prop}: ${value};\n`;
      });
      css += '}\n\n';
    });
    
    return css;
  }
}
