/**
 * Economy types (Mercato: catalogo strumenti + servizi continuativi)
 *
 * Mirrors the real response shapes from EconomyController/ServicesController
 * (services/unified-backend/src/modules/game/{controllers/EconomyController.ts,
 * controllers/ServicesController.ts}) — not a speculative/future design.
 *
 * @module types/economy
 */

export interface MarketItemRequirements {
  minimumStats?: Record<string, number>;
  minimumSkills?: Record<string, number>;
  requiredOccupations?: string[];
  requiredSocialClass?: string[];
  requiredFinancialClasses?: string[];
}

export interface MarketItem {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  priceFormatted: string;
  properties?: Record<string, unknown>;
  requirements?: MarketItemRequirements;
  imageUrl?: string;
  canPurchase?: boolean;
  canPurchaseWithCash?: boolean;
  canPurchaseWithCredit?: boolean;
  creditEligible?: boolean;
  socialClasses?: string[];
}

export interface CreditLineSummary {
  maxWeekly: number;
  currentAvailable: number;
  nextResetDate?: string;
}

export interface CharacterFinancesSummary {
  cash: number;
  bankDeposit: number;
  totalWealth: number;
  socialClass: string;
  creditLine: CreditLineSummary;
}

export interface GeneralStoreResponse {
  items: MarketItem[];
  character?: {
    finances: CharacterFinancesSummary;
  };
}

export type PaymentMethod = 'cash' | 'credit';

export interface PurchaseResponse {
  finances: {
    cash: number;
    bankDeposit: number;
    totalWealth: number;
    creditLine: {
      maxWeekly: number;
      currentAvailable: number;
    };
  };
  purchasedItem: {
    id: string;
    name: string;
    price: number;
    priceFormatted: string;
  };
}

export type ServiceCategory = 'servitu' | 'comunicazioni' | 'trasporti' | 'sicurezza';

export interface EconomyServiceCatalogEntry {
  _id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  monthlyCost: number;
  canSubscribe: boolean;
}

export interface ActiveEconomyService {
  serviceId: string;
  category: ServiceCategory;
  monthlyCost: number;
  activatedAt: string;
  cancelledAt?: string;
  pointsFreeAt?: string;
  propertyIndex?: number;
}

export interface CharacterProperty {
  index: number;
  type: string;
  name: string;
}

export interface EconomyServicesResponse {
  capacity: number;
  committedTotal: number;
  available: number;
  catalog: EconomyServiceCatalogEntry[];
  activeServices: ActiveEconomyService[];
  properties: CharacterProperty[];
}
