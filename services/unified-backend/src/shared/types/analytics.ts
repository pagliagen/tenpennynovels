// =============================================================================
// Analytics Types - Sistema Statistiche TenpennyNovels
// =============================================================================

export interface UserSession {
  _id?: string;
  sessionId: string;
  userId: string;
  username: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  ipAddress: string;
  userAgent: string;
  browser: string;
  browserVersion: string;
  device: string;
  os: string;
  country?: string;
  city?: string;
  pages: {
    path: string;
    timestamp: Date;
    timeSpent?: number;
  }[];
  actions: {
    type: string;
    details: any;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PageView {
  _id?: string;
  sessionId: string;
  userId?: string;
  path: string;
  title: string;
  referrer?: string;
  timestamp: Date;
  timeSpent?: number;
  isUnique: boolean;
  browser: string;
  browserVersion: string;
  device: string;
  os: string;
  ipAddress: string;
  country?: string;
  city?: string;
  createdAt: Date;
}

export interface UserAction {
  _id?: string;
  sessionId: string;
  userId: string;
  username: string;
  action: string;
  section: string;
  details: any;
  success: boolean;
  error?: string;
  timestamp: Date;
  duration?: number;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export interface GameplayStats {
  _id?: string;
  date: string; // YYYY-MM-DD
  charactersOnline: number;
  activeLocations: number;
  messagesLast24h: number;
  diceRollsLast24h: number;
  lettersDelivered: number;
  corporationsActive: number;
  newCharactersCreated: number;
  charactersApproved: number;
  charactersRejected: number;
  averageSessionTime: number;
  peakOnlineUsers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemMetrics {
  _id?: string;
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  activeConnections: number;
  redisConnections: number;
  mongoConnections: number;
  responseTime: number;
  errorRate: number;
  uptime: number;
  service: 'auth' | 'game' | 'management' | 'gateway';
  createdAt: Date;
}

export interface EconomyStats {
  _id?: string;
  date: string; // YYYY-MM-DD
  totalSupply: number;
  avgBalance: number;
  medianBalance: number;
  transactionsToday: number;
  totalTransactionValue: number;
  topSpenders: {
    userId: string;
    username: string;
    amount: number;
  }[];
  economyHealth: number; // 0-100 score
  inflationRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeographicStats {
  _id?: string;
  date: string; // YYYY-MM-DD
  countries: {
    code: string;
    name: string;
    count: number;
    percentage: number;
  }[];
  cities: {
    name: string;      // Es: "Terni"
    region?: string;   // Es: "Umbria" 
    country: string;   // Es: "Italia"
    count: number;
  }[];
  totalSessions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrowserStats {
  _id?: string;
  date: string; // YYYY-MM-DD
  browsers: {
    name: string;
    version: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  devices: {
    type: string;
    count: number;
    percentage: number;
  }[];
  operatingSystems: {
    name: string;
    count: number;
    percentage: number;
  }[];
  totalSessions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentStats {
  _id?: string;
  date: string; // YYYY-MM-DD
  documentsCreated: number;
  documentsViewed: number;
  forumPosts: number;
  forumViews: number;
  popularDocuments: {
    id: string;
    title: string;
    views: number;
  }[];
  popularForumTopics: {
    id: string;
    title: string;
    replies: number;
    views: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Analytics Aggregation Interfaces
// =============================================================================

export interface DashboardMetrics {
  visitatori_unici: {
    current: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
  pagine_viste: {
    current: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
  utenti_iscritti: {
    current: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
  azioni_inviate: {
    current: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
  browser_stats: {
    browsers: {
      name: string;
      version: string;
      count: number;
      percentage: number;
      color: string;
    }[];
  };
  gameplay_activity: {
    charactersOnline: number;
    activeLocations: number;
    chatEnabledLocations?: number;
    shopEnabledLocations?: number;
    privateLocations?: number;
    messagesLast24h: number;
    diceRollsLast24h: number;
    lettersDelivered: number;
    corporationsActive: number;
  };
  characters_by_status?: {
    approved: {
      name: string;
      username: string;
      roles: string[];
    }[];
    pending_approval: {
      name: string;
      username: string;
    }[];
    draft: {
      name: string;
      username: string;
    }[];
  };
  geographic_distribution: {
    locations: {
      location: string;   // City name or Country name
      country: string;
      code: string;
      count: number;
      percentage: number;
      color: string;      // For chart rendering
    }[];
  };
}

export interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  userId?: string;
  section?: string;
  action?: string;
  limit?: number;
  offset?: number;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}
