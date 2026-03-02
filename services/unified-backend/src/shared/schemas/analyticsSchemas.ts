// =============================================================================
// Analytics Mongoose Schemas
// =============================================================================

import mongoose from 'mongoose';

const Schema = mongoose.Schema;
const model = mongoose.model.bind(mongoose);
const models = mongoose.models;

// User Session Schema
const userSessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date },
  duration: { type: Number },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  browser: { type: String, required: true },
  browserVersion: { type: String },
  device: { type: String, required: true },
  os: { type: String, required: true },
  country: { type: String },
  city: { type: String },
  pages: [{
    path: { type: String, required: true },
    timestamp: { type: Date, required: true },
    timeSpent: { type: Number }
  }],
  actions: [{
    type: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    timestamp: { type: Date, required: true }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSessionSchema.index({ userId: 1, startTime: -1 });
userSessionSchema.index({ startTime: -1 });
userSessionSchema.index({ country: 1, startTime: -1 });

// Page View Schema
const pageViewSchema = new Schema({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, index: true },
  path: { type: String, required: true, index: true },
  title: { type: String },
  referrer: { type: String },
  timestamp: { type: Date, required: true, index: true },
  timeSpent: { type: Number },
  isUnique: { type: Boolean, required: true, index: true },
  browser: { type: String, required: true },
  browserVersion: { type: String },
  device: { type: String, required: true },
  os: { type: String, required: true },
  ipAddress: { type: String, required: true },
  country: { type: String },
  city: { type: String },
  createdAt: { type: Date, default: Date.now }
});

pageViewSchema.index({ timestamp: -1 });
pageViewSchema.index({ path: 1, timestamp: -1 });
pageViewSchema.index({ userId: 1, timestamp: -1 });

// User Action Schema
const userActionSchema = new Schema({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  action: { type: String, required: true, index: true },
  section: { type: String, required: true, index: true },
  details: { type: Schema.Types.Mixed },
  success: { type: Boolean, required: true, index: true },
  error: { type: String },
  timestamp: { type: Date, required: true, index: true },
  duration: { type: Number },
  ipAddress: { type: String, required: true },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now }
});

userActionSchema.index({ action: 1, timestamp: -1 });
userActionSchema.index({ section: 1, timestamp: -1 });
userActionSchema.index({ userId: 1, action: 1, timestamp: -1 });

// Gameplay Stats Schema (daily aggregates)
const gameplayStatsSchema = new Schema({
  date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
  charactersOnline: { type: Number, required: true, default: 0 },
  activeLocations: { type: Number, required: true, default: 0 },
  messagesLast24h: { type: Number, required: true, default: 0 },
  diceRollsLast24h: { type: Number, required: true, default: 0 },
  lettersDelivered: { type: Number, required: true, default: 0 },
  corporationsActive: { type: Number, required: true, default: 0 },
  newCharactersCreated: { type: Number, required: true, default: 0 },
  charactersApproved: { type: Number, required: true, default: 0 },
  charactersRejected: { type: Number, required: true, default: 0 },
  averageSessionTime: { type: Number, required: true, default: 0 },
  peakOnlineUsers: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// System Metrics Schema (for real-time monitoring)
const systemMetricsSchema = new Schema({
  timestamp: { type: Date, required: true, index: true },
  cpuUsage: { type: Number, required: true },
  memoryUsage: { type: Number, required: true },
  diskUsage: { type: Number, required: true },
  networkIn: { type: Number, required: true },
  networkOut: { type: Number, required: true },
  activeConnections: { type: Number, required: true },
  redisConnections: { type: Number, required: true },
  mongoConnections: { type: Number, required: true },
  responseTime: { type: Number, required: true },
  errorRate: { type: Number, required: true },
  uptime: { type: Number, required: true },
  service: { 
    type: String, 
    required: true, 
    enum: ['auth', 'game', 'management', 'gateway'],
    index: true 
  },
  createdAt: { type: Date, default: Date.now }
});

systemMetricsSchema.index({ service: 1, timestamp: -1 });
systemMetricsSchema.index({ timestamp: -1 });

// Economy Stats Schema (daily aggregates)
const economyStatsSchema = new Schema({
  date: { type: String, required: true, unique: true, index: true },
  totalSupply: { type: Number, required: true },
  avgBalance: { type: Number, required: true },
  medianBalance: { type: Number, required: true },
  transactionsToday: { type: Number, required: true },
  totalTransactionValue: { type: Number, required: true },
  topSpenders: [{
    userId: { type: String, required: true },
    username: { type: String, required: true },
    amount: { type: Number, required: true }
  }],
  economyHealth: { type: Number, required: true, min: 0, max: 100 },
  inflationRate: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Geographic Stats Schema (daily aggregates)
const geographicStatsSchema = new Schema({
  date: { type: String, required: true, unique: true, index: true },
  countries: [{
    code: { type: String, required: true },
    name: { type: String, required: true },
    count: { type: Number, required: true },
    percentage: { type: Number, required: true }
  }],
  cities: [{
    name: { type: String, required: true },       // Es: "Terni"
    region: { type: String },                     // Es: "Umbria" 
    country: { type: String, required: true },    // Es: "Italia"
    count: { type: Number, required: true }
  }],
  totalSessions: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Browser Stats Schema (daily aggregates)
const browserStatsSchema = new Schema({
  date: { type: String, required: true, unique: true, index: true },
  browsers: [{
    name: { type: String, required: true },
    version: { type: String, required: true },
    count: { type: Number, required: true },
    percentage: { type: Number, required: true },
    color: { type: String, required: true }
  }],
  devices: [{
    type: { type: String, required: true },
    count: { type: Number, required: true },
    percentage: { type: Number, required: true }
  }],
  operatingSystems: [{
    name: { type: String, required: true },
    count: { type: Number, required: true },
    percentage: { type: Number, required: true }
  }],
  totalSessions: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Content Stats Schema (daily aggregates)
const contentStatsSchema = new Schema({
  date: { type: String, required: true, unique: true, index: true },
  documentsCreated: { type: Number, required: true, default: 0 },
  documentsViewed: { type: Number, required: true, default: 0 },
  forumPosts: { type: Number, required: true, default: 0 },
  forumViews: { type: Number, required: true, default: 0 },
  popularDocuments: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    views: { type: Number, required: true }
  }],
  popularForumTopics: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    replies: { type: Number, required: true },
    views: { type: Number, required: true }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// TTL Indexes for automatic cleanup
systemMetricsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30 days
pageViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 days
userActionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 }); // 180 days
userSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 }); // 180 days

// Export models
export const UserSession = models.UserSession || model('UserSession', userSessionSchema);
export const PageView = models.PageView || model('PageView', pageViewSchema);
export const UserAction = models.UserAction || model('UserAction', userActionSchema);
export const GameplayStats = models.GameplayStats || model('GameplayStats', gameplayStatsSchema);
export const SystemMetrics = models.SystemMetrics || model('SystemMetrics', systemMetricsSchema);
export const EconomyStats = models.EconomyStats || model('EconomyStats', economyStatsSchema);
export const GeographicStats = models.GeographicStats || model('GeographicStats', geographicStatsSchema);
export const BrowserStats = models.BrowserStats || model('BrowserStats', browserStatsSchema);
export const ContentStats = models.ContentStats || model('ContentStats', contentStatsSchema);

// Export all schemas for reference
export {
  userSessionSchema,
  pageViewSchema,
  userActionSchema,
  gameplayStatsSchema,
  systemMetricsSchema,
  economyStatsSchema,
  geographicStatsSchema,
  browserStatsSchema,
  contentStatsSchema
};