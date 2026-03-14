import { VictorianCurrency } from './economy';

export interface Item {
  id: string;
  name: string;
  description: string;
  
  // Item categorization
  category: ItemCategory;
  subcategory?: string;
  
  // Availability and distribution
  isPublic: boolean;              // Available in General Stores
  availableLocations: string[];   // Location IDs where item can be purchased
  isAdminOnly: boolean;          // Only grantable through management panel
  
  // Pricing (in pence - matches Item model)
  basePrice: number;
  
  // Prerequisites (same as occupations and corporations)
  prerequisites?: {
    minimumStats?: { [statName: string]: number };
    minimumSkills?: { [skillName: string]: number };
    requiredOccupations?: string[];      // Occupation IDs
    requiredCorporations?: {
      corporationId: string;
      minimumRole?: string;
    }[];
    requiredGender?: 'male' | 'female';
    minimumAge?: number;
    maximumAge?: number;
    requiredSocialClass?: ('working' | 'middle' | 'upper')[];
    
    // Item prerequisites
    requiredItems?: string[];            // Must own these items first
    excludeIfHasItems?: string[];        // Cannot own these items
    
    // Special conditions
    customConditions?: string[];         // Special requirements description
  };
  
  // Item properties
  properties: {
    isStackable: boolean;               // Can own multiple copies
    maxQuantity?: number;               // Maximum quantity per character
    durability?: number;                // Item condition (1-100)
    isConsumable: boolean;             // Item is consumed on use
    consumptionType?: 'direct' | 'indirect';  // How the item is consumed
    consumesItems?: {                  // For indirect consumption (e.g., gun consumes ammo)
      itemId: string;                  // What item is consumed
      quantityConsumed: number;        // How many are consumed per use
      required: boolean;               // Must have this item to use
    }[];
    
  };
  
  // Shop and trading
  shopSettings: {
    canBePurchased: boolean;
    canBeSold: boolean;                // Can character sell back to shop
    sellBackPrice?: number;            // Price when selling to shop in pence (usually lower)
    canBeTradedBetweenPlayers: boolean;
    
    // Stock management
    hasLimitedStock: boolean;
    currentStock?: number;             // Current available quantity
    restockInterval?: string;          // How often stock replenishes
    restockQuantity?: number;          // How much stock is added
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                   // Staff member who created item
}

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
  CONSUMABLES = 'consumables'
}

export interface CharacterInventory {
  id: string;
  characterId: string;
  
  // Inventory items
  items: CharacterItem[];
  
  // Inventory limits
  maxCarryingCapacity?: number;
  currentWeight?: number;
  
  // Metadata
  lastUpdated: Date;
}

export interface CharacterItem {
  id: string;
  itemId: string;
  characterId: string;
  
  // Item instance details
  quantity: number;
  condition?: number;        // Durability (1-100)
  customName?: string;       // Player-given name
  customDescription?: string; // Player-added description
  
  // Acquisition details
  acquiredAt: Date;
  acquiredThrough: 'purchase' | 'trade' | 'admin_grant' | 'quest_reward' | 'found' | 'crafted';
  purchasePrice?: VictorianCurrency;
  acquiredFrom?: string;     // Character ID or shop ID
  
  // Current status
  isEquipped: boolean;       // For clothing/accessories/tools
  isVisible: boolean;        // Other players can see this item
  
  // Usage tracking
  timesUsed?: number;
  lastUsed?: Date;
}

export interface Shop {
  id: string;
  name: string;
  description: string;
  
  // Shop location and type
  type: 'location_shop' | 'general_store';
  locationId?: string;       // null for general stores
  
  // Shop owner and management
  ownerId?: string;          // Character ID if player-owned
  isNPCOwned: boolean;
  shopkeeperName: string;
  
  // Inventory and pricing
  inventory: ShopItem[];
  
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
    allowedCustomers?: string[]; // Character IDs or corporation IDs
    bannedCustomers?: string[];  // Character IDs
  };
  
  // Reputation and quality
  reputation: number;        // 1-100 scale
  qualityRating: number;     // 1-100 scale
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopItem {
  itemId: string;
  shopId: string;
  
  // Pricing and availability
  price: VictorianCurrency;
  isInStock: boolean;
  currentStock: number;          // Made required for stock management
  maxStock: number;              // Made required for stock management
  
  // Stock management (for corporation shops)
  autoRestock: boolean;          // Does this item restock automatically?
  restockCost?: VictorianCurrency; // Cost per unit to restock (paid from corp treasury)
  restockThreshold?: number;     // Restock when stock falls below this number
  restockAmount?: number;        // How many units to order when restocking
  
  // Special shop conditions
  localPrerequisites?: {     // Additional requirements for this shop
    minimumReputation?: number;
    requiredRelationship?: string;
  };
  
  // Pricing history
  priceHistory?: {
    price: VictorianCurrency;
    changedAt: Date;
    reason?: string;
  }[];
  
  // Metadata
  addedAt: Date;
  lastSold?: Date;
  totalSold: number;
}

