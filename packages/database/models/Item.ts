import mongoose, { Schema, model, Document } from 'mongoose';
import { VictorianCurrency } from '../../shared/types/economy';

export enum ItemCategory {
  CLOTHING = 'clothing',
  ACCESSORIES = 'accessories',
  TOOLS = 'tools',
  WEAPONS = 'weapons',
  BOOKS = 'books',
  DOCUMENTS = 'documents',
  MEDICAL = 'medical',
  FOOD_DRINK = 'food_drink',
  HOUSEHOLD = 'household',
  LUXURY = 'luxury',
  PROFESSIONAL = 'professional',
  TRANSPORT = 'transport',
  CURIOSITIES = 'curiosities',
  OCCULT = 'occult',
  CONSUMABLES = 'consumables',
  SERVICES = 'services'
}

export interface IItem extends Document {
  // Basic info
  name: string;
  description: string;
  category: ItemCategory;
  subcategory?: string;
  
  // Visual representation
  imageUrl?: string;              // Path to generated item image
  
  // Availability and distribution
  isPublic: boolean;              // Available in General Stores
  availableLocations: Schema.Types.ObjectId[];   // Location IDs where item can be purchased
  isAdminOnly: boolean;          // Only grantable through management panel
  
  // Pricing
  basePrice: number; // in pence
  
  // Prerequisites (same as occupations and corporations)
  prerequisites?: {
    minimumStats?: { [statName: string]: number };
    minimumSkills?: { [skillName: string]: number };
    requiredOccupations?: string[];      // Occupation IDs
    requiredCorporations?: {
      corporationId: Schema.Types.ObjectId;
      minimumRole?: string;
    }[];
    requiredGender?: 'male' | 'female';
    minimumAge?: number;
    maximumAge?: number;
    requiredSocialClass?: ('working' | 'middle' | 'upper')[];    // Legacy support
    requiredFinancialClasses?: string[];     // New system: ["Indigente", "Povero", "Modesto", etc.]
    
    // Item prerequisites
    requiredItems?: Schema.Types.ObjectId[];            // Must own these items first
    excludeIfHasItems?: Schema.Types.ObjectId[];        // Cannot own these items
    
    // Special conditions
    customConditions?: string[];         // Special requirements description
  };
  
  // Item properties
  properties: {
    isStackable: boolean;               // Can own multiple copies
    maxQuantity?: number;               // Maximum quantity per character
    weight?: number;                    // For carrying capacity (future feature)
    durability?: number;                // Item condition (1-100)
    isConsumable: boolean;             // Item is consumed on use
    consumptionType?: 'direct' | 'indirect';  // How the item is consumed
    consumesItems?: {                  // For indirect consumption (e.g., gun consumes ammo)
      itemId: Schema.Types.ObjectId;                  // What item is consumed
      quantityConsumed: number;        // How many are consumed per use
      required: boolean;               // Must have this item to use
    }[];
    
    // Special properties
    providesSkillBonus?: { [skillName: string]: number };
    providesStatBonus?: { [statName: string]: number };
    grantsSpecialAbilities?: string[];  // Special abilities this item provides
    
    // Social effects
    socialStatusModifier?: number;      // Effect on social interactions
    respectabilityModifier?: number;    // Effect on character respectability
  };
  
  // Financial system integration
  financialSettings: {
    eligibleForCredit: boolean;        // Can be purchased using credit line
    socialClassesEligible?: string[];  // Which social classes can buy with credit
  };
  
  // Shop and trading
  shopSettings: {
    canBePurchased: boolean;
    canBeSold: boolean;                // Can character sell back to shop
    sellBackPrice?: number; // Price when selling to shop (usually lower)
    canBeTradedBetweenPlayers: boolean;
    
    // Stock management
    hasLimitedStock: boolean;
    defaultStock?: number;             // Default stock for new shops
    restockInterval?: string;          // How often stock replenishes
    restockQuantity?: number;          // How much stock is added
  };
  
