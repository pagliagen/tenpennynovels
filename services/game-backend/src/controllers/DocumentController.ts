// Document Controller - Handles modular document management
// Supports ambientazione and regolamento document types with versioning

import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import slugify from 'slugify';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import { getEmbeddingsService } from '../../../shared/src/utils/embeddings';
import { successResponse, errorResponse, createResponse, updateResponse, deleteResponse, listResponse, getRequestId } from '../utils/apiResponse';

export type DocumentType = 'ambientazione' | 'regolamento';

export interface DocumentSection {
  _id?: ObjectId;
  documentId: ObjectId;
  version: number;
  type: DocumentType;
  title: string;
  slug: string;
  content: string;
  order: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt: Date;
  createdBy: {
    userId: string;
    username: string;
  };
  updatedAt?: Date;
  updatedBy?: {
    userId: string;
    username: string;
  };
}

export interface Document {
  _id?: ObjectId;
  slug: string;
  title: string;
  description?: string;
  type: DocumentType;
  isPublic: boolean;
  activeVersion: number;
  totalSections: number;
  lastUpdated: Date;
  createdAt: Date;
  createdBy: {
    userId: string;
    username: string;
  };
}
 
// Helper function to check if user can access document
function canAccessDocument(document: Document, user: any, character: any): boolean {
  if (document.isPublic) return true;
  
  // Private documents require authentication (user must be logged in)
  return !!user;
}

// Helper function to check admin permissions
function canManageDocuments(user: any): boolean {
  if (!user?.canAccessAdminPanel) return false;
  
  // Check new granular system first
  if (user.userRoles?.includes('gestore')) return true;
  if (user.characterPermissions?.includes('content.create')) return true;
  if (user.characterPermissions?.includes('content.update')) return true;
  
  // Fallback to legacy system (for backward compatibility)
  return false;
}

// PUBLIC API - Document listing and reading