export interface ItemAvailability {
  itemId: string;
  characterId: string;
  
  // Availability check results
  canSee: boolean;           // Item appears in lists
  canPurchase: boolean;      // Can buy the item
  
  // Where item is available
  availableIn: {
    generalStore: boolean;
    locationShops: {
      locationId: string;
      locationName: string;
      shopId: string;
      shopName: string;
      price: VictorianCurrency;
      inStock: boolean;
    }[];
  };
  
  // Missing requirements
  missingRequirements?: {
    stats?: { [statName: string]: { required: number; current: number } };
    skills?: { [skillName: string]: { required: number; current: number } };
    items?: string[];
    occupations?: string[];
    corporations?: string[];
    other?: string[];
  };
  
  // Check metadata
  checkedAt: Date;
}

export interface ItemUsageRequest {
  inventoryItemId: string;
  target?: string;              // Character ID or object target
  context?: string;             // Usage context
  parameters?: any;             // Additional usage parameters
}

export interface ItemUsageResult {
  success: boolean;
  item: {
    id: string;
    name: string;
    type: 'direct' | 'indirect';
  };
  consumption: {
    directConsumption?: {       // For direct consumables
      itemConsumed: string;     // Item ID that was consumed
      quantityConsumed: number;
      remainingQuantity: number;
    };
    indirectConsumption?: {     // For indirect consumables (e.g., gun uses ammo)
      mainItem: string;         // Item used (e.g., gun)
      consumedItems: {
        itemId: string;         // Item consumed (e.g., bullets)
        quantityBefore: number;
        quantityConsumed: number;
        quantityAfter: number;
      }[];
    };
  };
  effects: {
    skillBonuses?: { [skillName: string]: { bonus: number; duration: string } };
    statBonuses?: { [statName: string]: { bonus: number; duration: string } };
    specialEffects?: string[];
    description: string;        // Description of what happened
  };
  error?: string;               // If usage failed
}

export interface StockRestockRequest {
  shopId: string;
  itemId: string;
  quantity: number;
  payFromTreasury?: boolean;    // For corporation shops
}

export interface StockRestockResult {
  success: boolean;
  restocked: {
    itemId: string;
    quantityAdded: number;
    newStock: number;
    costPaid: VictorianCurrency;
    paidFrom: 'treasury' | 'manual';
  };
  treasury?: {
    previousBalance: VictorianCurrency;
    newBalance: VictorianCurrency;
  };
  error?: string;
}

// Predefined item examples
export const EXAMPLE_ITEMS = {
  // Professional items
  MEDICAL_LICENSE: 'medical_license',
  LEGAL_QUALIFICATION: 'legal_qualification',
  STETHOSCOPE: 'stethoscope',
  
  // Social items
  GENTLEMANS_CANE: 'gentlemans_cane',
  LADIES_FAN: 'ladies_fan',
  POCKET_WATCH: 'pocket_watch',
  
  // Tools and equipment
  LOCKPICKS: 'lockpicks',
  MAGNIFYING_GLASS: 'magnifying_glass',
  REVOLVER: 'revolver',
  BULLETS_25_CALIBER: 'bullets_25_caliber',
  BULLETS_32_CALIBER: 'bullets_32_caliber',
  
  // Consumables - Direct
  BREAD_LOAF: 'bread_loaf',
  BOTTLE_OF_WINE: 'bottle_of_wine',
  CIGARETTES: 'cigarettes',
  
  // Consumables - Indirect (require other items)
  TELEPHONE: 'telephone',        // Uses telephone_tokens
  TELEGRAM_MACHINE: 'telegram_machine', // Uses telegram_forms
  
  // Documents
  CRIMINAL_RECORD: 'criminal_record',
  UNIVERSITY_DIPLOMA: 'university_diploma',
  CLUB_MEMBERSHIP: 'club_membership',
} as const;