  // Rarity and availability
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'unique';
  
  // Time and seasonal availability
  availabilitySchedule?: {
    timeOfDay?: ('day' | 'night' | 'both');
    seasonalAvailability?: string[];   // Months when available
    specialEvents?: string[];          // Only available during certain events
  };
  
  // Metadata
  createdBy: Schema.Types.ObjectId;                   // Staff member who created item
  createdAt: Date;
  updatedAt: Date;
}

export interface ICharacterInventory extends Document {
  characterId: Schema.Types.ObjectId;
  
  // Inventory items
  items: {
    id: Schema.Types.ObjectId;
    itemId: Schema.Types.ObjectId;
    quantity: number;
    condition?: number;        // Durability (1-100)
    customName?: string;       // Player-given name
    customDescription?: string; // Player-added description
    
    // Acquisition details
    acquiredAt: Date;
    acquiredThrough: 'purchase' | 'trade' | 'admin_grant' | 'quest_reward' | 'found' | 'crafted';
    purchasePrice?: number;
    acquiredFrom?: string;     // Character ID or shop ID
    
    // Current status
    isEquipped: boolean;       // For clothing/accessories/tools
    isVisible: boolean;        // Other players can see this item
    
    // Usage tracking
    timesUsed?: number;
    lastUsed?: Date;
  }[];
  
  // Inventory limits
  maxCarryingCapacity?: number;
  currentWeight?: number;
  
  // Metadata
  lastUpdated: Date;
}

export interface IShop extends Document {
  name: string;
  description: string;
  
  // Shop location and type
  type: 'location_shop' | 'general_store';
  locationId?: Schema.Types.ObjectId;       // null for general stores
  
  // Shop owner and management
  ownerId?: Schema.Types.ObjectId;          // Character ID if player-owned
  ownerType?: 'character' | 'corporation' | 'npc' | 'system';
  isNPCOwned: boolean;
  shopkeeperName: string;
  
  // Shop settings
  settings: {
    isOpen: boolean;
    openingHours?: string;    // e.g., "9:00-17:00"
    acceptsCash: boolean;
    acceptsBankTransfer: boolean;
    
    // Trading policies
    buybackPercentage: number; // Percentage of original price for buybacks
    hagglingAllowed: boolean;
    
    // Access control
    isPublic: boolean;
    allowedCustomers?: Schema.Types.ObjectId[]; // Character IDs or corporation IDs
    bannedCustomers?: Schema.Types.ObjectId[];  // Character IDs
  };
  
