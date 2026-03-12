import mongoose, { Schema, model, Document } from 'mongoose';
import { SocialClass } from '../../shared/types/socialClass';

export interface ILocationProperty extends Document {
  // Basic property info
  locationId: Schema.Types.ObjectId; // Reference to Location
  propertyType: 'basic_room' | 'furnished_room' | 'luxury_suite' | 'small_house' | 'large_house' | 'mansion';
  district: string;
  address?: string;
  
  // Ownership and rental
  ownershipType: 'rental' | 'owned' | 'available';
  currentTenantId?: Schema.Types.ObjectId; // Character renting
  ownerId?: Schema.Types.ObjectId; // Character who owns (for purchased properties)
  
  // Financial details
  monthlyRent?: number; // For rental properties
  purchasePrice?: number; // For properties for sale
  monthlyMaintenance: number; // Always applicable
  deposit?: number; // For rentals
  
  // Lease information (for rentals)
  leaseStart?: Date;
  leaseEnd?: Date;
  rentPaidUntil?: Date;
  lastRentPayment?: Date;
  
  // Property features and condition
  features: {
    furnished: boolean;
    hasKitchen: boolean;
    hasPrivateBathroom: boolean;
    hasGarden: boolean;
    hasBalcony: boolean;
    fireplace: boolean;
    gaslighting: boolean;
    waterSupply: 'none' | 'shared' | 'private';
    roomCount: number;
  };
  
  condition: 'poor' | 'fair' | 'good' | 'excellent';
  lastInspection?: Date;
  
  // Availability and restrictions
  isAvailable: boolean;
  availableFrom?: Date;
  socialClassRestriction?: SocialClass[];
  minimumIncome?: number;
  
  // Guest management (extends Location functionality)
  guestAccess: {
    characterId: Schema.Types.ObjectId;
    accessType: 'temporary' | 'permanent';
    grantedAt: Date;
    expiresAt?: Date;
    permissions: ('view' | 'stay_overnight')[];
  }[];
  
  // Property history
  rentalHistory: {
    tenantId: Schema.Types.ObjectId;
    startDate: Date;
    endDate?: Date;
    finalRent: number;
    reason: 'lease_end' | 'eviction' | 'early_termination' | 'purchase';
    notes?: string;
  }[];
  
  ownershipHistory: {
    ownerId: Schema.Types.ObjectId;
    acquiredDate: Date;
    soldDate?: Date;
    purchasePrice: number;
    salePrice?: number;
    transferReason: 'purchase' | 'inheritance' | 'gift' | 'foreclosure';
  }[];
  
  // Management
  managedBy?: Schema.Types.ObjectId; // Estate agent or corporation managing
  createdAt: Date;
  updatedAt: Date;
}

const LocationPropertySchema = new Schema<ILocationProperty>({
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    unique: true // One housing property per location
  },
  propertyType: {
    type: String,
    required: true,
    enum: ['basic_room', 'furnished_room', 'luxury_suite', 'small_house', 'large_house', 'mansion']
  },
  district: {
    type: String,
    required: true
  },
  address: String,
  
  ownershipType: {
    type: String,
    required: true,
    enum: ['rental', 'owned', 'available']
  },
  currentTenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  
  monthlyRent: {
    type: Number,
    min: 0
  },
  purchasePrice: {
    type: Number,
    min: 0
  },
  monthlyMaintenance: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  deposit: {
    type: Number,
    min: 0
  },
  
  leaseStart: Date,
  leaseEnd: Date,
  rentPaidUntil: Date,
  lastRentPayment: Date,
  
  features: {
    furnished: { type: Boolean, default: false },
    hasKitchen: { type: Boolean, default: false },
    hasPrivateBathroom: { type: Boolean, default: false },
    hasGarden: { type: Boolean, default: false },
    hasBalcony: { type: Boolean, default: false },
    fireplace: { type: Boolean, default: false },
    gaslighting: { type: Boolean, default: false },
    waterSupply: { 
      type: String, 
      enum: ['none', 'shared', 'private'],
      default: 'none'
    },
    roomCount: { type: Number, default: 1, min: 1 }
  },
  
  condition: {
    type: String,
    enum: ['poor', 'fair', 'good', 'excellent'],
    default: 'fair'
  },
  lastInspection: Date,
  
  isAvailable: { type: Boolean, default: true },
  availableFrom: Date,
  socialClassRestriction: [{
    type: String,
    enum: ['destitute', 'poor', 'modest', 'lower_middle', 'middle_class', 'wealthy', 'affluent', 'elite']
  }],
  minimumIncome: { type: Number, min: 0 },
  
  guestAccess: [{
    characterId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    accessType: {
      type: String,
      enum: ['temporary', 'permanent'],
      required: true
    },
    grantedAt: { type: Date, required: true },
    expiresAt: Date,
    permissions: [{
      type: String,
      enum: ['view', 'stay_overnight']
    }]
  }],
  
  rentalHistory: [{
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    startDate: { type: Date, required: true },
    endDate: Date,
    finalRent: { type: Number, required: true },
    reason: {
      type: String,
      enum: ['lease_end', 'eviction', 'early_termination', 'purchase'],
      required: true
    },
    notes: String
  }],
  
  ownershipHistory: [{
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    acquiredDate: { type: Date, required: true },
    soldDate: Date,
    purchasePrice: { type: Number, required: true },
    salePrice: Number,
    transferReason: {
      type: String,
      enum: ['purchase', 'inheritance', 'gift', 'foreclosure'],
      required: true
    }
  }],
  
  managedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  }
}, {
  timestamps: true,
  collection: 'location_properties'
});

