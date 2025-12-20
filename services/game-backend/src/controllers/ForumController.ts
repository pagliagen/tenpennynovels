import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import slugify from 'slugify';

// Forum Topic Interface
interface ForumTopic {
  _id?: ObjectId;
  slug: string;
  title: string;
  description?: string;
  isPublic: boolean;
  isVisible: boolean;
  isLocked: boolean;
  isPinned: boolean;
  postCount: number;
  lastPostAt?: Date;
  lastPostBy?: {
    userId: string;
    username: string;
    characterName?: string;
    characterId?: string;
  };
  createdAt: Date;
  createdBy: {
    userId: string;
    username: string;
  };
  color?: string;
  icon?: string;
  moderators?: string[]; // User IDs who can moderate this topic
}

// Discussion Interface
interface Discussion {
  _id?: ObjectId;
  slug: string;
  topicSlug: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  isVisible: boolean;
  postCount: number;
  viewCount: number;
  lastPostAt?: Date;
  lastPostBy?: {
    userId: string;
    username: string;
    characterName?: string;
    characterId?: string;
  };
  createdAt: Date;
  createdBy: {
    userId: string;
    username: string;
    characterName?: string;
    characterId?: string;
  };
  tags?: string[];
}

// Forum Post Interface
interface ForumPost {
  _id?: ObjectId;
  topicSlug: string;
  discussionSlug: string;
  content: string;
  authorUserId: string;
  authorUsername: string;
  authorCharacterName?: string;
  authorCharacterId?: string;
  createdAt: Date;
  updatedAt?: Date;
  isEdited: boolean;
  editHistory?: {
    editedAt: Date;
    editedBy: string;
    reason?: string;
  }[];
  isPinned?: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  replyToPostId?: string;
  reactionCounts?: {
    [emoji: string]: number;
  };
}

// Utility function to create slug from title using slugify
const createSlug = (title: string): string => {
  return slugify(title, {
    lower: true,
    strict: true,
    locale: 'it',
    trim: true
  }).slice(0, 100);
};

// Check if user has admin permissions
const hasAdminPermission = (user: any, permission: string): boolean => {
  if (!user?.canAccessAdminPanel) return false;
  
  // Check new granular system first
  if (user.userRoles?.includes('gestore')) return true;
  if (user.characterPermissions?.includes(permission)) return true;
  
  return false;
};

export class ForumController {
  
  // FORUM INITIALIZATION
  