  // Reputation and quality
  reputation: number;        // 1-100 scale
  qualityRating: number;     // 1-100 scale
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface IShopItem extends Document {
  itemId: Schema.Types.ObjectId;
  shopId: Schema.Types.ObjectId;
  
  // Pricing and availability
  price: number; // in pence
  isInStock: boolean;
  currentStock: number;          // Made required for stock management
  maxStock: number;              // Made required for stock management
  
  // Stock management (for corporation shops)
  autoRestock: boolean;          // Does this item restock automatically?
  restockCost?: number;     // Cost per unit to restock (paid from corp treasury)
  restockThreshold?: number;     // Restock when stock falls below this number
  restockAmount?: number;        // How many units to order when restocking
  
  // Special shop conditions
  localPrerequisites?: {     // Additional requirements for this shop
    minimumReputation?: number;
    requiredRelationship?: string;
  };
  
  // Pricing history
  priceHistory?: {
    price: number;
    changedAt: Date;
    reason?: string;
  }[];
  
  // Metadata
  addedAt: Date;
  lastSold?: Date;
  totalSold: number;
}

const ItemSchema = new Schema<IItem>({
  // Basic info
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: Object.values(ItemCategory)
  },
  subcategory: {
    type: String,
    trim: true
  },
  
  // Visual representation
  imageUrl: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Availability
  isPublic: {
    type: Boolean,
    default: false
  },
  availableLocations: [{
    type: Schema.Types.ObjectId,
    ref: 'Location'
  }],
  isAdminOnly: {
    type: Boolean,
    default: false
  },
  
  // Pricing
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Prerequisites
  prerequisites: {
    minimumStats: { type: Map, of: Number },
    minimumSkills: { type: Map, of: Number },
    requiredOccupations: [String],
    requiredCorporations: [{
      corporationId: {
        type: Schema.Types.ObjectId,
        ref: 'Corporation',
        required: true
      },
      minimumRole: String
    }],
    requiredGender: { type: String, enum: ['male', 'female'] },
    minimumAge: Number,
    maximumAge: Number,
    requiredSocialClass: [{ type: String, enum: ['working', 'middle', 'upper'] }],    // Legacy support
    requiredFinancialClasses: [String],   // New system: social class names
    requiredItems: [{
      type: Schema.Types.ObjectId,
      ref: 'Item'
    }],
    excludeIfHasItems: [{
      type: Schema.Types.ObjectId,
      ref: 'Item'
    }],
    customConditions: [String]
  },
  
  // Properties
  properties: {
    isStackable: { type: Boolean, default: false },
    maxQuantity: { type: Number, min: 1 },
    weight: { type: Number, min: 0 },
    durability: { type: Number, min: 1, max: 100 },
    isConsumable: { type: Boolean, default: false },
    consumptionType: { type: String, enum: ['direct', 'indirect'] },
    consumesItems: [{
      itemId: {
        type: Schema.Types.ObjectId,
        ref: 'Item',
        required: true
      },
      quantityConsumed: { type: Number, required: true, min: 1 },
      required: { type: Boolean, default: true }
    }],
    providesSkillBonus: { type: Map, of: Number },
    providesStatBonus: { type: Map, of: Number },
    grantsSpecialAbilities: [String],
    socialStatusModifier: Number,
    respectabilityModifier: Number
  },
  
  // Financial system integration
  financialSettings: {
    eligibleForCredit: { type: Boolean, default: true },
    socialClassesEligible: [String]  // Which social classes can purchase with credit
  },
  
  // Shop settings
  shopSettings: {
    canBePurchased: { type: Boolean, default: true },
    canBeSold: { type: Boolean, default: true },
    sellBackPrice: { type: Number, min: 0 },
    canBeTradedBetweenPlayers: { type: Boolean, default: true },
    hasLimitedStock: { type: Boolean, default: false },
    defaultStock: { type: Number, min: 0 },
    restockInterval: String,
    restockQuantity: { type: Number, min: 0 }
  },
  
  // Rarity
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'unique'],
    default: 'common'
  },
  
  // Availability schedule
  availabilitySchedule: {
    timeOfDay: { type: String, enum: ['day', 'night', 'both'] },
    seasonalAvailability: [String],
    specialEvents: [String]
  },
  
  // Management
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'items'
});

const CharacterInventorySchema = new Schema<ICharacterInventory>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    unique: true
  },
  
  items: [{
    id: { type: Schema.Types.ObjectId, auto: true },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    quantity: { type: Number, required: true, min: 1 },
    condition: { type: Number, min: 1, max: 100 },
    customName: { type: String, trim: true },
    customDescription: { type: String, trim: true },
    
    acquiredAt: { type: Date, required: true },
    acquiredThrough: {
      type: String,
      enum: ['purchase', 'trade', 'admin_grant', 'quest_reward', 'found', 'crafted'],
      required: true
    },
    purchasePrice: { type: Number, min: 0 },
    acquiredFrom: String,
    
    isEquipped: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    
    timesUsed: { type: Number, default: 0 },
    lastUsed: Date
  }],
  
  maxCarryingCapacity: { type: Number, min: 0 },
  currentWeight: { type: Number, default: 0 },
  
  lastUpdated: { type: Date, default: Date.now }
}, {
  collection: 'character_inventories'
});

