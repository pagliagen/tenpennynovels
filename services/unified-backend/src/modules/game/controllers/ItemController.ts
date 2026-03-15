import { Request, Response } from 'express';
import { Item } from '@database/models/Item';
import { Location } from '@database/models/Location';
import { Character } from '@database/models/Character';
import { escapeRegex } from '@shared/utils/validation';
import { logger } from '../logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';


export class ItemController {

  static async getAvailableItems(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { 
        category, 
        locationId, 
        maxPrice, 
        minPrice, 
        search,
        includeUnavailable = 'false',
        sortBy = 'name',
        sortOrder = 'asc',
        page = 1, 
        limit = 20 
      } = req.query;

      // Build filter
      const filter: any = {};
      
      // Only show publicly available items or items available at specific locations
      if (includeUnavailable !== 'true') {
        if (locationId) {
          // Items available at specific location OR public items
          filter.$or = [
            { isPublic: true },
            { availableLocations: locationId }
          ];
        } else {
          // Only public items if no location specified
          filter.isPublic = true;
        }
        
        // Never show admin-only items to players
        filter.isAdminOnly = { $ne: true };
      }

      if (category) filter.category = category;
      if (maxPrice) filter.basePrice = { ...filter.basePrice, $lte: Number(maxPrice) };
      if (minPrice) filter.basePrice = { ...filter.basePrice, $gte: Number(minPrice) };
      
      if (search) {
        const escapedSearch = escapeRegex(search as string);
        filter.$or = [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } },
          { subcategory: { $regex: escapedSearch, $options: 'i' } }
        ];
      }

      // Build sort
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const items = await Item.find(filter)
        .populate('availableLocations', 'name type parentLocationId')
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await Item.countDocuments(filter);

      // Get character for eligibility checks
      const character = await Character.findById(characterId);
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

      // Check character prerequisites for each item
      const itemsWithEligibility = await Promise.all(items.map(async (item) => {
        const eligibility = await checkItemEligibility(character, item);
        
        return {
          id: item._id,
          name: item.name,
          description: item.description,
          category: item.category,
          subcategory: item.subcategory,
          imageUrl: item.imageUrl,
          basePrice: item.basePrice,
          priceFormatted: formatPrice(item.basePrice),
          isPublic: item.isPublic,
          availableLocations: item.availableLocations.map((loc: any) => ({
            id: loc._id,
            name: loc.name,
            type: loc.type
          })),
          isStackable: item.isStackable || false,
          maxStack: item.maxStack || 1,
          
          // Character eligibility
          canPurchase: eligibility.canPurchase,
          eligibilityReasons: eligibility.reasons,
          missingPrerequisites: eligibility.missingPrerequisites
        };
      }));

      logger.info('Available items retrieved', {
        characterId: character._id,
        totalItems: total,
        filteredItems: itemsWithEligibility.length,
        filters: { category, locationId, maxPrice, minPrice, search }
      });

      res.json(listResponse(
        itemsWithEligibility,
        {
          page: Number(page),
          pageSize: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
          hasNext: Number(page) < Math.ceil(total / Number(limit)),
          hasPrev: Number(page) > 1
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving available items:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getItemDetails(req: Request<{ itemId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { itemId } = req.params;

      const item = await Item.findById(itemId)
        .populate('availableLocations', 'name type description');

      if (!item) {
        res.status(404).json(errorResponse(
          'Oggetto non trovato',
          'ITEM_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if item is accessible to player (not admin-only)
      if (item.isAdminOnly) {
        res.status(403).json(errorResponse(
          'Oggetto non disponibile per l\'acquisto',
          'ITEM_NOT_AVAILABLE',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get character for eligibility checks
      const character = await Character.findById(characterId);
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

      // Check character eligibility
      const eligibility = await checkItemEligibility(character, item);

      const itemDetails = {
        id: item._id,
        name: item.name,
        description: item.description,
        category: item.category,
        subcategory: item.subcategory,
        imageUrl: item.imageUrl,
        
        // Pricing information
        basePrice: item.basePrice,
        priceFormatted: formatPrice(item.basePrice),
        
        // Availability
        isPublic: item.isPublic,
        availableLocations: item.availableLocations.map((loc: any) => ({
          id: loc._id,
          name: loc.name,
          type: loc.type,
          description: loc.description
        })),
        
        // Item properties
        isStackable: item.isStackable || false,
        maxStack: item.maxStack || 1,
        
        // Usage properties
        isConsumable: item.category === 'consumables' || item.category === 'food_drink',
        requiresEquipping: ['clothing', 'accessories', 'weapons', 'tools'].includes(item.category),
        
        // Prerequisites
        prerequisites: item.prerequisites ? {
          minimumStats: item.prerequisites.minimumStats,
          minimumSkills: item.prerequisites.minimumSkills,
          requiredOccupations: item.prerequisites.requiredOccupations,
          requiredGender: item.prerequisites.requiredGender,
          minimumAge: item.prerequisites.minimumAge,
          maximumAge: item.prerequisites.maximumAge
        } : null,

        // Character-specific information
        characterEligibility: {
          canPurchase: eligibility.canPurchase,
          reasons: eligibility.reasons,
          missingPrerequisites: eligibility.missingPrerequisites
        },

        // Related items (same category)
        relatedCategories: await getRelatedCategories(item.category, item.subcategory)
      };

      logger.info('Item details retrieved', {
        itemId: item._id,
        characterId: character._id,
        canPurchase: eligibility.canPurchase
      });

      res.json(successResponse(
        {
          item: itemDetails
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving item details:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getItemCategories(req: Request, res: Response): Promise<void> {
    try {
      // Get categories with counts and price ranges
      const categories = await Item.aggregate([
        {
          $match: { 
            isAdminOnly: { $ne: true },
            $or: [{ isPublic: true }, { availableLocations: { $exists: true, $ne: [] } }]
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgPrice: { $avg: '$basePrice' },
            minPrice: { $min: '$basePrice' },
            maxPrice: { $max: '$basePrice' },
            subcategories: { $addToSet: '$subcategory' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            avgPrice: { $round: ['$avgPrice', 0] },
            minPrice: 1,
            maxPrice: 1,
            subcategories: {
              $filter: {
                input: '$subcategories',
                cond: { $ne: ['$$this', null] }
              }
            }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const formattedCategories = categories.map(cat => ({
        category: cat.category,
        count: cat.count,
        priceRange: {
          min: cat.minPrice,
          max: cat.maxPrice,
          average: cat.avgPrice,
          formatted: {
            min: formatPrice(cat.minPrice),
            max: formatPrice(cat.maxPrice),
            average: formatPrice(cat.avgPrice)
          }
        },
        subcategories: cat.subcategories,
        description: getCategoryDescription(cat.category)
      }));

      res.json(successResponse(
        {
          categories: formattedCategories,
          totalCategories: categories.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving item categories:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getLocationItems(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { locationId } = req.params;
      const { category, sortBy = 'name', sortOrder = 'asc' } = req.query;

      // Verify location exists
      const location = await Location.findById(locationId);
      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Build filter for items available at this location
      const filter: any = {
        isAdminOnly: { $ne: true },
        $or: [
          { isPublic: true },
          { availableLocations: locationId }
        ]
      };

      if (category) filter.category = category;

      // Build sort
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const items = await Item.find(filter).sort(sort);

      // Get character for eligibility checks
      const character = await Character.findById(characterId);
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

      const itemsWithEligibility = await Promise.all(items.map(async (item) => {
        const eligibility = await checkItemEligibility(character, item);
        
        return {
          id: item._id,
          name: item.name,
          description: item.description,
          category: item.category,
          subcategory: item.subcategory,
          basePrice: item.basePrice,
          priceFormatted: formatPrice(item.basePrice),
          canPurchase: eligibility.canPurchase,
          eligibilityReasons: eligibility.reasons
        };
      }));

      logger.info('Location items retrieved', {
        locationId,
        itemCount: itemsWithEligibility.length,
        characterId: character._id
      });

      res.json(successResponse(
        {
          location: {
            id: location._id,
            name: location.name,
            locationLevel: location.locationLevel,
            description: location.description
          },
          items: itemsWithEligibility,
          totalItems: itemsWithEligibility.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving location items:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async searchItems(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { q: query, category, maxPrice, limit = 10 } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        res.status(400).json(errorResponse(
          'La query di ricerca deve contenere almeno 2 caratteri',
          'INVALID_SEARCH_QUERY',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const filter: any = {
        isAdminOnly: { $ne: true },
        $or: [{ isPublic: true }, { availableLocations: { $exists: true, $ne: [] } }],
        $text: { $search: query.trim() }
      };

      if (category) filter.category = category;
      if (maxPrice) filter.basePrice = { $lte: Number(maxPrice) };

      const items = await Item.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(Number(limit));

      const searchResults = items.map(item => ({
        id: item._id,
        name: item.name,
        description: item.description.substring(0, 100) + (item.description.length > 100 ? '...' : ''),
        category: item.category,
        subcategory: item.subcategory,
        basePrice: item.basePrice,
        priceFormatted: formatPrice(item.basePrice),
      }));

      logger.info('Item search performed', {
        query,
        resultsCount: searchResults.length,
        characterId
      });

      res.json(successResponse(
        {
          query,
          results: searchResults,
          totalResults: searchResults.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error searching items:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}

// Helper function to check if character meets item prerequisites
async function checkItemEligibility(character: any, item: any): Promise<{
  canPurchase: boolean;
  reasons: string[];
  missingPrerequisites?: any[];
}> {
  const reasons: string[] = [];
  const missingPrerequisites: any[] = [];

  // If no prerequisites, character can purchase
  if (!item.prerequisites) {
    return { canPurchase: true, reasons: ['No special requirements'] };
  }

  const prereqs = item.prerequisites;

  // Check minimum stats
  if (prereqs.minimumStats) {
    for (const [statName, minValue] of Object.entries(prereqs.minimumStats)) {
      const characterStat = character.currentStats?.[statName] || character.stats?.[statName] || 0;
      if (characterStat < (minValue as number)) {
        reasons.push(`Requires ${statName} of at least ${minValue} (you have ${characterStat})`);
        missingPrerequisites.push({
          type: 'stat',
          name: statName,
          required: minValue,
          current: characterStat
        });
      }
    }
  }

  // Check minimum skills
  if (prereqs.minimumSkills) {
    for (const [skillName, minValue] of Object.entries(prereqs.minimumSkills)) {
      const characterSkill = character.skills?.[skillName] || 0;
      if (characterSkill < (minValue as number)) {
        reasons.push(`Requires ${skillName} skill of at least ${minValue}% (you have ${characterSkill}%)`);
        missingPrerequisites.push({
          type: 'skill',
          name: skillName,
          required: minValue,
          current: characterSkill
        });
      }
    }
  }

  // Check gender requirements
  if (prereqs.requiredGender && character.gender !== prereqs.requiredGender) {
    reasons.push(`This item is only available to ${prereqs.requiredGender} characters`);
    missingPrerequisites.push({
      type: 'gender',
      required: prereqs.requiredGender,
      current: character.gender
    });
  }

  // Check age requirements
  const characterAge = character.age || 0;
  if (prereqs.minimumAge && characterAge < prereqs.minimumAge) {
    reasons.push(`Requires minimum age of ${prereqs.minimumAge} (you are ${characterAge})`);
    missingPrerequisites.push({
      type: 'age',
      required: prereqs.minimumAge,
      current: characterAge
    });
  }

  if (prereqs.maximumAge && characterAge > prereqs.maximumAge) {
    reasons.push(`Requires maximum age of ${prereqs.maximumAge} (you are ${characterAge})`);
    missingPrerequisites.push({
      type: 'age',
      required: prereqs.maximumAge,
      current: characterAge
    });
  }

  // If any missing requirements, cannot purchase
  if (missingPrerequisites.length > 0) {
    return { canPurchase: false, reasons, missingPrerequisites };
  }

  return { canPurchase: true, reasons: ['Character meets all requirements for this item'] };
}

// Helper functions
function formatPrice(pence: number): string {
  if (pence >= 240) {
    const pounds = Math.floor(pence / 240);
    const remainingPence = pence % 240;
    const shillings = Math.floor(remainingPence / 12);
    const finalPence = remainingPence % 12;
    
    let result = `£${pounds}`;
    if (shillings > 0) result += ` ${shillings}s`;
    if (finalPence > 0) result += ` ${finalPence}d`;
    return result;
  } else if (pence >= 12) {
    const shillings = Math.floor(pence / 12);
    const remainingPence = pence % 12;
    let result = `${shillings}s`;
    if (remainingPence > 0) result += ` ${remainingPence}d`;
    return result;
  } else {
    return `${pence}d`;
  }
}

async function getAvailableCategories(): Promise<string[]> {
  const categories = await Item.distinct('category', {
    isAdminOnly: { $ne: true },
    $or: [{ isPublic: true }, { availableLocations: { $exists: true, $ne: [] } }]
  });
  return categories;
}

async function getPriceRange(filter: any): Promise<{ min: number; max: number }> {
  const priceStats = await Item.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        min: { $min: '$basePrice' },
        max: { $max: '$basePrice' }
      }
    }
  ]);

  return priceStats.length > 0 ? { min: priceStats[0].min, max: priceStats[0].max } : { min: 0, max: 0 };
}

async function getRelatedCategories(category: string, subcategory?: string): Promise<string[]> {
  const related = await Item.distinct('subcategory', {
    category,
    subcategory: { $ne: subcategory },
    isAdminOnly: { $ne: true }
  });
  return related.filter(Boolean);
}

function getCategoryDescription(category: string): string {
  const descriptions: { [key: string]: string } = {
    'clothing': 'Victorian era garments and fashion accessories',
    'accessories': 'Personal accessories and decorative items',
    'tools': 'Professional and household tools',
    'weapons': 'Combat and hunting implements',
    'books': 'Literature, reference works, and publications',
    'documents': 'Official papers, certificates, and records',
    'medical': 'Medical supplies and pharmaceutical items',
    'food_drink': 'Consumable food and beverages',
    'household': 'Domestic items and furnishings',
    'luxury': 'High-end luxury goods and status symbols',
    'professional': 'Specialized professional equipment',
    'transport': 'Transportation-related items and services',
    'curiosities': 'Unusual and exotic items',
    'occult': 'Mysterious and supernatural artifacts',
    'consumables': 'Single-use consumable items',
    'services': 'Professional services and appointments'
  };

  return descriptions[category] || 'Specialized item category';
}