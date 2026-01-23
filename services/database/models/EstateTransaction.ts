import mongoose, { Schema, model, Document } from 'mongoose';

export interface IEstateTransaction extends Document {
  transactionType: 'rental_payment' | 'rent_deposit' | 'purchase' | 'sale' | 'maintenance' | 'eviction_fee';
  propertyId: Schema.Types.ObjectId;
  characterId: Schema.Types.ObjectId;
  
  amount: number;
  currency: 'pence';
  
  // Payment details
  paymentMethod: 'cash' | 'bank_transfer' | 'credit_line';
  paymentSource: 'character_cash' | 'character_deposit' | 'character_credit';
  
  // Transaction context
  transactionDate: Date;
  effectiveDate?: Date; // Different from transaction date for future rent
  description: string;
  reference?: string; // Invoice number, etc.
  
  // Status and validation
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  processedBy?: Schema.Types.ObjectId; // Admin who processed
  
  // Related data
  rentalPeriod?: {
    startDate: Date;
    endDate: Date;
  };
  
  metadata: any; // Flexible field for additional context
  
  createdAt: Date;
  updatedAt: Date;
}

const EstateTransactionSchema = new Schema<IEstateTransaction>({
  transactionType: {
    type: String,
    required: true,
    enum: ['rental_payment', 'rent_deposit', 'purchase', 'sale', 'maintenance', 'eviction_fee']
  },
  propertyId: {
    type: Schema.Types.ObjectId,
    ref: 'HousingProperty',
    required: true
  },
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['pence'],
    default: 'pence'
  },
  
  // Payment details
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'bank_transfer', 'credit_line'],
    default: 'bank_transfer'
  },
  paymentSource: {
    type: String,
    required: true,
    enum: ['character_cash', 'character_deposit', 'character_credit'],
    default: 'character_deposit'
  },
  
  // Transaction context
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  effectiveDate: Date,
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  reference: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Status and validation
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  processedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Related data
  rentalPeriod: {
    startDate: {
      type: Date,
      required: function() { 
        return this.transactionType === 'rental_payment' || this.transactionType === 'rent_deposit'; 
      }
    },
    endDate: {
      type: Date,
      required: function() { 
        return this.transactionType === 'rental_payment' || this.transactionType === 'rent_deposit'; 
      }
    }
  },
  
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'estate_transactions'
});

// Indexes
EstateTransactionSchema.index({ propertyId: 1, transactionDate: -1 });
EstateTransactionSchema.index({ characterId: 1, transactionDate: -1 });
EstateTransactionSchema.index({ transactionType: 1, status: 1 });
EstateTransactionSchema.index({ status: 1, transactionDate: -1 });
EstateTransactionSchema.index({ reference: 1 }, { sparse: true });

// Methods
EstateTransactionSchema.methods.markCompleted = function(processedBy?: Schema.Types.ObjectId) {
  this.status = 'completed';
  if (processedBy) {
    this.processedBy = processedBy;
  }
  return this.save();
};

EstateTransactionSchema.methods.markFailed = function(reason?: string) {
  this.status = 'failed';
  if (reason) {
    this.metadata = { ...this.metadata, failureReason: reason };
  }
  return this.save();
};

EstateTransactionSchema.methods.refund = function(refundReason: string, processedBy?: Schema.Types.ObjectId) {
  this.status = 'refunded';
  this.metadata = { 
    ...this.metadata, 
    refundReason,
    refundDate: new Date()
  };
  if (processedBy) {
    this.processedBy = processedBy;
  }
  return this.save();
};

// Static methods
EstateTransactionSchema.statics.findByProperty = function(propertyId: Schema.Types.ObjectId, limit = 50) {
  return this.find({ propertyId })
    .sort({ transactionDate: -1 })
    .limit(limit)
    .populate('characterId', 'name')
    .populate('processedBy', 'username');
};

EstateTransactionSchema.statics.findByCharacter = function(characterId: Schema.Types.ObjectId, limit = 50) {
  return this.find({ characterId })
    .sort({ transactionDate: -1 })
    .limit(limit)
    .populate('propertyId')
    .populate('processedBy', 'username');
};

EstateTransactionSchema.statics.getRentPayments = function(propertyId: Schema.Types.ObjectId) {
  return this.find({ 
    propertyId,
    transactionType: { $in: ['rental_payment', 'rent_deposit'] },
    status: 'completed'
  }).sort({ transactionDate: -1 });
};

EstateTransactionSchema.statics.getTotalRentCollected = function(propertyId: Schema.Types.ObjectId, fromDate?: Date) {
  const query: any = { 
    propertyId,
    transactionType: { $in: ['rental_payment', 'rent_deposit'] },
    status: 'completed'
  };
  
  if (fromDate) {
    query.transactionDate = { $gte: fromDate };
  }
  
  return this.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);
};

EstateTransactionSchema.statics.getMonthlyReport = function(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        transactionDate: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$transactionType',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

EstateTransactionSchema.statics.createRentPayment = function(
  propertyId: Schema.Types.ObjectId,
  characterId: Schema.Types.ObjectId,
  amount: number,
  rentalPeriod: { startDate: Date; endDate: Date },
  description: string
) {
  return this.create({
    transactionType: 'rental_payment',
    propertyId,
    characterId,
    amount,
    currency: 'pence',
    paymentMethod: 'bank_transfer',
    paymentSource: 'character_deposit',
    description,
    status: 'completed',
    rentalPeriod
  });
};

EstateTransactionSchema.statics.createRentDeposit = function(
  propertyId: Schema.Types.ObjectId,
  characterId: Schema.Types.ObjectId,
  amount: number,
  rentalPeriod: { startDate: Date; endDate: Date },
  description: string
) {
  return this.create({
    transactionType: 'rent_deposit',
    propertyId,
    characterId,
    amount,
    currency: 'pence',
    paymentMethod: 'bank_transfer',
    paymentSource: 'character_deposit',
    description,
    status: 'completed',
    rentalPeriod
  });
};

EstateTransactionSchema.statics.createPurchase = function(
  propertyId: Schema.Types.ObjectId,
  characterId: Schema.Types.ObjectId,
  amount: number,
  description: string
) {
  return this.create({
    transactionType: 'purchase',
    propertyId,
    characterId,
    amount,
    currency: 'pence',
    paymentMethod: 'bank_transfer',
    paymentSource: 'character_deposit',
    description,
    status: 'completed'
  });
};

export const EstateTransaction = mongoose.models.EstateTransaction || model<IEstateTransaction>('EstateTransaction', EstateTransactionSchema);