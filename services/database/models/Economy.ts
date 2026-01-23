import mongoose, { Schema, model, Document } from 'mongoose';

export interface ICharacterWallet extends Document {
  characterId: Schema.Types.ObjectId;
  
  // Dual currency storage
  cash: number;              // Money carried (pence)
  deposit: number;           // Money in bank (pence)
  
  // Salary system
  salary?: {
    occupationSalary: number;          // Daily salary from occupation (paid by "the state")
    corporationSalaries: {
      corporationId: Schema.Types.ObjectId;
      roleId: string;
      dailyAmount: number;             // Daily salary from corporation role
    }[];
    lastOccupationPayout?: Date;
    lastCorporationPayouts?: {
      corporationId: Schema.Types.ObjectId;
      lastPayout: Date;
    }[];
  };
  
  // Transaction limits and settings
  settings: {
    maxCashCarried?: number;           // Safety limit for carried cash
    autoDepositThreshold?: number;     // Auto-deposit when cash exceeds this
    allowBankTransfers: boolean;
    allowCashTransfers: boolean;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastTransactionAt?: Date;
}

export interface ITransaction extends Document {
  // Transaction identification
  transactionId: string;
  type: 'transfer' | 'purchase' | 'salary' | 'admin_grant' | 'shop_sale' | 'corporation_payment' | 'fee' | 'refund';
  
  // Participants
  fromCharacterId?: Schema.Types.ObjectId;  // null for system transactions
  toCharacterId?: Schema.Types.ObjectId;    // null for purchases/fees
  
  // Transaction details
  amount: number;                    // Amount in pence
  currency: 'cash' | 'deposit';     // Type of money transferred
  
  // Description and context
  description: string;
  reason?: string;
  category?: 'reward' | 'compensation' | 'correction' | 'event_prize' | 'purchase' | 'trade' | 'salary' | 'other';
  
  // Related entities
  relatedTo?: {
    type: 'item_purchase' | 'shop_sale' | 'corporation' | 'location' | 'character' | 'admin_action';
    id: Schema.Types.ObjectId;
  };
  
  // Admin/system info
  processedBy?: Schema.Types.ObjectId;  // Admin user who processed (for admin grants)
  systemGenerated: boolean;             // Auto-generated (salaries, etc.)
  
  // Balance tracking (for auditing)
  balancesBefore: {
    fromCharacter?: { cash: number; deposit: number };
    toCharacter?: { cash: number; deposit: number };
  };
  balancesAfter: {
    fromCharacter?: { cash: number; deposit: number };
    toCharacter?: { cash: number; deposit: number };
  };
  
  // Status and processing
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  failureReason?: string;
  
  // Timestamps
  createdAt: Date;
  processedAt?: Date;
}

export interface IEconomicReport extends Document {
  // Report metadata
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // Money supply analysis
  moneySupply: {
    totalCash: number;
    totalDeposits: number;
    totalSupply: number;
    supplyGrowth: number;              // Percentage change from previous period
    avgPlayerBalance: number;
    medianPlayerBalance: number;
    wealthDistribution: {
      bottom50Percent: number;         // Total wealth of bottom 50% of players
      top10Percent: number;            // Total wealth of top 10% of players
      top1Percent: number;             // Total wealth of top 1% of players
    };
  };
  
  // Transaction activity
  transactionActivity: {
    totalTransactions: number;
    totalVolume: number;               // Total amount transacted
    averageTransactionSize: number;
    
    byType: {
      playerToPlayer: { count: number; volume: number };
      shopPurchases: { count: number; volume: number };
      adminGrants: { count: number; volume: number };
      corporationPayments: { count: number; volume: number };
      salaries: { count: number; volume: number };
    };
    
    topTransactions: {
      amount: number;
      type: string;
      description: string;
      date: Date;
    }[];
  };
  
  // Item economy
  itemEconomy: {
    mostTradedItems: {
      itemId: Schema.Types.ObjectId;
      itemName: string;
      transactionCount: number;
      totalVolume: number;
      averagePrice: number;
    }[];
    
    priceInflation: {
      itemId: Schema.Types.ObjectId;
      itemName: string;
      priceChange: number;             // Percentage change
      oldAveragePrice: number;
      newAveragePrice: number;
    }[];
    
    shortageAlerts: {
      itemId: Schema.Types.ObjectId;
      itemName: string;
      totalStock: number;
      demandIndicator: number;
    }[];
  };
  