export async function getDocuments(req: Request, res: Response) {
  try {
    const { type } = req.query;
    const db = mongoose.connection.db;
    
    const filter: any = {};
    if (type && ['ambientazione', 'regolamento'].includes(type as string)) {
      filter.type = type;
    }
    
    // Get documents with active sections count
    const documents = await db.collection('documents').aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'documentSections',
          let: { docId: '$_id', activeVer: '$activeVersion' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$documentId', '$$docId'] },
                    { $eq: ['$version', '$$activeVer'] },
                    { $eq: ['$isActive', true] }
                  ]
                }
              }
            }
          ],
          as: 'sections'
        }
      },
      {
        $addFields: {
          totalSections: { $size: '$sections' }
        }
      },
      {
        $project: {
          sections: 0
        }
      },
      { $sort: { title: 1 } }
    ]).toArray();
    
    // Filter by permissions
    const user = req.user;
    const character = req.character;
    const filteredDocuments = documents.filter(doc => canAccessDocument(doc, user, character));
    
    res.json(successResponse(
      filteredDocuments,
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    console.log('Error fetching documents:', error);
    res.status(500).json(errorResponse(
      'Errore nel recupero dei documenti',
      'GET_DOCUMENTS_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function getDocument(req: Request, res: Response) {
  try {
    const { type, slug } = req.params;
    
    if (!['ambientazione', 'regolamento'].includes(type)) {
      return res.status(400).json(errorResponse(
        'Tipo di documento non valido',
        'INVALID_DOCUMENT_TYPE',
        undefined,
        400,
        getRequestId(req)
      ));
    }
    
    const db = mongoose.connection.db;
    
    // Get document
    const document = await db.collection('documents').findOne({
      type,
      slug
    });
    
    if (!document) {
      return res.status(404).json(errorResponse(
        'Documento non trovato',
        'DOCUMENT_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
    
    // Check permissions
    if (!canAccessDocument(document, req.user, req.character)) {
      return res.status(404).json(errorResponse(
        'Documento non trovato',
        'DOCUMENT_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
    
    // Get active sections
    const sections = await db.collection('documentSections').find({
      documentId: document._id,
      version: document.activeVersion,
      isActive: true
    }).sort({ order: 1 }).toArray();
    
    res.json(successResponse(
      {
        document,
        sections
      },
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error fetching document:', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      documentId: req.params?.id,
      characterId: req.character?.characterId,
      params: req.params,
      query: req.query
    });
    res.status(500).json(errorResponse(
      'Errore nel recupero del documento',
      'GET_DOCUMENT_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function searchDocuments(req: Request, res: Response) {
  try {
    const { q: query, type, page = 1, limit = 20 } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json(errorResponse(
        'Query di ricerca richiesta',
        'MISSING_QUERY',
        undefined,
        400,
        getRequestId(req)
      ));
    }
    
    const db = mongoose.connection.db;
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build search pipeline - search in sections but group by document to avoid duplicates
    const searchPipeline: any[] = [
      {
        $match: {
          $text: { $search: query.trim() },
          isActive: true
        }
      }
    ];
    
    if (type && ['ambientazione', 'regolamento'].includes(type as string)) {
      searchPipeline[0].$match.type = type;
    }
    
    // Add text score and sort by relevance
    searchPipeline.push(
      {
        $addFields: {
          score: { $meta: 'textScore' }
        }
      },
      {
        $sort: { score: { $meta: 'textScore' } }
      }
    );
    
    // Group by document to eliminate duplicates and get best match per document
    searchPipeline.push(
      {
        $group: {
          _id: '$documentId',
          bestSection: { $first: '$$ROOT' },
          totalMatches: { $sum: 1 },
          maxScore: { $max: '$score' },
          matchingSections: { 
            $push: { 
              content: '$content', 
              title: '$title', 
              score: '$score' 
            } 
          }
        }
      },
      {
        $sort: { maxScore: -1, totalMatches: -1 }
      }
    );
    
    // Add pagination
    searchPipeline.push(
      { $skip: skip },
      { $limit: Number(limit) }
    );
    
    // Join with documents collection to get full document info
    searchPipeline.push(
      {
        $lookup: {
          from: 'documents',
          localField: '_id',
          foreignField: '_id',
          as: 'document'
        }
      },
      {
        $unwind: '$document'
      }
    );
    
    const searchResults = await db.collection('documentSections').aggregate(searchPipeline).toArray();
    
    // Get total count of unique documents (not sections)
    const countPipeline = searchPipeline.slice(0, -3); // Remove skip, limit, lookup, unwind
    const totalUniqueDocuments = await db.collection('documentSections').aggregate([
      ...countPipeline.slice(0, -2), // Remove sort and pagination parts
      { $count: 'total' }
    ]).toArray();
    
    const totalResults = totalUniqueDocuments.length > 0 ? totalUniqueDocuments[0].total : 0;
    
    // Filter by permissions and format results
    const user = req.user;
    const character = req.character;
    const filteredResults = [];
    
    for (const result of searchResults) {
      const document = result.document;
      if (document && canAccessDocument(document, user, character)) {
        // Create excerpt from best matching section
        const bestSection = result.bestSection;
        const content = bestSection.content || '';
        const queryWords = query.trim().toLowerCase().split(/\s+/);
        
        // Find the first occurrence of any query word for excerpt
        let excerptStart = 0;
        for (const word of queryWords) {
          const index = content.toLowerCase().indexOf(word);
          if (index >= 0) {
            excerptStart = Math.max(0, index - 100);
            break;
          }
        }
        
        const excerpt = content.substring(excerptStart, excerptStart + 300).trim();
        const cleanExcerpt = excerpt.replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').trim();
        
        // Create highlighted text with search matches tagged
        const createHighlightedText = (text: string, searchQuery: string) => {
          if (!searchQuery || !text) return text;
          
          // Split query into words and escape special regex characters
          const queryWords = searchQuery.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);
          let highlightedText = text;
          
          // Replace each query word with tagged version (case insensitive)
          queryWords.forEach(word => {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Use word boundary at start but allow partial matches at end (for plurals, etc.)
            const regex = new RegExp(`\\b(${escapedWord}\\w*)`, 'gi');
            highlightedText = highlightedText.replace(regex, '[searchmatch]$1[/searchmatch]');
          });
          
          return highlightedText;
        };
        
        const highlightedExcerpt = createHighlightedText(cleanExcerpt, query.trim());
        
        // Use document description if available, otherwise generate from search content
        const description = document.description || 
          `Documento ${document.type === 'ambientazione' ? 'di ambientazione' : 'di regolamento'} con ${result.totalMatches} ${result.totalMatches === 1 ? 'sezione che contiene' : 'sezioni che contengono'} "${query.trim()}". ${document.totalSections} sezioni totali.`;
        
        // Normalize score to 0-1 range for consistency
        const normalizedScore = result.maxScore ? Math.min(result.maxScore / 10, 1.0) : 0;
        
        filteredResults.push({
          id: document._id,
          title: document.title,
          type: document.type,
          slug: document.slug,
          excerpt: cleanExcerpt + (content.length > excerptStart + 300 ? '...' : ''),
          highlightedText: highlightedExcerpt + (content.length > excerptStart + 300 ? '...' : ''),
          description: description,
          score: normalizedScore,
          totalSections: document.totalSections,
          matchingSections: result.totalMatches,
          lastUpdated: document.lastUpdated,
          isPublic: document.isPublic
        });
      }
    }
    
    const totalPages = Math.ceil(totalResults / Number(limit));
    
    res.json(listResponse(
      filteredResults,
      {
        page: Number(page),
        pageSize: Number(limit),
        total: totalResults,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1
      },
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error searching documents:', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      characterId: req.character?.characterId,
      searchQuery: req.query?.q,
      params: req.params,
      query: req.query
    });
    res.status(500).json(errorResponse(
      'Errore nella ricerca',
      'SEARCH_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

// ADMIN API - Document management (requires admin permissions)

export async function createDocument(req: Request, res: Response) {
  try {
    if (!canManageDocuments(req.user)) {
      return res.status(403).json(errorResponse(
        'Accesso negato',
        'ACCESS_DENIED',
        undefined,
        403,
        getRequestId(req)
      ));
    }
    
    const { title, type, isPublic, sections } = req.body;
    
    if (!title || !type || !['ambientazione', 'regolamento'].includes(type) || !sections || !Array.isArray(sections)) {
      return res.status(400).json(errorResponse(
        'Dati richiesti mancanti',
        'VALIDATION_ERROR',
        undefined,
        400,
        getRequestId(req)
      ));
    }
    
    const db = mongoose.connection.db;
    const slug = slugify(title, { lower: true, strict: true });
    
    // Check if slug already exists
    const existingDoc = await db.collection('documents').findOne({ type, slug });
    if (existingDoc) {
      return res.status(400).json(errorResponse(
        'Un documento con questo titolo esiste già',
        'DUPLICATE_DOCUMENT',
        undefined,
        400,
        getRequestId(req)
      ));
    }
    
    // Create document
    const document: Document = {
      slug,
      title,
      type,
      isPublic: Boolean(isPublic),
      activeVersion: 1,
      totalSections: sections.length,
      lastUpdated: new Date(),
      createdAt: new Date(),
      createdBy: {
        userId: req.user.userId,
        username: req.user.username
      }
    };
    
    const docResult = await db.collection('documents').insertOne(document);
    const documentId = docResult.insertedId;
    
    // Create sections
    const documentSections: DocumentSection[] = sections.map((section: any, index: number) => ({
      documentId,
      version: 1,
      type,
      title,
      slug,
      content: section.content,
      order: section.order || index + 1,
      isActive: true,
      isPublic: Boolean(isPublic),
      createdAt: new Date(),
      createdBy: {
        userId: req.user.userId,
        username: req.user.username
      }
    }));
    
    await db.collection('documentSections').insertMany(documentSections);
    
    res.status(201).json(createResponse(
      {
        ...document,
        _id: documentId
      },
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error creating document:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json(errorResponse(
      'Errore nella creazione del documento',
      'CREATE_DOCUMENT_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function updateDocument(req: Request, res: Response) {
  try {
    if (!canManageDocuments(req.user)) {
      return res.status(403).json(errorResponse(
        'Accesso negato',
        'ACCESS_DENIED',
        undefined,
        403,
        getRequestId(req)
      ));
    }
    
    const { documentId } = req.params;
    const { title, isPublic, sections } = req.body;
    
    const db = mongoose.connection.db;
    const document = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });
    
    if (!document) {
      return res.status(404).json(errorResponse(
        'Documento non trovato',
        'DOCUMENT_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
    
    // Create new version
    const newVersion = document.activeVersion + 1;
    
    // Update document metadata
    const updateData: any = {
      lastUpdated: new Date()
    };
    
    if (title) {
      updateData.title = title;
      updateData.slug = slugify(title, { lower: true, strict: true });
    }
    
    if (typeof isPublic === 'boolean') {
      updateData.isPublic = isPublic;
    }
    
    if (sections) {
      updateData.totalSections = sections.length;
      
      // Create new section versions
      const documentSections: DocumentSection[] = sections.map((section: any, index: number) => ({
        documentId: document._id,
        version: newVersion,
        type: document.type,
        title: title || document.title,
        slug: title ? slugify(title, { lower: true, strict: true }) : document.slug,
        content: section.content,
        order: section.order || index + 1,
        isActive: true,
        isPublic: typeof isPublic === 'boolean' ? isPublic : document.isPublic,
        createdAt: new Date(),
        createdBy: {
          userId: req.user.userId,
          username: req.user.username
        }
      }));
      
      await db.collection('documentSections').insertMany(documentSections);
      updateData.activeVersion = newVersion;
    }
    
    await db.collection('documents').updateOne(
      { _id: new ObjectId(documentId) },
      { $set: updateData }
    );
    
    // Get updated document with sections
    const updatedDocument = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });
    const activeSections = await db.collection('documentSections').find({
      documentId: new ObjectId(documentId),
      version: updateData.activeVersion || document.activeVersion,
      isActive: true
    }).sort({ order: 1 }).toArray();
    
    res.json(updateResponse(
      {
        document: updatedDocument,
        sections: activeSections
      },
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error updating document:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json(errorResponse(
      'Errore nell\'aggiornamento del documento',
      'UPDATE_DOCUMENT_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function publishDocumentVersion(req: Request, res: Response) {
  try {
    if (!canManageDocuments(req.user)) {
      return res.status(403).json(errorResponse(
        'Accesso negato',
        'ACCESS_DENIED',
        undefined,
        403,
        getRequestId(req)
      ));
    }
    
    const { documentId, version } = req.params;
    const db = mongoose.connection.db;
    
    const document = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });
    if (!document) {
      return res.status(404).json(errorResponse(
        'Documento non trovato',
        'DOCUMENT_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
    
    // Check if version exists
    const versionExists = await db.collection('documentSections').findOne({
      documentId: new ObjectId(documentId),
      version: Number(version)
    });
    
    if (!versionExists) {
      return res.status(404).json(errorResponse(
        'Versione non trovata',
        'VERSION_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
    
    // Update active version
    await db.collection('documents').updateOne(
      { _id: new ObjectId(documentId) },
      { 
        $set: { 
          activeVersion: Number(version),
          lastUpdated: new Date()
        } 
      }
    );
    
    res.json(successResponse(
      undefined,
      'Versione pubblicata con successo',
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error publishing document version:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json(errorResponse(
      'Errore nella pubblicazione della versione',
      'PUBLISH_VERSION_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    if (!canManageDocuments(req.user)) {
      return res.status(403).json(errorResponse(
        'Accesso negato',
        'ACCESS_DENIED',
        undefined,
        403,
        getRequestId(req)
      ));
    }
    
    const { documentId } = req.params;
    const db = mongoose.connection.db;
    
    // Delete document and all its sections
    await Promise.all([
      db.collection('documents').deleteOne({ _id: new ObjectId(documentId) }),
      db.collection('documentSections').deleteMany({ documentId: new ObjectId(documentId) })
    ]);
    
    res.json(deleteResponse(
      'Documento eliminato con successo',
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error deleting document:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json(errorResponse(
      'Errore nell\'eliminazione del documento',
      'DELETE_DOCUMENT_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function getDocumentVersions(req: Request, res: Response) {
  try {
    if (!canManageDocuments(req.user)) {
      return res.status(403).json(errorResponse(
        'Accesso negato',
        'ACCESS_DENIED',
        undefined,
        403,
        getRequestId(req)
      ));
    }
    
    const { documentId } = req.params;
    const db = mongoose.connection.db;
    
    const versions = await db.collection('documentSections').aggregate([
      { $match: { documentId: new ObjectId(documentId) } },
      {
        $group: {
          _id: '$version',
          createdAt: { $first: '$createdAt' },
          sectionCount: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]).toArray();
    
    const document = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });
    
    const versionData = versions.map(v => ({
      version: v._id,
      createdAt: v.createdAt,
      sectionCount: v.sectionCount,
      isActive: v._id === document?.activeVersion
    }));
    
    res.json(successResponse(
      {
        versions: versionData
      },
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error fetching document versions:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json(errorResponse(
      'Errore nel recupero delle versioni',
      'GET_VERSIONS_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function getDocumentVersion(req: Request, res: Response) {
  try {
    if (!canManageDocuments(req.user)) {
      return res.status(403).json(errorResponse(
        'Accesso negato',
        'ACCESS_DENIED',
        undefined,
        403,
        getRequestId(req)
      ));
    }
    
    const { documentId, version } = req.params;
    const db = mongoose.connection.db;
    
    const document = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });
    if (!document) {
      return res.status(404).json(errorResponse(
        'Documento non trovato',
        'DOCUMENT_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
    
    const sections = await db.collection('documentSections').find({
      documentId: new ObjectId(documentId),
      version: Number(version)
    }).sort({ order: 1 }).toArray();
    
    if (sections.length === 0) {
      return res.status(404).json(errorResponse(
        'Versione non trovata',
        'VERSION_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
    
    res.json(successResponse(
      {
        document,
        sections
      },
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error fetching document version:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json(errorResponse(
      'Errore nel recupero della versione',
      'GET_VERSION_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

// FAVORITES API - User favorites management (requires authentication)

export async function getFavoriteDocuments(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json(errorResponse(
        'Autenticazione richiesta',
        'AUTHENTICATION_REQUIRED',
        undefined,
        401,
        getRequestId(req)
      ));
    }

    const db = mongoose.connection.db;
    const userId = req.user.userId;

    // Get user's favorite documents
    const favorites = await db.collection('document_favorites').aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: 'documents',
          localField: 'documentId',
          foreignField: '_id',
          as: 'document'
        }
      },
      { $unwind: '$document' },
      {
        $project: {
          id: '$_id',
          title: '$document.title',
          type: '$document.type',
          slug: '$document.slug',
          group: '$document.group',
          addedAt: '$createdAt',
          excerpt: '$document.description'
        }
      },
      { $sort: { addedAt: -1 } }
    ]).toArray();

    res.json(successResponse(
      favorites,
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error fetching favorite documents:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId
    });
    res.status(500).json(errorResponse(
      'Errore nel recupero dei preferiti',
      'GET_FAVORITES_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function addDocumentToFavorites(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json(errorResponse(
        'Autenticazione richiesta',
        'AUTHENTICATION_REQUIRED',
        undefined,
        401,
        getRequestId(req)
      ));
    }

    const { type, slug } = req.params;
    
    if (!['ambientazione', 'regolamento'].includes(type)) {
      return res.status(400).json(errorResponse(
        'Tipo di documento non valido',
        'INVALID_DOCUMENT_TYPE',
        undefined,
        400,
        getRequestId(req)
      ));
    }

    const db = mongoose.connection.db;
    const userId = req.user.userId;

    // Find the document
    const document = await db.collection('documents').findOne({ type, slug });
    if (!document) {
      return res.status(404).json(errorResponse(
        'Documento non trovato',
        'DOCUMENT_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }

    // Check if already favorited
    const existingFavorite = await db.collection('document_favorites').findOne({
      userId,
      documentId: document._id
    });

    if (existingFavorite) {
      return res.status(400).json(errorResponse(
        'Documento già nei preferiti',
        'ALREADY_FAVORITED',
        undefined,
        400,
        getRequestId(req)
      ));
    }

    // Add to favorites
    await db.collection('document_favorites').insertOne({
      userId,
      documentId: document._id,
      createdAt: new Date()
    });

    res.json(successResponse(
      undefined,
      'Documento aggiunto ai preferiti',
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error adding document to favorites:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
      type: req.params?.type,
      slug: req.params?.slug
    });
    res.status(500).json(errorResponse(
      'Errore nell\'aggiunta ai preferiti',
      'ADD_FAVORITE_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function removeDocumentFromFavorites(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json(errorResponse(
        'Autenticazione richiesta',
        'AUTHENTICATION_REQUIRED',
        undefined,
        401,
        getRequestId(req)
      ));
    }

    const { type, slug } = req.params;
    
    if (!['ambientazione', 'regolamento'].includes(type)) {
      return res.status(400).json(errorResponse(
        'Tipo di documento non valido',
        'INVALID_DOCUMENT_TYPE',
        undefined,
        400,
        getRequestId(req)
      ));
    }

    const db = mongoose.connection.db;
    const userId = req.user.userId;

    // Find the document
    const document = await db.collection('documents').findOne({ type, slug });
    if (!document) {
      return res.status(404).json(errorResponse(
        'Documento non trovato',
        'DOCUMENT_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }

    // Remove from favorites
    const result = await db.collection('document_favorites').deleteOne({
      userId,
      documentId: document._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json(errorResponse(
        'Documento non presente nei preferiti',
        'FAVORITE_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }

    res.json(successResponse(
      undefined,
      'Documento rimosso dai preferiti',
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error removing document from favorites:', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
      type: req.params?.type,
      slug: req.params?.slug
    });
    res.status(500).json(errorResponse(
      'Errore nella rimozione dai preferiti',
      'REMOVE_FAVORITE_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

export async function isDocumentFavorited(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json(errorResponse(
        'Autenticazione richiesta',
        'AUTHENTICATION_REQUIRED',
        undefined,
        401,
        getRequestId(req)
      ));
    }

    const { type, slug } = req.params;
    
    if (!['ambientazione', 'regolamento'].includes(type)) {
      return res.status(400).json(errorResponse(
        'Tipo di documento non valido',
        'INVALID_DOCUMENT_TYPE',
        undefined,
        400,
        getRequestId(req)
      ));
    }

    const db = mongoose.connection.db;
    const userId = req.user.userId;

    // Find the document
    const document = await db.collection('documents').findOne({ type, slug });
    if (!document) {
      return res.status(404).json(errorResponse(
        'Documento non trovato',
        'DOCUMENT_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }

    // Check if favorited
    const favorite = await db.collection('document_favorites').findOne({
      userId,
      documentId: document._id
    });

    res.json(successResponse(
      {
        isFavorited: !!favorite
      },
      undefined,
      getRequestId(req)
    ));
  } catch (error: any) {
    logger.error('Error checking document favorite status:', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
      type: req.params?.type,
      slug: req.params?.slug
    });
    res.status(500).json(errorResponse(
      'Errore nella verifica dei preferiti',
      'CHECK_FAVORITE_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
}

/**
 * Semantic search using embeddings
 * GET /documents/semantic-search?q=query&limit=5&minSimilarity=0.5
 */
export async function semanticSearchDocuments(req: Request, res: Response) {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 5;
    const minSimilarity = parseFloat(req.query.minSimilarity as string) || 0.5;
    const type = req.query.type as DocumentType | undefined;

    if (!query) {
      return res.status(400).json(errorResponse(
        'Il parametro query q è obbligatorio',
        'MISSING_QUERY',
        undefined,
        400,
        getRequestId(req)
      ));
    }

    logger.info('Semantic search request:', {
      query,
      limit,
      minSimilarity,
      type,
      userId: req.user?.userId
    });

    // Generate embedding for the query
    const embeddingsService = getEmbeddingsService();
    const queryEmbedding = await embeddingsService.generateEmbedding(query);

    if (!queryEmbedding) {
      return res.status(503).json(errorResponse(
        'Servizio embeddings non disponibile. Installa sentence-transformers.',
        'EMBEDDINGS_SERVICE_UNAVAILABLE',
        undefined,
        503,
        getRequestId(req)
      ));
    }

    // Build query filter
    const filter: any = {
      contentEmbedding: { $exists: true, $ne: null },
      status: 'published'
    };

    // Filter by type if specified
    if (type && ['ambientazione', 'regolamento'].includes(type)) {
      filter.type = type;
    }

    // Apply visibility filter based on authentication
    if (!req.user) {
      // Public only for unauthenticated users
      filter.visibility = 'pubblico';
    } else {
      // Authenticated users can see public and restricted
      filter.visibility = { $in: ['pubblico', 'ristretto'] };
    }

    // Fetch documents with embeddings
    const db = mongoose.connection.db;
    const documents = await db.collection('documents').find(filter).toArray();

    if (documents.length === 0) {
      return res.json(successResponse(
        {
          results: [],
          totalResults: 0,
          query: query,
          message: 'Nessun documento con embeddings trovato. Esegui npm run seed per generare gli embeddings.'
        },
        undefined,
        getRequestId(req)
      ));
    }

    // Calculate similarity for each document
    interface SearchResult {
      document: any;
      similarity: number;
    }

    const results: SearchResult[] = [];

    for (const doc of documents) {
      if (doc.contentEmbedding && doc.contentEmbedding.length > 0) {
        const similarity = cosineSimilarity(queryEmbedding, doc.contentEmbedding);

        if (similarity >= minSimilarity) {
          results.push({
            document: {
              id: doc._id.toString(),
              title: doc.title,
              description: doc.description,
              slug: doc.slug,
              type: doc.type,
              group: doc.group,
              visibility: doc.visibility,
              // Return content preview (first 300 chars)
              contentPreview: doc.content ? doc.content.substring(0, 300) + '...' : null,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            },
            similarity: similarity
          });
        }
      }
    }

    // Sort by similarity (highest first)
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top N results
    const topResults = results.slice(0, limit);

    logger.info('Semantic search completed:', {
      query,
      totalMatches: results.length,
      returningTop: topResults.length
    });

    res.json(successResponse(
      {
        results: topResults.map(r => ({
          ...r.document,
          matchScore: (r.similarity * 100).toFixed(1) + '%',
          similarity: r.similarity
        })),
        totalResults: results.length,
        returnedResults: topResults.length,
        query: query,
        minSimilarity: minSimilarity
      },
      undefined,
      getRequestId(req)
    ));

  } catch (error: any) {
    logger.error('Error in semantic search:', {
      error: error instanceof Error ? error.message : String(error),
      query: req.query.q
    });
    res.status(500).json(errorResponse(
      'Errore nella ricerca semantica',
      'SEMANTIC_SEARCH_ERROR',
      { error: error.message },
      500,
      getRequestId(req)
    ));
  }
}

/**
 * Helper function to calculate cosine similarity
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}