  static async getForumInit(req: Request, res: Response) {
    try {
      const db = mongoose.connection.db;
      
      // Get forum statistics
      const totalDiscussions = await db.collection('forum_discussions').countDocuments({ isVisible: true });
      const totalPosts = await db.collection('forum_posts').countDocuments({ isDeleted: false });
      
      // Check if user is authenticated (optional middleware not used)
      let authContext = {
        isAuthenticated: false,
        user: null as any,
        character: null as any
      };
      
      // Try to extract auth info if present
      const user = (req as any).user;
      const character = (req as any).character;
      
      if (user) {
        authContext.isAuthenticated = true;
        authContext.user = {
          userId: user.userId,
          username: user.username,
          email: user.email,
          canAccessAdminPanel: user.canAccessAdminPanel || false,
          // Granular permission system
          userRoles: user.userRoles || ['user'],
          characterRoles: user.characterRoles || [],
          characterPermissions: user.characterPermissions || []
        };
        
        if (character) {
          authContext.character = {
            characterId: character.characterId,
            characterName: character.characterName,
            characterSurname: character.characterSurname,
            gameplayRoles: character.gameplayRoles || [],
            isApproved: character.status === 'APPROVED'
          };
        }
      }
      
      res.json({
        success: true,
        data: {
          totalDiscussions,
          totalPosts,
          authContext
        }
      });
    } catch (error: any) {
      console.error('Error fetching forum init data:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le statistiche del forum'
      });
    }
  }
  
  // TOPIC MANAGEMENT
  
  static async getTopics(req: Request, res: Response) {
    try {
      const db = mongoose.connection.db;
      const user = (req as any).user;
      
      // Build query based on user permissions
      let query: any = { isVisible: true };
      
      // If user is not authenticated, show only public topics
      if (!user) {
        query.isPublic = true;
      }
      // If user doesn't have an approved character, show only public topics
      else if (!user.character || user.character.status !== 'APPROVED') {
        query.isPublic = true;
      }
      // If user has approved character, show both public and private
      
      const topics = await db.collection('forum_topics')
        .find(query)
        .sort({ isPinned: -1, lastPostAt: -1, createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: topics.map(topic => ({
          id: topic._id,
          slug: topic.slug,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          isPublic: topic.isPublic,
          isVisible: topic.isVisible,
          isLocked: topic.isLocked,
          isPinned: topic.isPinned,
          postCount: topic.postCount || 0,
          lastPostAt: topic.lastPostAt,
          lastPostBy: topic.lastPostBy,
          createdAt: topic.createdAt,
          createdBy: topic.createdBy,
          color: topic.color,
          icon: topic.icon
        }))
      });
    } catch (error: any) {
      console.error('Error fetching topics:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare i topic'
      });
    }
  }

  static async getTopic(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const db = mongoose.connection.db;
      const user = (req as any).user;
      
      const topic = await db.collection('forum_topics').findOne({ 
        slug, 
        isVisible: true 
      });

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic non trovato'
        });
      }

      // Check access permissions
      if (!topic.isPublic) {
        if (!user || !user.character || user.character.status !== 'APPROVED') {
          return res.status(403).json({
            success: false,
            error: 'Accesso negato: personaggio approvato richiesto'
          });
        }
      }

      res.json({
        success: true,
        data: {
          id: topic._id,
          slug: topic.slug,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          isPublic: topic.isPublic,
          isVisible: topic.isVisible,
          isLocked: topic.isLocked,
          isPinned: topic.isPinned,
          postCount: topic.postCount || 0,
          lastPostAt: topic.lastPostAt,
          lastPostBy: topic.lastPostBy,
          createdAt: topic.createdAt,
          createdBy: topic.createdBy,
          color: topic.color,
          icon: topic.icon
        }
      });
    } catch (error: any) {
      console.error('Error fetching topic:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare il topic'
      });
    }
  }

  static async createTopic(req: Request, res: Response) {
    try {
      const { title, description, isPublic, color, icon } = req.body;
      const user = (req as any).user;
      
      // Check permissions
      if (!hasAdminPermission(user, 'canManageForums')) {
        return res.status(403).json({
          success: false,
          error: 'Accesso negato: gestione forum richiesta'
        });
      }

      if (!title || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Il titolo è obbligatorio'
        });
      }

      const slug = createSlug(title);
      const db = mongoose.connection.db;

      // Check if slug already exists
      const existingTopic = await db.collection('forum_topics').findOne({ slug });
      if (existingTopic) {
        return res.status(409).json({
          success: false,
          error: 'Esiste già un topic con questo titolo'
        });
      }

      const topic: ForumTopic = {
        slug,
        title: title.trim(),
        description: description?.trim(),
        isPublic: !!isPublic,
        isVisible: true,
        isLocked: false,
        isPinned: false,
        postCount: 0,
        createdAt: new Date(),
        createdBy: {
          userId: user.userId,
          username: user.username
        },
        color,
        icon
      };

      const result = await db.collection('forum_topics').insertOne(topic);

      res.status(201).json({
        success: true,
        data: {
          id: result.insertedId,
          ...topic
        }
      });
    } catch (error: any) {
      console.error('Error creating topic:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile creare il topic'
      });
    }
  }

  // DISCUSSION MANAGEMENT

  static async getDiscussions(req: Request, res: Response) {
    try {
      const { topicSlug } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;
      
      const db = mongoose.connection.db;
      const user = (req as any).user;
      
      // Check topic access
      const topic = await db.collection('forum_topics').findOne({ 
        slug: topicSlug, 
        isVisible: true 
      });

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic non trovato'
        });
      }

      if (!topic.isPublic) {
        if (!user || !user.character || user.character.status !== 'APPROVED') {
          return res.status(403).json({
            success: false,
            error: 'Accesso negato: personaggio approvato richiesto'
          });
        }
      }

      // Get discussions
      const discussions = await db.collection('forum_discussions')
        .find({ topicSlug, isVisible: true })
        .sort({ isPinned: -1, lastPostAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await db.collection('forum_discussions')
        .countDocuments({ topicSlug, isVisible: true });

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: discussions.map(d => ({
          id: d._id,
          slug: d.slug,
          topicSlug: d.topicSlug,
          title: d.title,
          isPinned: d.isPinned,
          isLocked: d.isLocked,
          isVisible: d.isVisible,
          postCount: d.postCount || 0,
          viewCount: d.viewCount || 0,
          lastPostAt: d.lastPostAt,
          lastPostBy: d.lastPostBy,
          createdAt: d.createdAt,
          createdBy: d.createdBy,
          tags: d.tags || []
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error: any) {
      console.error('Error fetching discussions:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le discussioni'
      });
    }
  }

  static async getDiscussion(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const db = mongoose.connection.db;
      const user = (req as any).user;
      
      // Check topic access first
      const topic = await db.collection('forum_topics').findOne({ 
        slug: topicSlug, 
        isVisible: true 
      });

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic non trovato'
        });
      }

      if (!topic.isPublic) {
        if (!user || !user.character || user.character.status !== 'APPROVED') {
          return res.status(403).json({
            success: false,
            error: 'Accesso negato: personaggio approvato richiesto'
          });
        }
      }

      // Get discussion
      const discussion = await db.collection('forum_discussions').findOne({
        topicSlug,
        slug: discussionSlug,
        isVisible: true
      });

      if (!discussion) {
        return res.status(404).json({
          success: false,
          error: 'Discussione non trovata'
        });
      }

      // Increment view count
      await db.collection('forum_discussions').updateOne(
        { _id: discussion._id },
        { $inc: { viewCount: 1 } }
      );

      res.json({
        success: true,
        data: {
          id: discussion._id,
          slug: discussion.slug,
          topicSlug: discussion.topicSlug,
          title: discussion.title,
          isPinned: discussion.isPinned,
          isLocked: discussion.isLocked,
          isVisible: discussion.isVisible,
          postCount: discussion.postCount || 0,
          viewCount: (discussion.viewCount || 0) + 1,
          lastPostAt: discussion.lastPostAt,
          lastPostBy: discussion.lastPostBy,
          createdAt: discussion.createdAt,
          createdBy: discussion.createdBy,
          tags: discussion.tags || []
        }
      });
    } catch (error: any) {
      console.error('Error fetching discussion:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare la discussione'
      });
    }
  }

  static async createDiscussion(req: Request, res: Response) {
    try {
      const { topicSlug } = req.params;
      const { title, content, tags } = req.body;
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Autenticazione richiesta'
        });
      }

      // Check topic access
      const db = mongoose.connection.db;
      const topic = await db.collection('forum_topics').findOne({ 
        slug: topicSlug, 
        isVisible: true 
      });

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic non trovato'
        });
      }

      if (!topic.isPublic && (!user.character || user.character.status !== 'APPROVED')) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: approved character required'
        });
      }

      if (topic.isLocked && !hasAdminPermission(user, 'canManageForums')) {
        return res.status(403).json({
          success: false,
          error: 'Il topic è bloccato'
        });
      }

      if (!title || !content || title.trim().length === 0 || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Titolo e contenuto sono obbligatori'
        });
      }

      const slug = createSlug(title);
      
      // Check if slug already exists in this topic
      const existingDiscussion = await db.collection('forum_discussions').findOne({ 
        topicSlug, 
        slug 
      });
      
      if (existingDiscussion) {
        return res.status(409).json({
          success: false,
          error: 'Esiste già una discussione con questo titolo in questo topic'
        });
      }

      const now = new Date();
      const authorInfo = {
        userId: user.userId,
        username: user.username,
        characterName: user.character?.characterName,
        characterId: user.character?.characterId
      };

      // Create discussion
      const discussion: Discussion = {
        slug,
        topicSlug,
        title: title.trim(),
        isPinned: false,
        isLocked: false,
        isVisible: true,
        postCount: 1,
        viewCount: 0,
        lastPostAt: now,
        lastPostBy: authorInfo,
        createdAt: now,
        createdBy: authorInfo,
        tags: Array.isArray(tags) ? tags.filter(t => t && t.trim()) : []
      };

      const discussionResult = await db.collection('forum_discussions').insertOne(discussion);

      // Create first post
      const post: ForumPost = {
        topicSlug,
        discussionSlug: slug,
        content: content.trim(),
        authorUserId: user.userId,
        authorUsername: user.username,
        authorCharacterName: user.character?.characterName,
        authorCharacterId: user.character?.characterId,
        createdAt: now,
        isEdited: false,
        isDeleted: false
      };

      await db.collection('forum_posts').insertOne(post);

      // Update topic stats
      await db.collection('forum_topics').updateOne(
        { slug: topicSlug },
        {
          $inc: { postCount: 1 },
          $set: {
            lastPostAt: now,
            lastPostBy: authorInfo
          }
        }
      );

      res.status(201).json({
        success: true,
        data: {
          id: discussionResult.insertedId,
          ...discussion
        }
      });
    } catch (error: any) {
      console.error('Error creating discussion:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile creare la discussione'
      });
    }
  }

  // POST MANAGEMENT

  static async getPosts(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;
      
      const db = mongoose.connection.db;
      const user = (req as any).user;
      
      // Check access permissions
      const topic = await db.collection('forum_topics').findOne({ 
        slug: topicSlug, 
        isVisible: true 
      });

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic non trovato'
        });
      }

      if (!topic.isPublic) {
        if (!user || !user.character || user.character.status !== 'APPROVED') {
          return res.status(403).json({
            success: false,
            error: 'Accesso negato: personaggio approvato richiesto'
          });
        }
      }

      const discussion = await db.collection('forum_discussions').findOne({
        topicSlug,
        slug: discussionSlug,
        isVisible: true
      });

      if (!discussion) {
        return res.status(404).json({
          success: false,
          error: 'Discussione non trovata'
        });
      }

      // Get posts
      const posts = await db.collection('forum_posts')
        .find({ 
          topicSlug, 
          discussionSlug, 
          isDeleted: false 
        })
        .sort({ isPinned: -1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await db.collection('forum_posts')
        .countDocuments({ 
          topicSlug, 
          discussionSlug, 
          isDeleted: false 
        });

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: posts.map(p => ({
          id: p._id,
          topicSlug: p.topicSlug,
          discussionSlug: p.discussionSlug,
          content: p.content,
          authorUserId: p.authorUserId,
          authorUsername: p.authorUsername,
          authorCharacterName: p.authorCharacterName,
          authorCharacterId: p.authorCharacterId,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          isEdited: p.isEdited,
          editHistory: p.editHistory,
          isPinned: p.isPinned,
          isDeleted: p.isDeleted,
          replyToPostId: p.replyToPostId,
          reactionCounts: p.reactionCounts
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare i post'
      });
    }
  }

  static async createPost(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const { content, replyToPostId } = req.body;
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Autenticazione richiesta'
        });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Il contenuto è obbligatorio'
        });
      }

      const db = mongoose.connection.db;
      
      // Check access permissions
      const topic = await db.collection('forum_topics').findOne({ 
        slug: topicSlug, 
        isVisible: true 
      });

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic non trovato'
        });
      }

      if (!topic.isPublic && (!user.character || user.character.status !== 'APPROVED')) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: approved character required'
        });
      }

      const discussion = await db.collection('forum_discussions').findOne({
        topicSlug,
        slug: discussionSlug,
        isVisible: true
      });

      if (!discussion) {
        return res.status(404).json({
          success: false,
          error: 'Discussione non trovata'
        });
      }

      if (topic.isLocked || discussion.isLocked) {
        if (!hasAdminPermission(user, 'canManageForums')) {
          return res.status(403).json({
            success: false,
            error: 'La discussione è bloccata'
          });
        }
      }

      const now = new Date();
      const authorInfo = {
        userId: user.userId,
        username: user.username,
        characterName: user.character?.characterName,
        characterId: user.character?.characterId
      };

      // Create post
      const post: ForumPost = {
        topicSlug,
        discussionSlug,
        content: content.trim(),
        authorUserId: user.userId,
        authorUsername: user.username,
        authorCharacterName: user.character?.characterName,
        authorCharacterId: user.character?.characterId,
        createdAt: now,
        isEdited: false,
        isDeleted: false,
        replyToPostId: replyToPostId || undefined
      };

      const result = await db.collection('forum_posts').insertOne(post);

      // Update discussion stats
      await db.collection('forum_discussions').updateOne(
        { topicSlug, slug: discussionSlug },
        {
          $inc: { postCount: 1 },
          $set: {
            lastPostAt: now,
            lastPostBy: authorInfo
          }
        }
      );

      // Update topic stats
      await db.collection('forum_topics').updateOne(
        { slug: topicSlug },
        {
          $inc: { postCount: 1 },
          $set: {
            lastPostAt: now,
            lastPostBy: authorInfo
          }
        }
      );

      res.status(201).json({
        success: true,
        data: {
          id: result.insertedId,
          ...post
        }
      });
    } catch (error: any) {
      console.error('Error creating post:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile creare il post'
      });
    }
  }

  // RECENT AND POPULAR DISCUSSIONS

  static async getRecentDiscussions(req: Request, res: Response) {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const user = (req as any).user;
      const db = mongoose.connection.db;
      
      // Build access control filters
      let topicFilters: any = { isVisible: true };
      
      // If user doesn't have approved character, show only public topics
      if (!user || !user.character || user.character.status !== 'APPROVED') {
        topicFilters.isPublic = true;
      }
      
      // Get accessible topic slugs
      const accessibleTopics = await db.collection('forum_topics')
        .find(topicFilters, { projection: { slug: 1 } })
        .toArray();
      
      const accessibleTopicSlugs = accessibleTopics.map(t => t.slug);
      
      // Get recent discussions from accessible topics
      const discussions = await db.collection('forum_discussions')
        .find({
          topicSlug: { $in: accessibleTopicSlugs },
          isVisible: true
        })
        .sort({ lastPostAt: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      const totalCount = await db.collection('forum_discussions')
        .countDocuments({
          topicSlug: { $in: accessibleTopicSlugs },
          isVisible: true
        });

      res.json({
        success: true,
        data: discussions.map(d => ({
          id: d._id,
          slug: d.slug,
          topicSlug: d.topicSlug,
          title: d.title,
          isPinned: d.isPinned,
          isLocked: d.isLocked,
          isVisible: d.isVisible,
          postCount: d.postCount || 0,
          viewCount: d.viewCount || 0,
          lastPostAt: d.lastPostAt,
          lastPostBy: d.lastPostBy,
          createdAt: d.createdAt,
          createdBy: d.createdBy,
          tags: d.tags || []
        })),
        pagination: {
          page: 1,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    } catch (error: any) {
      console.error('Error fetching recent discussions:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le discussioni recenti'
      });
    }
  }

  static async getPopularDiscussions(req: Request, res: Response) {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const timeframe = req.query.timeframe as string || 'week';
      const user = (req as any).user;
      const db = mongoose.connection.db;
      
      // Calculate timeframe cutoff
      const now = new Date();
      let cutoffDate: Date;
      
      switch (timeframe) {
        case 'week':
          cutoffDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
        case 'all':
        default:
          cutoffDate = new Date(0); // Beginning of time
          break;
      }
      
      // Build access control filters
      let topicFilters: any = { isVisible: true };
      
      // If user doesn't have approved character, show only public topics
      if (!user || !user.character || user.character.status !== 'APPROVED') {
        topicFilters.isPublic = true;
      }
      
      // Get accessible topic slugs
      const accessibleTopics = await db.collection('forum_topics')
        .find(topicFilters, { projection: { slug: 1 } })
        .toArray();
      
      const accessibleTopicSlugs = accessibleTopics.map(t => t.slug);
      
      // Get popular discussions from accessible topics
      // Sort by a popularity score: (viewCount * 1) + (postCount * 3)
      const discussions = await db.collection('forum_discussions')
        .aggregate([
          {
            $match: {
              topicSlug: { $in: accessibleTopicSlugs },
              isVisible: true,
              createdAt: { $gte: cutoffDate }
            }
          },
          {
            $addFields: {
              popularityScore: {
                $add: [
                  { $ifNull: ['$viewCount', 0] },
                  { $multiply: [{ $ifNull: ['$postCount', 0] }, 3] }
                ]
              }
            }
          },
          {
            $sort: { popularityScore: -1, viewCount: -1, postCount: -1 }
          },
          {
            $limit: limit
          }
        ])
        .toArray();

      const totalCount = await db.collection('forum_discussions')
        .countDocuments({
          topicSlug: { $in: accessibleTopicSlugs },
          isVisible: true,
          createdAt: { $gte: cutoffDate }
        });

      res.json({
        success: true,
        data: discussions.map(d => ({
          id: d._id,
          slug: d.slug,
          topicSlug: d.topicSlug,
          title: d.title,
          isPinned: d.isPinned,
          isLocked: d.isLocked,
          isVisible: d.isVisible,
          postCount: d.postCount || 0,
          viewCount: d.viewCount || 0,
          lastPostAt: d.lastPostAt,
          lastPostBy: d.lastPostBy,
          createdAt: d.createdAt,
          createdBy: d.createdBy,
          tags: d.tags || [],
          popularityScore: d.popularityScore
        })),
        pagination: {
          page: 1,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    } catch (error: any) {
      console.error('Error fetching popular discussions:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le discussioni popolari'
      });
    }
  }

  // FAVORITES

  static async getUserFavoriteTopics(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Autenticazione richiesta'
        });
      }

      const db = mongoose.connection.db;
      
      // Get user's favorite topics
      const favoriteTopics = await db.collection('forum_topic_favorites')
        .find({ userId: user.userId })
        .toArray();
      
      if (favoriteTopics.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }
      
      const favoriteTopicSlugs = favoriteTopics.map(f => f.topicSlug);
      
      // Get topic details for favorites (only those user has access to)
      let accessFilters: any = { 
        slug: { $in: favoriteTopicSlugs },
        isVisible: true 
      };
      
      // If user doesn't have approved character, show only public topics
      if (!user.character || user.character.status !== 'APPROVED') {
        accessFilters.isPublic = true;
      }
      
      const topics = await db.collection('forum_topics')
        .find(accessFilters)
        .sort({ isPinned: -1, lastPostAt: -1, createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: topics.map(topic => ({
          id: topic._id,
          slug: topic.slug,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          isPublic: topic.isPublic,
          isVisible: topic.isVisible,
          isLocked: topic.isLocked,
          isPinned: topic.isPinned,
          postCount: topic.postCount || 0,
          lastPostAt: topic.lastPostAt,
          lastPostBy: topic.lastPostBy,
          createdAt: topic.createdAt,
          createdBy: topic.createdBy,
          color: topic.color,
          icon: topic.icon,
          isFavorite: true
        }))
      });
    } catch (error: any) {
      console.error('Error fetching user favorite topics:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare i topic preferiti'
      });
    }
  }

  static async addTopicToFavorites(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Autenticazione richiesta'
        });
      }

      const db = mongoose.connection.db;
      
      // Check if topic exists and user has access
      const topic = await db.collection('forum_topics').findOne({ 
        slug, 
        isVisible: true 
      });

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic non trovato'
        });
      }

      // Check access permissions
      if (!topic.isPublic) {
        if (!user.character || user.character.status !== 'APPROVED') {
          return res.status(403).json({
            success: false,
            error: 'Accesso negato: personaggio approvato richiesto'
          });
        }
      }

      // Check if already favorited
      const existingFavorite = await db.collection('forum_topic_favorites').findOne({
        userId: user.userId,
        topicSlug: slug
      });

      if (existingFavorite) {
        return res.status(409).json({
          success: false,
          error: 'Topic già nei preferiti'
        });
      }

      // Add to favorites
      await db.collection('forum_topic_favorites').insertOne({
        userId: user.userId,
        username: user.username,
        topicSlug: slug,
        topicTitle: topic.title,
        createdAt: new Date()
      });

      res.status(201).json({
        success: true,
        data: {
          message: 'Topic aggiunto ai preferiti',
          topicSlug: slug,
          isFavorite: true
        }
      });
    } catch (error: any) {
      console.error('Error adding topic to favorites:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile aggiungere il topic ai preferiti'
      });
    }
  }

  static async removeTopicFromFavorites(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Autenticazione richiesta'
        });
      }

      const db = mongoose.connection.db;
      
      // Remove from favorites
      const result = await db.collection('forum_topic_favorites').deleteOne({
        userId: user.userId,
        topicSlug: slug
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Topic non trovato nei preferiti'
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Topic rimosso dai preferiti',
          topicSlug: slug,
          isFavorite: false
        }
      });
    } catch (error: any) {
      console.error('Error removing topic from favorites:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile rimuovere il topic dai preferiti'
      });
    }
  }

  static async checkTopicFavorite(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const user = (req as any).user;
      
      if (!user) {
        return res.json({
          success: true,
          data: { isFavorite: false }
        });
      }

      const db = mongoose.connection.db;
      
      const favorite = await db.collection('forum_topic_favorites').findOne({
        userId: user.userId,
        topicSlug: slug
      });

      res.json({
        success: true,
        data: { isFavorite: !!favorite }
      });
    } catch (error: any) {
      console.error('Error checking topic favorite status:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile verificare lo stato preferito'
      });
    }
  }

  // SEARCH

  static async searchForum(req: Request, res: Response) {
    try {
      const { 
        q: query, 
        topic: topicSlug, 
        sortBy = 'relevance',
        fuzzy = 'true'
      } = req.query;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;
      
      const user = (req as any).user;
      
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'La query di ricerca è obbligatoria'
        });
      }

      const db = mongoose.connection.db;
      
      // Enhanced query processing
      const processedQuery = ForumController.processSearchQuery(query.trim(), fuzzy === 'true');
      
      // Build search filters with enhanced text search
      let searchFilters: any = {
        isDeleted: false
      };

      // Apply the processed search query
      if (processedQuery.textSearch) {
        searchFilters.$text = processedQuery.textSearch;
      }
      
      // Apply additional filters (regex for non-text search fields)
      if (processedQuery.regexFilters.length > 0) {
        searchFilters.$or = [
          ...(searchFilters.$text ? [{ $text: searchFilters.$text }] : []),
          ...processedQuery.regexFilters
        ];
        delete searchFilters.$text; // Move to $or clause
      }
      
      // If topic is specified, filter by topic
      if (topicSlug && typeof topicSlug === 'string') {
        searchFilters.topicSlug = topicSlug;
      }
      
      // Build access control filters
      let accessFilters: any = {};
      
      // For private topics, require approved character
      if (!user || !user.character || user.character.status !== 'APPROVED') {
        const publicTopics = await db.collection('forum_topics')
          .find({ isPublic: true, isVisible: true }, { projection: { slug: 1 } })
          .toArray();
        
        const publicTopicSlugs = publicTopics.map(t => t.slug);
        accessFilters.topicSlug = { $in: publicTopicSlugs };
      }
      
      // Combine filters
      const finalFilters = { ...searchFilters, ...accessFilters };
      
      // Determine sort order
      let sortOrder: any;
      switch (sortBy) {
        case 'date':
          sortOrder = { createdAt: -1 };
          break;
        case 'relevance':
        default:
          sortOrder = processedQuery.textSearch 
            ? { score: { $meta: 'textScore' }, createdAt: -1 }
            : { createdAt: -1 };
      }
      
      // Search posts with enhanced aggregation for better results
      const posts = await db.collection('forum_posts')
        .find(finalFilters, { score: { $meta: 'textScore' } })
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await db.collection('forum_posts')
        .countDocuments(finalFilters);

      const totalPages = Math.ceil(total / limit);

      // Get search suggestions if results are limited
      let suggestions = [];
      if (total < 3 && query.length > 3) {
        suggestions = await ForumController.generateSearchSuggestions(db, query, accessFilters);
      }

      res.json({
        success: true,
        data: posts.map(p => ({
          id: p._id,
          topicSlug: p.topicSlug,
          discussionSlug: p.discussionSlug,
          content: p.content,
          title: p.title,
          authorUserId: p.authorUserId,
          authorUsername: p.authorUsername,
          authorCharacterName: p.authorCharacterName,
          authorCharacterId: p.authorCharacterId,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          isEdited: p.isEdited,
          isDeleted: p.isDeleted,
          replyToPostId: p.replyToPostId,
          relevanceScore: p.score || 0
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        meta: {
          query: query.trim(),
          processedQuery: processedQuery.originalQuery,
          sortBy,
          fuzzyEnabled: fuzzy === 'true',
          suggestions: suggestions.length > 0 ? suggestions : undefined
        }
      });
    } catch (error: any) {
      console.error('Error searching forum:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile effettuare la ricerca nel forum'
      });
    }
  }

  /**
   * Process and enhance search query with advanced operators
   */
  private static processSearchQuery(query: string, enableFuzzy: boolean = true) {
    let processedQuery = query;
    const regexFilters: any[] = [];
    
    // Handle quoted phrases - exact match
    const phraseMatches = query.match(/"([^"]+)"/g);
    if (phraseMatches) {
      phraseMatches.forEach(phrase => {
        const cleanPhrase = phrase.replace(/"/g, '');
        processedQuery = processedQuery.replace(phrase, `"${cleanPhrase}"`);
      });
    }
    
    // Handle negation - exclude terms with minus
    const negationMatches = query.match(/-(\w+)/g);
    if (negationMatches) {
      negationMatches.forEach(negation => {
        const term = negation.substring(1);
        processedQuery = processedQuery.replace(negation, `-${term}`);
      });
    }
    
    // Handle OR operator
    processedQuery = processedQuery.replace(/\sOR\s/gi, ' OR ');
    
    // Add fuzzy search if enabled (for typo tolerance)
    if (enableFuzzy && !processedQuery.includes('"') && !processedQuery.includes('OR')) {
      const words = processedQuery.split(' ').filter(w => w.length > 3 && !w.startsWith('-'));
      if (words.length > 0) {
        const fuzzyTerms = words.map(word => `${word}~1`).join(' ');
        processedQuery = `${processedQuery} ${fuzzyTerms}`;
      }
    }
    
    return {
      originalQuery: query,
      textSearch: { $search: processedQuery, $language: 'italian', $caseSensitive: false },
      regexFilters
    };
  }

  /**
   * Generate search suggestions based on existing content
   */
  private static async generateSearchSuggestions(db: any, query: string, accessFilters: any) {
    try {
      const suggestions = [];
      
      // Get common words from titles and content
      const aggregation = [
        { $match: { isDeleted: false, ...accessFilters } },
        {
          $project: {
            words: {
              $split: [
                { $toLower: { $concat: ['$title', ' ', '$content'] } },
                ' '
              ]
            }
          }
        },
        { $unwind: '$words' },
        { $match: { words: { $regex: new RegExp(query, 'i'), $ne: '' } } },
        { $group: { _id: '$words', count: { $sum: 1 } } },
        { $match: { '_id': { $regex: /^[a-zA-ZÀ-ÿ]{3,}$/ } } }, // Only alphabetic words 3+ chars (including Italian accents)
        { $sort: { count: -1 } },
        { $limit: 5 }
      ];
      
      const results = await db.collection('forum_posts').aggregate(aggregation).toArray();
      
      return results.map(r => ({
        term: r._id,
        frequency: r.count
      }));
    } catch (error: any) {
      console.error('Error generating suggestions:', error);
      return [];
    }
  }

  // SEARCH ANALYTICS
  
  static async getSearchStats(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const db = mongoose.connection.db;
      
      // Build access control filters
      let accessFilters: any = {};
      if (!user || !user.character || user.character.status !== 'APPROVED') {
        const publicTopics = await db.collection('forum_topics')
          .find({ isPublic: true, isVisible: true }, { projection: { slug: 1 } })
          .toArray();
        const publicTopicSlugs = publicTopics.map(t => t.slug);
        accessFilters.topicSlug = { $in: publicTopicSlugs };
      }

      // Get most frequent words from titles and content (simplified approach)
      const commonWords = await db.collection('forum_posts').aggregate([
        { $match: { isDeleted: false, ...accessFilters } },
        {
          $project: {
            text: { $toLower: { $concat: [{ $ifNull: ['$title', ''] }, ' ', '$content'] } }
          }
        },
        {
          $project: {
            words: { $split: ['$text', ' '] }
          }
        },
        { $unwind: '$words' },
        { 
          $match: { 
            words: { 
              $regex: '^[a-zA-ZÀ-ÿ]{4,}$',
              $nin: [
                // Italian stop words
                'alla', 'alle', 'allo', 'anche', 'anni', 'anno', 'avere', 'casa', 'come', 'cosa', 
                'così', 'dalla', 'dalle', 'dello', 'dopo', 'dove', 'essere', 'fare', 'grande',
                'già', 'infatti', 'insieme', 'lungo', 'molto', 'nella', 'nelle', 'nello',
                'oltre', 'paese', 'parte', 'però', 'più', 'prima', 'quale', 'quando',
                'quindi', 'stesso', 'sempre', 'sotto', 'ancora', 'attraverso', 'durante',
                'mentre', 'proprio', 'proprio', 'tuttavia', 'invece', 'sopra', 'dentro',
                'davanti', 'dietro', 'accanto', 'vicino', 'lontano', 'tempo', 'volta',
                // English common words (still present in some content)
                'this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'said', 
                'each', 'which', 'their', 'time', 'more', 'very', 'when', 'come', 'here', 
                'where', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 
                'than', 'them', 'well', 'were'
              ]
            }
          }
        },
        { $group: { _id: '$words', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 }
      ]).toArray();

      // Get topic activity stats
      const topicStats = await db.collection('forum_posts').aggregate([
        { $match: { isDeleted: false, ...accessFilters } },
        { 
          $group: { 
            _id: '$topicSlug', 
            postCount: { $sum: 1 },
            lastActivity: { $max: '$createdAt' }
          } 
        },
        { $sort: { postCount: -1 } },
        { $limit: 10 }
      ]).toArray();

      res.json({
        success: true,
        data: {
          popularTerms: commonWords.map(w => ({
            term: w._id,
            frequency: w.count
          })),
          activeTopics: topicStats.map(t => ({
            slug: t._id,
            postCount: t.postCount,
            lastActivity: t.lastActivity
          })),
          totalPosts: await db.collection('forum_posts').countDocuments({ isDeleted: false, ...accessFilters }),
          indexedAt: new Date()
        }
      });

    } catch (error: any) {
      console.error('Error getting search stats:', error);
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le statistiche di ricerca'
      });
    }
  }
}