import mongoose, { Schema, model, Document } from 'mongoose';
import { SocialClass } from '@shared/types/socialClass';

export enum ServiceCategory {
  SERVITU = 'servitu',
  COMUNICAZIONI = 'comunicazioni',
  TRASPORTI = 'trasporti',
  SICUREZZA = 'sicurezza'
}

export interface IService extends Document {
  name: string;
  description: string;
  category: ServiceCategory;

  // Cost in Valore di Credito (VC) points, not pence — see CharacterFinances.financeSkillValue
  monthlyCost: number;

  // [] = eligible for every social class (v1 default, Mercato.md does not restrict by class)
  socialClassesEligible: SocialClass[];

  isActive: boolean;

  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>({
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
    enum: Object.values(ServiceCategory)
  },
  monthlyCost: {
    type: Number,
    required: true,
    min: 1
  },
  socialClassesEligible: [{
    type: String,
    enum: ['destitute', 'poor', 'modest', 'lower_middle', 'middle_class', 'wealthy', 'affluent', 'elite']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'services'
});

ServiceSchema.index({ category: 1 });
ServiceSchema.index({ isActive: 1 });

export const Service = mongoose.models.Service || model<IService>('Service', ServiceSchema);