const ShopSchema = new Schema<IShop>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  
  type: {
    type: String,
    enum: ['location_shop', 'general_store'],
    required: true
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location'
  },
  
  ownerId: Schema.Types.ObjectId,
  ownerType: {
    type: String,
    enum: ['character', 'corporation', 'npc', 'system']
  },
  isNPCOwned: {
    type: Boolean,
    default: false
  },
  shopkeeperName: {
    type: String,
    required: true,
    trim: true
  },
  
  settings: {
    isOpen: { type: Boolean, default: true },
    openingHours: String,
    acceptsCash: { type: Boolean, default: true },
    acceptsBankTransfer: { type: Boolean, default: true },
    buybackPercentage: { type: Number, default: 50, min: 0, max: 100 },
    hagglingAllowed: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    allowedCustomers: [{
      type: Schema.Types.ObjectId,
      refPath: 'ownerType'
    }],
    bannedCustomers: [{
      type: Schema.Types.ObjectId,
      ref: 'Character'
    }]
  },
  
  reputation: { type: Number, default: 50, min: 1, max: 100 },
  qualityRating: { type: Number, default: 50, min: 1, max: 100 }
}, {
  timestamps: true,
  collection: 'shops'
});

const ShopItemSchema = new Schema<IShopItem>({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  shopId: {
    type: Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  
  price: { type: Number, required: true, min: 0 },
  isInStock: { type: Boolean, default: true },
  currentStock: { type: Number, required: true, min: 0 },
  maxStock: { type: Number, required: true, min: 0 },
  
  autoRestock: { type: Boolean, default: false },
  restockCost: { type: Number, min: 0 },
  restockThreshold: { type: Number, min: 0 },
  restockAmount: { type: Number, min: 0 },
  
  localPrerequisites: {
    minimumReputation: { type: Number, min: 1, max: 100 },
    requiredRelationship: String
  },
  
  priceHistory: [{
    price: { type: Number, required: true },
    changedAt: { type: Date, required: true },
    reason: String
  }],
  
  addedAt: { type: Date, default: Date.now },
  lastSold: Date,
  totalSold: { type: Number, default: 0 }
}, {
  collection: 'shop_items'
});

// Indexes
// name already has unique constraint
ItemSchema.index({ category: 1, rarity: 1 });
ItemSchema.index({ isPublic: 1 });
ItemSchema.index({ availableLocations: 1 });
ItemSchema.index({ 'properties.isConsumable': 1 });

// characterId already has unique constraint
CharacterInventorySchema.index({ 'items.itemId': 1 });

ShopSchema.index({ type: 1, locationId: 1 });
ShopSchema.index({ ownerId: 1, ownerType: 1 });
ShopSchema.index({ 'settings.isPublic': 1, 'settings.isOpen': 1 });

ShopItemSchema.index({ shopId: 1, itemId: 1 }, { unique: true });
ShopItemSchema.index({ itemId: 1 });
ShopItemSchema.index({ isInStock: 1, currentStock: 1 });

// Methods
ItemSchema.methods.checkPrerequisites = function(character: any, characterInventory: any[] = [], corporationMemberships: any[] = []) {
  const issues: string[] = [];
  
  if (!this.prerequisites) {
    return { canAccess: true, issues: [] };
  }
  
  const req = this.prerequisites;
  
  // Check stats
  if (req.minimumStats) {
    for (const [stat, minValue] of req.minimumStats) {
      if (character.stats[stat] < minValue) {
        issues.push(`${stat} too low (has ${character.stats[stat]}, requires ${minValue})`);
      }
    }
  }
  
  // Check skills
  if (req.minimumSkills) {
    for (const [skill, minValue] of req.minimumSkills) {
      const characterSkill = character.skills.get(skill) || 0;
      if (characterSkill < minValue) {
        issues.push(`${skill} skill too low (has ${characterSkill}, requires ${minValue})`);
      }
    }
  }
  
  // Check social class
  if (req.requiredSocialClass && !req.requiredSocialClass.includes(character.socialClass)) {
    issues.push(`Social class requirement not met (requires ${req.requiredSocialClass.join(' or ')})`);
  }
  
  // Check gender
  if (req.requiredGender && character.gender !== req.requiredGender) {
    issues.push(`Gender requirement not met (requires ${req.requiredGender})`);
  }
  
  // Check age
  if (req.minimumAge && character.age < req.minimumAge) {
    issues.push(`Age too low (requires minimum ${req.minimumAge})`);
  }
  
  if (req.maximumAge && character.age > req.maximumAge) {
    issues.push(`Age too high (maximum ${req.maximumAge})`);
  }
  
  // Check occupation
  if (req.requiredOccupations && !req.requiredOccupations.includes(character.occupation)) {
    issues.push(`Occupation requirement not met (requires ${req.requiredOccupations.join(' or ')})`);
  }
  
  // Check required items
  if (req.requiredItems && req.requiredItems.length > 0) {
    const ownedItemIds = characterInventory.map(inv => inv.itemId.toString());
    const missingItems = req.requiredItems.filter((itemId: any) => !ownedItemIds.includes(itemId.toString()));
    if (missingItems.length > 0) {
      issues.push(`Missing required items: ${missingItems.length} items`);
    }
  }
  
  // Check excluded items
  if (req.excludeIfHasItems && req.excludeIfHasItems.length > 0) {
    const ownedItemIds = characterInventory.map(inv => inv.itemId.toString());
    const conflictingItems = req.excludeIfHasItems.filter((itemId: any) => ownedItemIds.includes(itemId.toString()));
    if (conflictingItems.length > 0) {
      issues.push(`Cannot own conflicting items: ${conflictingItems.length} items`);
    }
  }
  
  return {
    canAccess: issues.length === 0,
    issues
  };
};

CharacterInventorySchema.methods.addItem = function(itemId: Schema.Types.ObjectId, quantity: number, acquiredThrough: string, additionalData = {}) {
  // Check if item already exists and is stackable
  const existingItem = this.items.find((item: any) => item.itemId.equals(itemId));
  
  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.lastUsed = undefined; // Reset usage tracking
  } else {
    this.items.push({
      itemId,
      quantity,
      acquiredAt: new Date(),
      acquiredThrough,
      ...additionalData
    });
  }
  
  this.lastUpdated = new Date();
};

