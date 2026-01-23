import { Schema, Document, model, models } from 'mongoose';

// Extended session management data - companion to GamingSession
export interface ISessionManagement extends Document {
  sessionId: Schema.Types.ObjectId; // Reference to GamingSession
  
  // Enhanced session planning
  planning: {
    isPublic: boolean; // Visible to all players
    maxParticipants?: number;
    minParticipants?: number;
    requiresPreRegistration: boolean;
    registrationDeadline?: Date;
    
    // Prerequisites
    characterLevelRange?: {
      min: number;
      max: number;
    };
    requiredSkills?: {
      skill: string;
      minValue: number;
    }[];
    restrictedOccupations?: string[];
    
    // Preparation materials
    preparationNotes?: string;
    requiredReading?: string[];
    propsNeeded?: string[];
  };
  
  // Enhanced participant management
  participantManagement: {
    registrations: {
      characterId: Schema.Types.ObjectId;
      characterName: string;
      registeredAt: Date;
      status: 'registered' | 'confirmed' | 'declined' | 'waitlist';
      characterNotes?: string; // Player's notes about their character's involvement
      masterNotes?: string; // Master's private notes about this participant
    }[];
    
    waitlist: {
      characterId: Schema.Types.ObjectId;
      characterName: string;
      addedAt: Date;
      priority: number;
    }[];
    
    invitations: {
      characterId: Schema.Types.ObjectId;
      invitedBy: Schema.Types.ObjectId;
      invitedAt: Date;
      responded: boolean;
      responseAt?: Date;
      response?: 'accepted' | 'declined' | 'tentative';
      message?: string;
    }[];
  };
  
  // Real-time session tracking
  liveSession: {
    isActive: boolean;
    actualStartTime?: Date;
    currentScene?: {
      title: string;
      description: string;
      currentLocation: Schema.Types.ObjectId;
      startTime: Date;
    };
    
    // Real-time participant status
    participantStatus: {
      characterId: Schema.Types.ObjectId;
      isOnline: boolean;
      lastSeen: Date;
      currentAction?: string;
      afkSince?: Date;
    }[];
    
    // Master tools state
    masterTools: {
      diceRollsEnabled: boolean;
      privateNotesVisible: boolean;
      backgroundMusicUrl?: string;
      currentMood: 'tense' | 'relaxed' | 'mysterious' | 'action' | 'social';
    };
    
    // Session logs
    activityLog: {
      timestamp: Date;
      type: 'join' | 'leave' | 'dice_roll' | 'scene_change' | 'master_note' | 'character_action';
      characterId?: Schema.Types.ObjectId;
      description: string;
      data?: any;
    }[];
  };
  
  // Post-session management
  postSession: {
    feedback: {
      characterId: Schema.Types.ObjectId;
      rating: number; // 1-5
      feedback: string;
      highlights: string[];
      suggestions: string[];
      submittedAt: Date;
      isAnonymous: boolean;
    }[];
    
    masterReflection: {
      whatWentWell: string[];
      whatToImprove: string[];
      unexpectedEvents: string[];
      plotThreadsAdvanced: string[];
      newPlotHooks: string[];
      nextSessionPrep: string[];
    };
    
    // Auto-generated summary
    aiSummary?: {
      sessionHighlights: string[];
      characterMoments: {
        characterId: Schema.Types.ObjectId;
        significantActions: string[];
        characterGrowth: string[];
      }[];
      plotAdvancement: string;
      generatedAt: Date;
    };
  };
  
