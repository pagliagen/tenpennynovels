export type ItemCategory =
  | 'clothing' | 'accessories' | 'tools' | 'weapons' | 'books'
  | 'documents' | 'medical' | 'food_drink' | 'household' | 'luxury'
  | 'professional' | 'transport' | 'curiosities' | 'occult'
  | 'consumables' | 'services';

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  clothing: 'Abbigliamento',
  accessories: 'Accessori',
  tools: 'Strumenti',
  weapons: 'Armi',
  books: 'Libri',
  documents: 'Documenti',
  medical: 'Medico',
  food_drink: 'Cibo e Bevande',
  household: 'Casalinghi',
  luxury: 'Lusso',
  professional: 'Professionale',
  transport: 'Trasporti',
  curiosities: 'Curiosità',
  occult: 'Occulto',
  consumables: 'Consumabili',
  services: 'Servizi',
};

export interface ItemPrerequisites {
  minimumStats?: Record<string, number>;
  minimumSkills?: Record<string, number>;
  requiredOccupations?: string[];
  requiredCorporations?: { corporationId: string; minimumRole?: string }[];
  requiredGender?: 'male' | 'female';
  minimumAge?: number;
  maximumAge?: number;
  requiredSocialClass?: string[];
  requiredFinancialClasses?: string[];
  requiredItems?: string[];
  excludeIfHasItems?: string[];
  customConditions?: string[];
}

export interface ItemProperties {
  isStackable: boolean;
  maxQuantity?: number;
  durability?: number;
  isConsumable: boolean;
  consumptionType?: 'direct' | 'indirect';
  consumesItems?: { itemId: string; quantityConsumed: number; required: boolean }[];
}

export interface ItemFinancialSettings {
  eligibleForCredit: boolean;
  socialClassesEligible?: string[];
}

export interface ItemShopSettings {
  canBePurchased: boolean;
  canBeSold: boolean;
  sellBackPrice?: number;
  canBeTradedBetweenPlayers: boolean;
  hasLimitedStock: boolean;
  defaultStock?: number;
  restockInterval?: string;
  restockQuantity?: number;
}

export interface Item {
  _id: string;
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  categoryLabel?: string;
  subcategory?: string;
  imageUrl?: string;
  isPublic: boolean;
  availableLocations: string[];
  isAdminOnly: boolean;
  basePrice: number;
  prerequisites?: ItemPrerequisites;
  properties: ItemProperties;
  financialSettings: ItemFinancialSettings;
  shopSettings: ItemShopSettings;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  category?: string;
  isPublic?: boolean | string;
  isAdminOnly?: boolean | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ItemListResponse {
  result: boolean;
  list: Item[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateItemData {
  name: string;
  description: string;
  category: ItemCategory;
  subcategory?: string;
  imageUrl?: string;
  isPublic?: boolean;
  isAdminOnly?: boolean;
  availableLocations?: string[];
  basePrice: number;
  properties?: Partial<ItemProperties>;
  financialSettings?: Partial<ItemFinancialSettings>;
  shopSettings?: Partial<ItemShopSettings>;
}

export interface UpdateItemData extends Partial<CreateItemData> {
  reason?: string;
}