  // Corporation finances
  corporationFinances: {
    totalTreasuryFunds: number;
    avgTreasuryBalance: number;
    corporationsInDebt: number;
    totalRevenue: number;
    totalExpenses: number;
    
    byCorporation: {
      corporationId: Schema.Types.ObjectId;
      corporationName: string;
      treasuryBalance: number;
      monthlyRevenue: number;
      monthlyExpenses: number;
      memberCount: number;
    }[];
  };
  
  // Economic alerts
  alerts: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    data?: any;
  }[];
  
  // Report metadata
  generatedBy: Schema.Types.ObjectId;
  generatedAt: Date;
}

const CharacterWalletSchema = new Schema<ICharacterWallet>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    unique: true
  },
  
  // Currency
  cash: {
    type: Number,
    required: true,
    default: 1000,    // Starting cash from config
    min: 0
  },
  deposit: {
    type: Number,
    required: true,
    default: 5000,    // Starting deposit from config
    min: 0
  },
  
  // Salary system
  salary: {
    occupationSalary: { type: Number, default: 0 },
    corporationSalaries: [{
      corporationId: {
        type: Schema.Types.ObjectId,
        ref: 'Corporation',
        required: true
      },
      roleId: { type: String, required: true },
      dailyAmount: { type: Number, required: true, min: 0 }
    }],
    lastOccupationPayout: Date,
    lastCorporationPayouts: [{
      corporationId: {
        type: Schema.Types.ObjectId,
        ref: 'Corporation',
        required: true
      },
      lastPayout: { type: Date, required: true }
    }]
  },
  
  // Settings
  settings: {
    maxCashCarried: { type: Number, min: 0 },
    autoDepositThreshold: { type: Number, min: 0 },
    allowBankTransfers: { type: Boolean, default: true },
    allowCashTransfers: { type: Boolean, default: true }
  },
  
  lastTransactionAt: Date
}, {
  timestamps: true,
  collection: 'character_wallets'
});

const TransactionSchema = new Schema<ITransaction>({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['transfer', 'purchase', 'salary', 'admin_grant', 'shop_sale', 'corporation_payment', 'fee', 'refund']
  },
  
  // Participants
  fromCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  toCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  
  // Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['cash', 'deposit']
  },
  
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  reason: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  category: {
    type: String,
    enum: ['reward', 'compensation', 'correction', 'event_prize', 'purchase', 'trade', 'salary', 'other']
  },
  
  // Related entities
  relatedTo: {
    type: {
      type: String,
      enum: ['item_purchase', 'shop_sale', 'corporation', 'location', 'character', 'admin_action']
    },
    id: Schema.Types.ObjectId
  },
  
  // Processing info
  processedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  systemGenerated: {
    type: Boolean,
    default: false
  },
  
  // Balance tracking
  balancesBefore: {
    fromCharacter: {
      cash: Number,
      deposit: Number
    },
    toCharacter: {
      cash: Number,
      deposit: Number
    }
  },
  balancesAfter: {
    fromCharacter: {
      cash: Number,
      deposit: Number
    },
    toCharacter: {
      cash: Number,
      deposit: Number
    }
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  failureReason: String,
  
  processedAt: Date
}, {
  timestamps: true,
  collection: 'transactions'
});

const EconomicReportSchema = new Schema<IEconomicReport>({
  reportType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    required: true
  },
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  
  moneySupply: {
    totalCash: { type: Number, required: true },
    totalDeposits: { type: Number, required: true },
    totalSupply: { type: Number, required: true },
    supplyGrowth: { type: Number, required: true },
    avgPlayerBalance: { type: Number, required: true },
    medianPlayerBalance: { type: Number, required: true },
    wealthDistribution: {
      bottom50Percent: Number,
      top10Percent: Number,
      top1Percent: Number
    }
  },
  
  transactionActivity: {
    totalTransactions: { type: Number, required: true },
    totalVolume: { type: Number, required: true },
    averageTransactionSize: { type: Number, required: true },
    
    byType: {
      playerToPlayer: { count: Number, volume: Number },
      shopPurchases: { count: Number, volume: Number },
      adminGrants: { count: Number, volume: Number },
      corporationPayments: { count: Number, volume: Number },
      salaries: { count: Number, volume: Number }
    },
    
    topTransactions: [{
      amount: Number,
      type: String,
      description: String,
      date: Date
    }]
  },
  
  itemEconomy: {
    mostTradedItems: [{
      itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      itemName: String,
      transactionCount: Number,
      totalVolume: Number,
      averagePrice: Number
    }],
    
    priceInflation: [{
      itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      itemName: String,
      priceChange: Number,
      oldAveragePrice: Number,
      newAveragePrice: Number
    }],
    
    shortageAlerts: [{
      itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      itemName: String,
      totalStock: Number,
      demandIndicator: Number
    }]
  },
  
  corporationFinances: {
    totalTreasuryFunds: Number,
    avgTreasuryBalance: Number,
    corporationsInDebt: Number,
    totalRevenue: Number,
    totalExpenses: Number,
    
    byCorporation: [{
      corporationId: { type: Schema.Types.ObjectId, ref: 'Corporation' },
      corporationName: String,
      treasuryBalance: Number,
      monthlyRevenue: Number,
      monthlyExpenses: Number,
      memberCount: Number
    }]
  },
  
  alerts: [{
    type: String,
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    message: String,
    data: Schema.Types.Mixed
  }],
  
  generatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'economic_reports'
});