// Indexes
LocationPropertySchema.index({ district: 1, isAvailable: 1 });
LocationPropertySchema.index({ propertyType: 1, ownershipType: 1 });
LocationPropertySchema.index({ currentTenantId: 1 });
LocationPropertySchema.index({ ownerId: 1 });
LocationPropertySchema.index({ rentPaidUntil: 1 }); // For automated rent collection
LocationPropertySchema.index({ monthlyRent: 1, district: 1 });

// Methods
LocationPropertySchema.methods.isRentOverdue = function() {
  return this.ownershipType === 'rental' && 
         this.rentPaidUntil && 
         new Date() > this.rentPaidUntil;
};

LocationPropertySchema.methods.getDaysOverdue = function() {
  if (!this.isRentOverdue()) return 0;
  return Math.floor((Date.now() - this.rentPaidUntil.getTime()) / (1000 * 60 * 60 * 24));
};

LocationPropertySchema.methods.canAfford = function(characterFinances: any) {
  if (!this.monthlyRent) return false;
  const totalUpfront = this.monthlyRent + (this.deposit || this.monthlyRent);
  const availableFunds = characterFinances.cash + characterFinances.bankDeposit;
  return availableFunds >= totalUpfront;
};

LocationPropertySchema.methods.grantGuestAccess = function(
  characterId: Schema.Types.ObjectId, 
  permissions: string[], 
  duration: 'temporary' | 'permanent' = 'temporary'
) {
  // Remove existing access for this character
  this.guestAccess = this.guestAccess.filter((g: any) => !g.characterId.equals(characterId));
  
  const expiresAt = duration === 'temporary' ? 
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : // 7 days
    undefined;
  
  // Add new access
  this.guestAccess.push({
    characterId,
    accessType: duration,
    grantedAt: new Date(),
    expiresAt,
    permissions
  });
};

LocationPropertySchema.methods.revokeGuestAccess = function(characterId: Schema.Types.ObjectId) {
  this.guestAccess = this.guestAccess.filter((g: any) => !g.characterId.equals(characterId));
};

LocationPropertySchema.methods.addToRentalHistory = function(
  tenantId: Schema.Types.ObjectId,
  startDate: Date,
  finalRent: number,
  reason: string,
  endDate?: Date,
  notes?: string
) {
  this.rentalHistory.push({
    tenantId,
    startDate,
    endDate,
    finalRent,
    reason,
    notes
  });
};

LocationPropertySchema.methods.addToOwnershipHistory = function(
  ownerId: Schema.Types.ObjectId,
  acquiredDate: Date,
  purchasePrice: number,
  transferReason: string
) {
  this.ownershipHistory.push({
    ownerId,
    acquiredDate,
    purchasePrice,
    transferReason
  });
};

// Static methods
LocationPropertySchema.statics.findAvailableInDistrict = function(
  district: string, 
  filters: any = {}
) {
  const query = {
    district,
    isAvailable: true,
    ownershipType: { $in: ['rental', 'available'] },
    ...filters
  };
  
  return this.find(query)
    .populate('locationId', 'name description')
    .sort({ monthlyRent: 1 });
};

LocationPropertySchema.statics.findByTenant = function(characterId: Schema.Types.ObjectId) {
  return this.find({ currentTenantId: characterId })
    .populate('locationId', 'name description');
};

LocationPropertySchema.statics.findByOwner = function(characterId: Schema.Types.ObjectId) {
  return this.find({ ownerId: characterId })
    .populate('locationId', 'name description');
};

LocationPropertySchema.statics.findOverdueRent = function() {
  return this.find({
    ownershipType: 'rental',
    currentTenantId: { $exists: true },
    rentPaidUntil: { $lt: new Date() }
  }).populate('currentTenantId', 'name');
};

export const LocationProperty = mongoose.models.LocationProperty || model<ILocationProperty>('LocationProperty', LocationPropertySchema);