CharacterInventorySchema.methods.removeItem = function(inventoryItemId: Schema.Types.ObjectId, quantity: number = 1) {
  const item = this.items.id(inventoryItemId);
  if (!item) return false;
  
  if (item.quantity <= quantity) {
    this.items.pull(inventoryItemId);
  } else {
    item.quantity -= quantity;
  }
  
  this.lastUpdated = new Date();
  return true;
};

CharacterInventorySchema.methods.hasItem = function(itemId: Schema.Types.ObjectId, minQuantity = 1) {
  const item = this.items.find((item: any) => item.itemId.equals(itemId));
  return item && item.quantity >= minQuantity;
};

ShopItemSchema.methods.updateStock = function(quantityChange: number) {
  this.currentStock = Math.max(0, this.currentStock + quantityChange);
  this.isInStock = this.currentStock > 0;
  
  if (quantityChange < 0) {
    this.lastSold = new Date();
    this.totalSold += Math.abs(quantityChange);
  }
};

ShopItemSchema.methods.needsRestock = function() {
  return this.autoRestock && 
         this.restockThreshold !== undefined && 
         this.currentStock <= this.restockThreshold;
};

export const Item = mongoose.models.Item || model<IItem>('Item', ItemSchema);
export const CharacterInventory = mongoose.models.CharacterInventory || model<ICharacterInventory>('CharacterInventory', CharacterInventorySchema);
export const Shop = mongoose.models.Shop || model<IShop>('Shop', ShopSchema);
export const ShopItem = mongoose.models.ShopItem || model<IShopItem>('ShopItem', ShopItemSchema);