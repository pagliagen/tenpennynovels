import mongoose, { Document, Schema } from 'mongoose';

// Financial Transaction Types
export type TransactionType = 
  | 'credit_purchase'        // Purchase using credit line
  | 'cash_purchase'          // Purchase using cash
  | 'credit_reset'           // Weekly credit reset
  | 'initial_wealth'         // Character creation initial wealth
  | 'salary_payment'         // Occupation salary
  | 'admin_adjustment'       // Manual admin adjustment
  | 'bank_transfer'          // Transfer between cash and bank
  | 'character_transfer';    // Transfer between characters

// Financial Transaction Interface
export interface IFinancialTransaction extends Document {
  characterId: mongoose.Types.ObjectId; // Who made the transaction
  type: TransactionType;
  
  // Transaction details
  description: string; // Human readable description
  amount: number; // Amount in pounds (positive = gain, negative = expense)
  
  // What was affected
  cashChange: number; // Change in cash (can be 0)
  bankChange: number; // Change in bank deposit (can be 0)
  creditUsed: number; // Amount of credit used (0 if none)
  
  // Item related (for purchases)
  itemId?: mongoose.Types.ObjectId; // Reference to purchased item
  itemName?: string; // Name of purchased item (for history)
  quantity?: number; // Quantity purchased
  
  // Balances after transaction
  cashAfter: number;
  bankAfter: number;
  creditAvailableAfter: number;
  
  // Context
  locationId?: mongoose.Types.ObjectId; // Where transaction occurred
  relatedCharacterId?: mongoose.Types.ObjectId; // For character transfers
  adminUserId?: mongoose.Types.ObjectId; // Admin who made adjustment
  
  // Social class context at time of transaction
  socialClassAtTime: string;
  financeSkillAtTime: number;
  
  // Metadata
  metadata?: any; // Additional transaction-specific data
  timestamp: Date;
  createdAt: Date;
}

// Financial Transaction Schema
const FinancialTransactionSchema = new Schema<IFinancialTransaction>({
  characterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  type: {
    type: String,
    enum: [
      'credit_purchase',
      'cash_purchase',
      'credit_reset',
      'initial_wealth',
      'salary_payment',
      'admin_adjustment',
      'bank_transfer',
      'character_transfer'
    ],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  cashChange: {
    type: Number,
    required: true,
    default: 0
  },
  bankChange: {
    type: Number,
    required: true,
    default: 0
  },
  creditUsed: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  },
  itemName: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    min: 1,
    default: 1
  },
  cashAfter: {
    type: Number,
    required: true,
    min: 0
  },
  bankAfter: {
    type: Number,
    required: true,
    min: 0
  },
  creditAvailableAfter: {
    type: Number,
    required: true,
    min: 0
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  relatedCharacterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character'
  },
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  socialClassAtTime: {
    type: String,
    required: true,
    trim: true
  },
  financeSkillAtTime: {
    type: Number,
    required: true,
    min: 1,
    max: 99
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: true, updatedAt: false } // Only track creation time
});

// Indexes for efficient queries
FinancialTransactionSchema.index({ characterId: 1, timestamp: -1 });
FinancialTransactionSchema.index({ type: 1, timestamp: -1 });
FinancialTransactionSchema.index({ itemId: 1 });
FinancialTransactionSchema.index({ timestamp: -1 });

// Model
export const FinancialTransaction = mongoose.models.FinancialTransaction || mongoose.model<IFinancialTransaction>('FinancialTransaction', FinancialTransactionSchema);