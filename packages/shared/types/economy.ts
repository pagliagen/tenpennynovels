// Victorian currency system: 1 pound = 20 shillings = 240 pence
export interface VictorianCurrency {
  pounds: number;
  shillings: number;
  pence: number;
}

export interface CharacterWallet {
  characterId: string;
  
  // Two separate money storages
  deposit: VictorianCurrency; // Bank account
  cash: VictorianCurrency;    // Money carried
  
  // Wallet limits
  maxCashCapacity?: VictorianCurrency; // Maximum cash that can be carried
  
  // Metadata
  lastUpdated: Date;
}

export interface MoneyTransfer {
  id: string;
  
  // Transfer type
  type: 'bank_transfer' | 'cash_exchange' | 'shop_purchase' | 'admin_grant' | 'item_sale' | 
        'occupation_salary' | 'corporation_salary' | 'membership_dues';
  
  // Participants
  fromCharacterId?: string; // null for admin/system transactions
  toCharacterId?: string;   // null for shop purchases
  fromCorporationId?: string; // For corporation salary payments
  toCorporationId?: string;   // For membership dues
  
  // Transfer details
  amount: VictorianCurrency;
  sourceType: 'deposit' | 'cash'; // Where money came from
  targetType: 'deposit' | 'cash'; // Where money goes to
  
  // Transaction context
  description: string;
  itemId?: string;        // If related to item purchase/sale
  locationId?: string;    // Where transaction occurred
  shopId?: string;        // If shop transaction
  
  // Status
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  
  // Administrative
  approvedBy?: string;    // Staff member who approved (for large transfers)
  
  // Metadata
  timestamp: Date;
  completedAt?: Date;
}

export interface ShopTransaction {
  id: string;
  
  // Transaction details
  type: 'purchase' | 'sale';
  characterId: string;
  itemId: string;
  quantity: number;
  
  // Pricing
  unitPrice: VictorianCurrency;
  totalPrice: VictorianCurrency;
  
  // Context
  shopType: 'location_shop' | 'general_store' | 'character_trade';
  locationId?: string;    // null for general store
  shopId?: string;
  
  // Payment method
  paymentMethod: 'deposit' | 'cash';
  
  // Status
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // Metadata
  timestamp: Date;
  completedAt?: Date;
}

// Utility functions for currency conversion
export interface CurrencyUtils {
  // Convert everything to pence for calculations
  toPence(currency: VictorianCurrency): number;
  
  // Convert pence back to proper currency format
  fromPence(pence: number): VictorianCurrency;
  
  // Add two currency amounts
  add(amount1: VictorianCurrency, amount2: VictorianCurrency): VictorianCurrency;
  
  // Subtract currency amounts
  subtract(amount1: VictorianCurrency, amount2: VictorianCurrency): VictorianCurrency;
  
  // Check if amount1 >= amount2
  hasEnough(amount1: VictorianCurrency, amount2: VictorianCurrency): boolean;
  
  // Format currency for display
  format(currency: VictorianCurrency): string; // e.g., "2£ 15s 6d"
}

export interface EconomicTransaction {
  id: string;
  
  // Transaction participants
  initiatorId: string;    // Character who initiated
  participantId?: string; // Other character (for transfers)
  
  // Transaction type and details
  type: 'transfer' | 'purchase' | 'sale' | 'admin_adjustment' | 'salary' | 'fine';
  amount: VictorianCurrency;
  
  // Context
  description: string;
  relatedItemId?: string;
  relatedLocationId?: string;
  
  // Status and approval
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requiresApproval: boolean; // Large amounts or suspicious transactions
  approvedBy?: string;
  
  // Metadata
  timestamp: Date;
  processedAt?: Date;
}

// For tracking character economic activity
export interface CharacterEconomicStats {
  characterId: string;
  
  // Wealth tracking
  totalWealth: VictorianCurrency;        // deposit + cash
  weeklyIncome: VictorianCurrency;       // From occupation
  monthlyExpenses: VictorianCurrency;    // Average spending
  
  // Transaction history summary
  totalTransactions: number;
  largestTransaction: VictorianCurrency;
  mostFrequentTransactionType: string;
  
  // Economic status
  economicClass: 'destitute' | 'poor' | 'working' | 'comfortable' | 'wealthy' | 'rich' | 'very_rich';
  creditworthiness: number; // 1-100 scale
  
  // Period
  calculatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
}