  // Analytics and metrics
  analytics: {
    totalActiveTime: number; // in minutes
    averageParticipantEngagement: number; // 0-100 score
    messageCount: number;
    diceRollCount: number;
    sceneChanges: number;
    
    characterMetrics: {
      characterId: Schema.Types.ObjectId;
      activeTime: number;
      messagesSent: number;
      engagementScore: number;
      roleplayMoments: number;
    }[];
    
    popularScenes: {
      location: Schema.Types.ObjectId;
      timeSpent: number;
      participantEngagement: number;
    }[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const SessionManagementSchema = new Schema<ISessionManagement>({
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'GamingSession',
    required: true,
    unique: true,
    index: true
  },
  
  planning: {
    isPublic: {
      type: Boolean,
      default: true,
      index: true
    },
    maxParticipants: {
      type: Number,
      min: 2,
      max: 12
    },
    minParticipants: {
      type: Number,
      min: 1,
      max: 10
    },
    requiresPreRegistration: {
      type: Boolean,
      default: true
    },
    registrationDeadline: Date,
    
    characterLevelRange: {
      min: { type: Number, min: 1, max: 100 },
      max: { type: Number, min: 1, max: 100 }
    },
    requiredSkills: [{
      skill: { type: String, required: true },
      minValue: { type: Number, min: 1, max: 100 }
    }],
    restrictedOccupations: [String],
    
    preparationNotes: {
      type: String,
      maxlength: 2000
    },
    requiredReading: [{
      type: String,
      maxlength: 200
    }],
    propsNeeded: [{
      type: String,
      maxlength: 200
    }]
  },
  
  participantManagement: {
    registrations: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      characterName: {
        type: String,
        required: true
      },
      registeredAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ['registered', 'confirmed', 'declined', 'waitlist'],
        default: 'registered'
      },
      characterNotes: {
        type: String,
        maxlength: 500
      },
      masterNotes: {
        type: String,
        maxlength: 500
      }
    }],
    
    waitlist: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      characterName: {
        type: String,
        required: true
      },
      addedAt: {
        type: Date,
        default: Date.now
      },
      priority: {
        type: Number,
        required: true
      }
    }],
    
    invitations: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      invitedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      invitedAt: {
        type: Date,
        default: Date.now
      },
      responded: {
        type: Boolean,
        default: false
      },
      responseAt: Date,
      response: {
        type: String,
        enum: ['accepted', 'declined', 'tentative']
      },
      message: {
        type: String,
        maxlength: 500
      }
    }]
  },
  
  liveSession: {
    isActive: {
      type: Boolean,
      default: false
    },
    actualStartTime: Date,
    currentScene: {
      title: String,
      description: String,
      currentLocation: {
        type: Schema.Types.ObjectId,
        ref: 'Location'
      },
      startTime: Date
    },
    
    participantStatus: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      isOnline: {
        type: Boolean,
        default: false
      },
      lastSeen: {
        type: Date,
        default: Date.now
      },
      currentAction: String,
      afkSince: Date
    }],
    
    masterTools: {
      diceRollsEnabled: {
        type: Boolean,
        default: true
      },
      privateNotesVisible: {
        type: Boolean,
        default: false
      },
      backgroundMusicUrl: String,
      currentMood: {
        type: String,
        enum: ['tense', 'relaxed', 'mysterious', 'action', 'social'],
        default: 'relaxed'
      }
    },
    
    activityLog: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      type: {
        type: String,
        enum: ['join', 'leave', 'dice_roll', 'scene_change', 'master_note', 'character_action'],
        required: true
      },
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character'
      },
      description: {
        type: String,
        required: true,
        maxlength: 500
      },
      data: Schema.Types.Mixed
    }]
  },
  
  postSession: {
    feedback: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
      },
      feedback: {
        type: String,
        maxlength: 2000
      },
      highlights: [{
        type: String,
        maxlength: 200
      }],
      suggestions: [{
        type: String,
        maxlength: 200
      }],
      submittedAt: {
        type: Date,
        default: Date.now
      },
      isAnonymous: {
        type: Boolean,
        default: false
      }
    }],
    
    masterReflection: {
      whatWentWell: [{
        type: String,
        maxlength: 500
      }],
      whatToImprove: [{
        type: String,
        maxlength: 500
      }],
      unexpectedEvents: [{
        type: String,
        maxlength: 500
      }],
      plotThreadsAdvanced: [{
        type: String,
        maxlength: 500
      }],
      newPlotHooks: [{
        type: String,
        maxlength: 500
      }],
      nextSessionPrep: [{
        type: String,
        maxlength: 500
      }]
    },
    
    aiSummary: {
      sessionHighlights: [{
        type: String,
        maxlength: 500
      }],
      characterMoments: [{
        characterId: {
          type: Schema.Types.ObjectId,
          ref: 'Character'
        },
        significantActions: [{
          type: String,
          maxlength: 200
        }],
        characterGrowth: [{
          type: String,
          maxlength: 200
        }]
      }],
      plotAdvancement: {
        type: String,
        maxlength: 1000
      },
      generatedAt: {
        type: Date,
        default: Date.now
      }
    }
  },
  
  analytics: {
    totalActiveTime: {
      type: Number,
      default: 0
    },
    averageParticipantEngagement: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    messageCount: {
      type: Number,
      default: 0
    },
    diceRollCount: {
      type: Number,
      default: 0
    },
    sceneChanges: {
      type: Number,
      default: 0
    },
    
    characterMetrics: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      activeTime: {
        type: Number,
        default: 0
      },
      messagesSent: {
        type: Number,
        default: 0
      },
      engagementScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      roleplayMoments: {
        type: Number,
        default: 0
      }
    }],
    
    popularScenes: [{
      location: {
        type: Schema.Types.ObjectId,
        ref: 'Location',
        required: true
      },
      timeSpent: {
        type: Number,
        required: true
      },
      participantEngagement: {
        type: Number,
        min: 0,
        max: 100
      }
    }]
  }
}, {
  timestamps: true,
  collection: 'session_management'
});

// Indexes
SessionManagementSchema.index({ 'participantManagement.registrations.characterId': 1 });
SessionManagementSchema.index({ 'liveSession.isActive': 1 });
SessionManagementSchema.index({ 'planning.isPublic': 1, 'planning.registrationDeadline': 1 });

export const SessionManagement = models.SessionManagement || model<ISessionManagement>('SessionManagement', SessionManagementSchema);