import { Schema, Document, model, models } from 'mongoose';

export interface ICampaign extends Document {
  // Campaign identification
  title: string;
  description: string;
  masterIds: Schema.Types.ObjectId[]; // Multiple masters can co-run
  
  // Campaign structure
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  isRecruiting: boolean;
  
  // Participant management
  players: {
    characterId: Schema.Types.ObjectId;
    joinedAt: Date;
    status: 'active' | 'inactive' | 'removed';
    characterArc?: string;
    personalGoals?: string[];
  }[];
  
  // Campaign progression
  sessions: Schema.Types.ObjectId[]; // References to GamingSessions
  currentChapter: {
    chapterNumber: number;
    chapterTitle: string;
    chapterSummary: string;
    startedAt: Date;
  };
  
  // World and setting
  setting: {
    worldName: string;
    timeframe: string;
    majorLocations: Schema.Types.ObjectId[];
    worldNotes: string;
  };
  
  // Plot tracking
  plotThreads: {
    title: string;
    description: string;
    status: 'active' | 'resolved' | 'on_hold';
    introducedInSession?: Schema.Types.ObjectId;
    involvedCharacters: Schema.Types.ObjectId[];
    resolution?: string;
  }[];
  
  // NPCs and recurring elements
  recurringNPCs: {
    name: string;
    description: string;
    relationship: 'ally' | 'enemy' | 'neutral' | 'unknown';
    lastAppearance?: Schema.Types.ObjectId;
    notes: string;
  }[];
  
  // Campaign metadata
  estimatedLength: number; // in sessions
  sessionFrequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  averageSessionLength: number; // in minutes
  
  // Analytics
  analytics: {
    totalSessions: number;
    totalPlaytime: number; // in minutes
    averageAttendance: number; // percentage
    playerRetention: number; // percentage
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>({
  title: {
    type: String,
    required: true,
    maxlength: 200,
    index: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  masterIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  }],
  
  status: {
    type: String,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'planning',
    index: true
  },
  isRecruiting: {
    type: Boolean,
    default: false,
    index: true
  },
  
  players: [{
    characterId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'removed'],
      default: 'active'
    },
    characterArc: {
      type: String,
      maxlength: 1000
    },
    personalGoals: [{
      type: String,
      maxlength: 200
    }]
  }],
  
  sessions: [{
    type: Schema.Types.ObjectId,
    ref: 'GamingSession'
  }],
  
  currentChapter: {
    chapterNumber: {
      type: Number,
      default: 1,
      min: 1
    },
    chapterTitle: {
      type: String,
      required: true,
      maxlength: 200
    },
    chapterSummary: {
      type: String,
      maxlength: 2000
    },
    startedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  setting: {
    worldName: {
      type: String,
      required: true,
      maxlength: 100
    },
    timeframe: {
      type: String,
      required: true,
      maxlength: 100
    },
    majorLocations: [{
      type: Schema.Types.ObjectId,
      ref: 'Location'
    }],
    worldNotes: {
      type: String,
      maxlength: 5000
    }
  },
  
  plotThreads: [{
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'on_hold'],
      default: 'active'
    },
    introducedInSession: {
      type: Schema.Types.ObjectId,
      ref: 'GamingSession'
    },
    involvedCharacters: [{
      type: Schema.Types.ObjectId,
      ref: 'Character'
    }],
    resolution: {
      type: String,
      maxlength: 1000
    }
  }],
  
  recurringNPCs: [{
    name: {
      type: String,
      required: true,
      maxlength: 100
    },
    description: {
      type: String,
      required: true,
      maxlength: 500
    },
    relationship: {
      type: String,
      enum: ['ally', 'enemy', 'neutral', 'unknown'],
      default: 'neutral'
    },
    lastAppearance: {
      type: Schema.Types.ObjectId,
      ref: 'GamingSession'
    },
    notes: {
      type: String,
      maxlength: 1000
    }
  }],
  
  estimatedLength: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  sessionFrequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', 'irregular'],
    required: true
  },
  averageSessionLength: {
    type: Number,
    required: true,
    min: 60,
    max: 480 // 8 hours max
  },
  
  analytics: {
    totalSessions: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPlaytime: {
      type: Number,
      default: 0,
      min: 0
    },
    averageAttendance: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    playerRetention: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }
}, {
  timestamps: true,
  collection: 'campaigns'
});

// Indexes for efficient querying
CampaignSchema.index({ 'masterIds': 1, status: 1 });
CampaignSchema.index({ status: 1, isRecruiting: 1 });
CampaignSchema.index({ 'players.characterId': 1 });
CampaignSchema.index({ 'setting.majorLocations': 1 });
CampaignSchema.index({ createdAt: -1 });

// Virtual for active player count
CampaignSchema.virtual('activePlayerCount').get(function() {
  return this.players ? this.players.filter(p => p.status === 'active').length : 0;
});

// Virtual for active plot threads count
CampaignSchema.virtual('activePlotThreadCount').get(function() {
  return this.plotThreads ? this.plotThreads.filter(pt => pt.status === 'active').length : 0;
});

// Virtual for campaign duration in days
CampaignSchema.virtual('campaignDuration').get(function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware for analytics updates
CampaignSchema.pre('save', async function(next) {
  if (this.isModified('sessions')) {
    // Update analytics when sessions are added
    const sessionCount = this.sessions.length;
    this.analytics.totalSessions = sessionCount;
    
    // Calculate total playtime and average attendance if sessions exist
    if (sessionCount > 0) {
      try {
        const GamingSession = model('GamingSession');
        const sessions = await GamingSession.find({ _id: { $in: this.sessions } });
        
        // Calculate total playtime
        this.analytics.totalPlaytime = sessions.reduce((total, session) => {
          return total + (session.totalActiveTime || 0);
        }, 0);
        
        // Calculate average attendance
        const activePlayersCount = this.players.filter(p => p.status === 'active').length;
        const totalPossibleAttendance = sessions.length * activePlayersCount;
        const actualAttendance = sessions.reduce((total, session) => {
          return total + (session.participants ? session.participants.length : 0);
        }, 0);
        
        this.analytics.averageAttendance = totalPossibleAttendance > 0 
          ? Math.round((actualAttendance / totalPossibleAttendance) * 100) 
          : 0;
        
      } catch (error) {
        console.warn('Failed to update campaign analytics:', error);
      }
    }
  }
  
  next();
});

// Method to add session to campaign
CampaignSchema.methods.addSession = function(sessionId: string) {
  if (!this.sessions.includes(sessionId)) {
    this.sessions.push(sessionId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to update chapter
CampaignSchema.methods.advanceChapter = function(newChapterTitle: string, chapterSummary: string = '') {
  this.currentChapter = {
    chapterNumber: this.currentChapter.chapterNumber + 1,
    chapterTitle: newChapterTitle,
    chapterSummary: chapterSummary,
    startedAt: new Date()
  };
  return this.save();
};

// Method to add plot thread
CampaignSchema.methods.addPlotThread = function(plotThread: any) {
  this.plotThreads.push(plotThread);
  return this.save();
};

// Method to resolve plot thread
CampaignSchema.methods.resolvePlotThread = function(threadId: string, resolution: string) {
  const thread = this.plotThreads.id(threadId);
  if (thread) {
    thread.status = 'resolved';
    thread.resolution = resolution;
    return this.save();
  }
  return Promise.reject(new Error('Plot thread not found'));
};

export const Campaign = models.Campaign || model<ICampaign>('Campaign', CampaignSchema);