// Indexes
// characterId already has unique constraint

// transactionId already has unique constraint
TransactionSchema.index({ fromCharacterId: 1, createdAt: -1 });
TransactionSchema.index({ toCharacterId: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, createdAt: -1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ 'relatedTo.type': 1, 'relatedTo.id': 1 });

EconomicReportSchema.index({ reportType: 1, 'period.startDate': -1 });
EconomicReportSchema.index({ generatedAt: -1 });

// Methods
CharacterWalletSchema.methods.getTotalBalance = function() {
  return this.cash + this.deposit;
};

CharacterWalletSchema.methods.hasEnoughFunds = function(amount: number, currency: 'cash' | 'deposit' | 'total' = 'total') {
  switch (currency) {
    case 'cash':
      return this.cash >= amount;
    case 'deposit':
      return this.deposit >= amount;
    case 'total':
      return this.getTotalBalance() >= amount;
    default:
      return false;
  }
};

CharacterWalletSchema.methods.addFunds = function(amount: number, currency: 'cash' | 'deposit') {
  if (currency === 'cash') {
    this.cash += amount;
  } else {
    this.deposit += amount;
  }
  this.lastTransactionAt = new Date();
};

CharacterWalletSchema.methods.removeFunds = function(amount: number, currency: 'cash' | 'deposit') {
  if (currency === 'cash' && this.cash >= amount) {
    this.cash -= amount;
    this.lastTransactionAt = new Date();
    return true;
  } else if (currency === 'deposit' && this.deposit >= amount) {
    this.deposit -= amount;
    this.lastTransactionAt = new Date();
    return true;
  }
  return false;
};

CharacterWalletSchema.methods.transferFunds = function(amount: number, from: 'cash' | 'deposit', to: 'cash' | 'deposit') {
  if (this.hasEnoughFunds(amount, from)) {
    this.removeFunds(amount, from);
    this.addFunds(amount, to);
    return true;
  }
  return false;
};

CharacterWalletSchema.methods.formatCurrency = function(amount: number) {
  // Convert pence to pounds, shillings, pence
  const pounds = Math.floor(amount / 240);
  const shillings = Math.floor((amount % 240) / 12);
  const pence = amount % 12;
  
  if (pounds > 0) {
    return `£${pounds} ${shillings}s ${pence}d`;
  } else if (shillings > 0) {
    return `${shillings}s ${pence}d`;
  } else {
    return `${pence}d`;
  }
};

CharacterWalletSchema.methods.addCorporationSalary = function(corporationId: Schema.Types.ObjectId, roleId: string, dailyAmount: number) {
  if (!this.salary) {
    this.salary = { occupationSalary: 0, corporationSalaries: [], lastCorporationPayouts: [] };
  }
  
  // Remove existing salary for this corporation
  this.salary.corporationSalaries = this.salary.corporationSalaries.filter((s: any) => !s.corporationId.equals(corporationId));
  
  // Add new salary
  this.salary.corporationSalaries.push({
    corporationId,
    roleId,
    dailyAmount
  });
};

CharacterWalletSchema.methods.removeCorporationSalary = function(corporationId: Schema.Types.ObjectId) {
  if (this.salary) {
    this.salary.corporationSalaries = this.salary.corporationSalaries.filter((s: any) => !s.corporationId.equals(corporationId));
    this.salary.lastCorporationPayouts = this.salary.lastCorporationPayouts.filter((p: any) => !p.corporationId.equals(corporationId));
  }
};

TransactionSchema.methods.generateTransactionId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `tx_${timestamp}_${random}`;
};

TransactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = (this as any).generateTransactionId();
  }
  next();
});

export const CharacterWallet = mongoose.models.CharacterWallet || model<ICharacterWallet>('CharacterWallet', CharacterWalletSchema);
export const Transaction = mongoose.models.Transaction || model<ITransaction>('Transaction', TransactionSchema);
export const EconomicReport = mongoose.models.EconomicReport || model<IEconomicReport>('EconomicReport', EconomicReportSchema);