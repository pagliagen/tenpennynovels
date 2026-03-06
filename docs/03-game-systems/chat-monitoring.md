# Chat Monitoring & Moderation System Documentation

## Overview

Il Chat Monitoring System fornisce agli amministratori di TenPennyNovels la capacità completa di monitorare, ricercare e moderare tutti i tipi di messaggi nel sistema. Il sistema integra monitoring in tempo reale, ricerca avanzata, gestione report utenti e azioni di moderazione attraverso un'interfaccia amministrativa centralizzata.

## System Architecture

### Core Components

```typescript
interface ChatMonitoringSystem {
  messageSearch: CrossPlatformMessageSearch;
  realtimeMonitoring: LiveActivityTracker;
  moderationActions: ModerationActionSystem;
  reportManagement: UserReportSystem;
  contentFiltering: AutomatedModerationSystem;
}

// Supported message types for monitoring
enum MessageType {
  LOCATION = 'location',     // Real-time location chat
  ONGAME = 'ongame',        // Victorian postal system
  OFFGAME = 'offgame'       // OOC chat system
}

// Moderation action severity levels
enum ModerationSeverity {
  LOW = 'low',              // Minor infractions
  MEDIUM = 'medium',        // Standard violations
  HIGH = 'high',           // Serious violations
  CRITICAL = 'critical'    // Immediate action required
}
```

### Integration Points

- **Character System**: All messages linked to Character IDs
- **Location System**: Location chat integrated with access control
- **Authentication**: Full admin role verification and audit trails
- **WebSocket System**: Real-time monitoring and notifications
- **Audit System**: Complete logging of moderation actions

## Database Models

### Chat Moderation Actions

```typescript
interface IChatModerationAction extends Document {
  // Target message identification
  messageId: ObjectId;
  messageType: 'location' | 'ongame' | 'offgame';
  messageCollection: string; // Collection name for cross-reference
  
  // Action details
  action: ModerationAction;
  reason: string;
  severity: ModerationSeverity;
  
  // Moderation context
  moderatorId: ObjectId; // Admin/Moderator character
  moderatorUsername: string;
  actionTakenAt: Date;
  
  // Target information
  targetCharacterId: ObjectId;
  targetCharacterName: string;
  targetUserId?: ObjectId;
  
  // Duration-based actions
  duration?: number; // Duration in minutes
  expiresAt?: Date;
  
  // Action status
  isActive: boolean;
  wasAppealed: boolean;
  appealedAt?: Date;
  appealReason?: string;
  appealResolvedBy?: ObjectId;
  appealResolution?: 'upheld' | 'overturned' | 'modified';
  
  // Content audit trail
  originalContent: string;
  editedContent?: string;
  
  // Context information
  locationId?: ObjectId; // For location messages
  chatId?: ObjectId; // For offgame messages
  
  // Administrative notes
  moderatorNotes?: string;
  followUpRequired: boolean;
  escalated: boolean;
  escalatedTo?: ObjectId;
}

enum ModerationAction {
  HIDE = 'hide',                      // Hide message from public view
  DELETE = 'delete',                  // Soft delete message
  WARN_SENDER = 'warn_sender',        // Send warning to user
  BAN_SENDER = 'ban_sender',          // Temporary/permanent ban
  EDIT_CONTENT = 'edit_content',      // Edit inappropriate content
  FLAG_INAPPROPRIATE = 'flag_inappropriate' // Flag for review
}
```

### User Report System

```typescript
interface IUserReport extends Document {
  // Report identification
  reportedMessageId: ObjectId;
  messageType: 'location' | 'ongame' | 'offgame';
  reportReason: ReportReason;
  customReason?: string;
  
  // Reporter information
  reporterCharacterId: ObjectId;
  reporterCharacterName: string;
  reportedAt: Date;
  
  // Reported user information
  reportedCharacterId: ObjectId;
  reportedCharacterName: string;
  
  // Context
  additionalContext?: string;
  locationId?: ObjectId;
  chatId?: ObjectId;
  
  // Resolution tracking
  status: ReportStatus;
  assignedModerator?: ObjectId;
  assignedAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  actionTaken?: ObjectId; // Reference to ChatModerationAction
  
  // Priority system
  priorityScore: number; // 1-10 calculated priority
  isUrgent: boolean;
}

enum ReportReason {
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  HATE_SPEECH = 'hate_speech',
  PERSONAL_ATTACKS = 'personal_attacks',
  RULE_VIOLATION = 'rule_violation',
  OTHER = 'other'
}

enum ReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
  ESCALATED = 'escalated'
}
```

### Moderation Configuration

```typescript
interface IChatModerationConfig extends Document {
  // Automated filtering rules
  bannedWords: {
    word: string;
    severity: ModerationSeverity;
    autoAction: 'flag' | 'hide' | 'delete';
    isRegex: boolean;
    category: 'profanity' | 'inappropriate' | 'spam' | 'personal_info' | 'external_links';
  }[];
  
  // Rate limiting configuration
  rateLimits: {
    messageType: MessageType;
    maxMessages: number;
    timeWindow: number; // in minutes
    action: 'warn' | 'temp_mute' | 'escalate';
  }[];
  
  // Escalation rules
  escalationRules: {
    triggerCondition: 'repeat_offender' | 'high_severity' | 'multiple_reports';
    threshold: number;
    timeFrame: number; // in hours
    escalateTo: ObjectId; // Senior moderator
    autoEscalate: boolean;
  }[];
  
  // Real-time monitoring settings
  realTimeMonitoring: {
    enabled: boolean;
    flaggedKeywords: string[];
    alertModerators: boolean;
    autoScreenshot: boolean;
  };
  
  isActive: boolean;
  lastUpdatedBy: ObjectId;
  lastUpdatedAt: Date;
}
```

## Management Backend Implementation

### Chat Monitoring Controller

```typescript
export class ChatMonitoringController {
  
  /**
   * Cross-platform message search
   * POST /admin/chat/search
   */
  static async searchMessages(req: Request, res: Response): Promise<void> {
    const { 
      query, 
      messageType, 
      characterId, 
      locationId, 
      chatId,
      dateRange, 
      flaggedOnly, 
      moderatedOnly 
    } = req.body;
    
    try {
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      let results: MessageSearchResult[] = [];
      
      // Search location messages if requested
      if (this.shouldSearchMessageType(messageType, 'location')) {
        const locationResults = await this.searchLocationMessages(query, {
          characterId, locationId, dateRange, flaggedOnly
        });
        results = results.concat(locationResults);
      }
      
      // Search OnGame messages
      if (this.shouldSearchMessageType(messageType, 'ongame')) {
        const { OnGameMessage } = await import('../../../../services/database/models');
        const ongameResults = await this.searchCollectionMessages(
          OnGameMessage, 'ongame', query, 
          { characterId, dateRange, flaggedOnly }
        );
        results = results.concat(ongameResults);
      }
      
      // Search OffGame messages
      if (this.shouldSearchMessageType(messageType, 'offgame')) {
        const { OffGameChatMessage } = await import('../../../../services/database/models');
        const offgameResults = await this.searchCollectionMessages(
          OffGameChatMessage, 'offgame', query, 
          { characterId, chatId, dateRange, flaggedOnly }
        );
        results = results.concat(offgameResults);
      }
      
      // Sort by timestamp descending
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Apply result limit for performance
      const limitedResults = results.slice(0, 500);
      
      // Log search activity
      logger.info('Admin chat search performed', {
        ...auditInfo,
        searchQuery: query,
        messageType,
        resultCount: limitedResults.length,
        category: 'chat_monitoring'
      });
      
      res.json({
        success: true,
        data: {
          messages: limitedResults,
          totalFound: results.length,
          limitApplied: results.length > 500,
          searchMetadata: {
            query,
            messageType,
            searchedAt: new Date().toISOString()
          }
        }
      });
      
    } catch (error) {
      logger.error('Chat search failed', {
        error: error instanceof Error ? error.message : String(error),
        searchParams: req.body
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to search messages',
        code: 'CHAT_SEARCH_ERROR'
      });
    }
  }
  
  /**
   * Real-time activity monitoring
   * GET /admin/chat/monitoring/realtime
   */
  static async getRealTimeActivity(req: Request, res: Response): Promise<void> {
    const { timeframe = '1h' } = req.query;
    
    try {
      const timeframeMs = this.parseTimeframe(timeframe as string);
      const since = new Date(Date.now() - timeframeMs);
      
      // Parallel activity fetching for performance
      const [
        locationActivity,
        ongameActivity, 
        offgameActivity,
        moderationActivity,
        reportActivity
      ] = await Promise.all([
        this.getLocationActivity(since),
        this.getOnGameActivity(since),
        this.getOffGameActivity(since),
        this.getModerationActivity(since),
        this.getReportActivity(since)
      ]);
      
      const activitySummary = {
        timeframe,
        since: since.toISOString(),
        lastUpdated: new Date().toISOString(),
        
        // Message activity by type
        messageActivity: {
          location: locationActivity,
          ongame: ongameActivity,
          offgame: offgameActivity
        },
        
        // Moderation activity
        moderation: moderationActivity,
        
        // Report activity
        reports: reportActivity,
        
        // Summary statistics
        totals: {
          messages: locationActivity.count + ongameActivity.count + offgameActivity.count,
          moderationActions: moderationActivity.count,
          pendingReports: reportActivity.pendingCount,
          urgentReports: reportActivity.urgentCount
        }
      };
      
      res.json({
        success: true,
        data: activitySummary
      });
      
    } catch (error) {
      logger.error('Failed to get real-time activity', {
        error: error instanceof Error ? error.message : String(error),
        timeframe
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get real-time activity',
        code: 'REALTIME_ACTIVITY_ERROR'
      });
    }
  }
  
  /**
   * Apply moderation action to message
   * POST /admin/chat/moderate
   */
  static async moderateMessage(req: Request, res: Response): Promise<void> {
    const { 
      messageId, 
      messageType, 
      action, 
      reason, 
      severity,
      duration,
      moderatorNotes 
    } = req.body;
    
    try {
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      
      if (!auditInfo) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Retrieve original message for content audit
      const originalMessage = await this.getOriginalMessage(messageId, messageType);
      if (!originalMessage) {
        return res.status(404).json({
          success: false,
          error: 'Message not found',
          code: 'MESSAGE_NOT_FOUND'
        });
      }
      
      // Create comprehensive moderation action record
      const moderationAction = new ChatModerationAction({
        messageId,
        messageType,
        messageCollection: this.getCollectionName(messageType),
        action,
        reason,
        severity,
        moderatorId: auditInfo.adminId,
        moderatorUsername: auditInfo.adminUsername,
        targetCharacterId: this.extractSenderId(originalMessage),
        targetCharacterName: this.extractSenderName(originalMessage),
        originalContent: originalMessage.content,
        duration,
        expiresAt: duration ? new Date(Date.now() + duration * 60 * 1000) : undefined,
        locationId: originalMessage.locationId,
        chatId: originalMessage.chatId,
        moderatorNotes: moderatorNotes || '',
        followUpRequired: severity === 'critical',
        escalated: false
      });
      
      await moderationAction.save();
      
      // Apply the actual moderation action
      await this.executeModeration(messageId, messageType, action, moderationAction._id);
      
      // Send notifications if appropriate
      if (['warn_sender', 'ban_sender'].includes(action)) {
        await this.sendModerationNotification(
          this.extractSenderId(originalMessage),
          action,
          reason,
          duration
        );
      }
      
      // Publish real-time moderation event
      await this.publishModerationEvent({
        type: 'message_moderated',
        messageId,
        messageType,
        action,
        severity,
        moderatorId: auditInfo.adminId,
        targetCharacterId: this.extractSenderId(originalMessage),
        timestamp: new Date()
      });
      
      // Comprehensive audit logging
      logger.info('Message moderation action applied', {
        ...auditInfo,
        messageId,
        messageType,
        action,
        severity,
        targetCharacterId: this.extractSenderId(originalMessage),
        duration,
        category: 'chat_moderation'
      });
      
      res.json({
        success: true,
        data: {
          moderationActionId: moderationAction._id,
          appliedAt: new Date().toISOString(),
          action,
          severity,
          expiresAt: moderationAction.expiresAt?.toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Message moderation failed', {
        error: error instanceof Error ? error.message : String(error),
        messageId,
        action,
        severity
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to moderate message',
        code: 'MODERATION_ACTION_ERROR'
      });
    }
  }
  
  /**
   * Get character moderation history
   * GET /admin/chat/moderation/character/:characterId
   */
  static async getCharacterModerationHistory(req: Request, res: Response): Promise<void> {
    const { characterId } = req.params;
    const { limit = 50, skip = 0, severity, action } = req.query;
    
    try {
      // Build query filter
      const filter: any = { targetCharacterId: characterId };
      
      if (severity && severity !== 'all') {
        filter.severity = severity;
      }
      
      if (action && action !== 'all') {
        filter.action = action;
      }
      
      // Get moderation history with details
      const [moderationHistory, totalCount, characterInfo] = await Promise.all([
        ChatModerationAction.find(filter)
          .populate('moderatorId', 'name')
          .populate('escalatedTo', 'name')
          .sort({ actionTakenAt: -1 })
          .limit(parseInt(limit as string))
          .skip(parseInt(skip as string)),
          
        ChatModerationAction.countDocuments(filter),
        
        Character.findById(characterId, 'name')
      ]);
      
      // Calculate moderation statistics
      const stats = await this.calculateModerationStats(characterId);
      
      res.json({
        success: true,
        data: {
          character: characterInfo,
          history: moderationHistory,
          statistics: stats,
          pagination: {
            total: totalCount,
            limit: parseInt(limit as string),
            skip: parseInt(skip as string),
            hasMore: totalCount > parseInt(skip as string) + parseInt(limit as string)
          }
        }
      });
      
    } catch (error) {
      logger.error('Failed to get character moderation history', {
        error: error instanceof Error ? error.message : String(error),
        characterId
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get moderation history',
        code: 'MODERATION_HISTORY_ERROR'
      });
    }
  }
  
  /**
   * Get pending user reports with priority sorting
   * GET /admin/chat/reports
   */
  static async getPendingReports(req: Request, res: Response): Promise<void> {
    const { 
      priority = 'all', 
      assignedTo = 'all',
      status = 'pending',
      limit = 50,
      skip = 0
    } = req.query;
    
    try {
      // Build filter for reports
      const filter: any = {};
      
      if (status !== 'all') {
        filter.status = status === 'pending' ? 
          { $in: ['pending', 'under_review'] } : status;
      }
      
      if (priority === 'urgent') {
        filter.isUrgent = true;
      }
      
      if (assignedTo !== 'all') {
        filter.assignedModerator = assignedTo;
      }
      
      // Get reports with comprehensive population
      const [reports, totalCount] = await Promise.all([
        UserReport.find(filter)
          .populate('reporterCharacterId', 'name')
          .populate('reportedCharacterId', 'name') 
          .populate('assignedModerator', 'name')
          .populate('actionTaken')
          .sort({ 
            priorityScore: -1, 
            isUrgent: -1,
            reportedAt: -1 
          })
          .limit(parseInt(limit as string))
          .skip(parseInt(skip as string)),
          
        UserReport.countDocuments(filter)
      ]);
      
      // Calculate report statistics
      const reportStats = await this.getReportStatistics();
      
      res.json({
        success: true,
        data: {
          reports,
          statistics: reportStats,
          pagination: {
            total: totalCount,
            limit: parseInt(limit as string),
            skip: parseInt(skip as string),
            hasMore: totalCount > parseInt(skip as string) + parseInt(limit as string)
          }
        }
      });
      
    } catch (error) {
      logger.error('Failed to get pending reports', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get pending reports',
        code: 'GET_REPORTS_ERROR'
      });
    }
  }
  
  /**
   * Process user report with resolution
   * PUT /admin/chat/reports/:reportId
   */
  static async processReport(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;
    const { 
      action,           // 'resolve' | 'dismiss' | 'escalate'
      resolutionNotes,
      moderationAction  // If taking moderation action
    } = req.body;
    
    try {
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      
      const report = await UserReport.findById(reportId)
        .populate('reportedMessageId');
        
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
          code: 'REPORT_NOT_FOUND'
        });
      }
      
      // Update report status and assignment
      const updateData: any = {
        assignedModerator: auditInfo?.adminId,
        assignedAt: new Date(),
        resolvedAt: new Date(),
        resolutionNotes
      };
      
      switch (action) {
        case 'resolve':
          updateData.status = 'resolved';
          break;
        case 'dismiss':
          updateData.status = 'dismissed';
          break;
        case 'escalate':
          updateData.status = 'escalated';
          updateData.escalated = true;
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid action',
            code: 'INVALID_ACTION'
          });
      }
      
      // If moderation action is being taken
      if (moderationAction && action === 'resolve') {
        const modAction = await this.createModerationFromReport(
          report, 
          moderationAction, 
          auditInfo
        );
        updateData.actionTaken = modAction._id;
      }
      
      // Update the report
      const updatedReport = await UserReport.findByIdAndUpdate(
        reportId, 
        updateData, 
        { new: true }
      ).populate('actionTaken');
      
      // Log report processing
      logger.info('User report processed', {
        ...auditInfo,
        reportId,
        action,
        reportedCharacterId: report.reportedCharacterId,
        reportReason: report.reportReason,
        category: 'chat_moderation'
      });
      
      res.json({
        success: true,
        data: { 
          report: updatedReport,
          action,
          processedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Failed to process report', {
        error: error instanceof Error ? error.message : String(error),
        reportId
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to process report',
        code: 'PROCESS_REPORT_ERROR'
      });
    }
  }
  
  // Helper Methods Implementation
  
  private static shouldSearchMessageType(requestedType: any, targetType: string): boolean {
    return !requestedType || requestedType === 'all' || requestedType.includes(targetType);
  }
  
  private static async searchCollectionMessages(
    Model: any,
    type: string,
    query: string,
    filters: any
  ): Promise<MessageSearchResult[]> {
    
    const searchFilter: any = {};
    
    // Text search in content and subject
    if (query) {
      searchFilter.$or = [
        { content: { $regex: query, $options: 'i' } },
        { subject: { $regex: query, $options: 'i' } }
      ];
    }
    
    // Character filter
    if (filters.characterId) {
      searchFilter.$or = [
        { from: filters.characterId },
        { to: filters.characterId },
        { senderId: filters.characterId }
      ];
    }
    
    // Date range filter
    if (filters.dateRange && filters.dateRange.start && filters.dateRange.end) {
      searchFilter.$and = [{
        $or: [
          { sentAt: { $gte: new Date(filters.dateRange.start), $lte: new Date(filters.dateRange.end) } },
          { createdAt: { $gte: new Date(filters.dateRange.start), $lte: new Date(filters.dateRange.end) } }
        ]
      }];
    }
    
    // Flagged messages filter
    if (filters.flaggedOnly) {
      const moderatedMessageIds = await ChatModerationAction.distinct('messageId', {
        messageType: type
      });
      searchFilter._id = { $in: moderatedMessageIds };
    }
    
    try {
      const results = await Model.find(searchFilter)
        .populate('from to senderId', 'name')
        .limit(200)
        .sort({ $or: [{ sentAt: -1 }, { createdAt: -1 }] });
      
      return results.map((msg: any) => ({
        id: msg._id.toString(),
        type,
        content: msg.content,
        subject: msg.subject,
        senderName: this.extractSenderName(msg),
        senderId: this.extractSenderId(msg),
        timestamp: msg.sentAt || msg.createdAt,
        locationId: msg.locationId,
        chatId: msg.chatId,
        messageData: msg
      }));
    } catch (error) {
      logger.error(`Failed to search ${type} messages`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  
  private static extractSenderName(message: any): string {
    return message.from?.name || 
           message.senderId?.name || 
           message.senderName ||
           message.characterName ||
           'Unknown';
  }
  
  private static extractSenderId(message: any): ObjectId {
    return message.from || 
           message.senderId || 
           message.characterId ||
           message._id;
  }
  
  private static async calculateModerationStats(characterId: string): Promise<any> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [totalActions, recentActions, severityBreakdown] = await Promise.all([
      ChatModerationAction.countDocuments({ targetCharacterId: characterId }),
      
      ChatModerationAction.countDocuments({ 
        targetCharacterId: characterId,
        actionTakenAt: { $gte: thirtyDaysAgo }
      }),
      
      ChatModerationAction.aggregate([
        { $match: { targetCharacterId: new ObjectId(characterId) } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ])
    ]);
    
    return {
      totalActions,
      recentActions,
      severityBreakdown: severityBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}
```

## API Endpoints

### Management Backend Routes

```typescript
// Chat Monitoring & Moderation Routes
POST   /admin/chat/search                           // Cross-platform message search
GET    /admin/chat/monitoring/realtime              // Real-time activity monitoring  
POST   /admin/chat/moderate                         // Apply moderation action
GET    /admin/chat/moderation/character/:characterId // Character moderation history
GET    /admin/chat/reports                          // Get user reports with filters
PUT    /admin/chat/reports/:reportId                // Process user report
GET    /admin/chat/statistics                       // Overall moderation statistics
DELETE /admin/chat/moderation/:actionId             // Reverse moderation action
```

### Search API Examples

```typescript
// Cross-platform message search
POST /admin/chat/search
{
  "query": "inappropriate content",
  "messageType": "all", // or "location", "ongame", "offgame" 
  "characterId": "66d5f8e8f9f1c2a3b4e5d6f7",
  "dateRange": {
    "start": "2025-08-01T00:00:00Z",
    "end": "2025-08-27T23:59:59Z"
  },
  "flaggedOnly": true,
  "moderatedOnly": false
}

// Real-time activity monitoring
GET /admin/chat/monitoring/realtime?timeframe=1h

// Apply moderation action
POST /admin/chat/moderate
{
  "messageId": "66d5f8e8f9f1c2a3b4e5d6f8",
  "messageType": "ongame",
  "action": "warn_sender",
  "reason": "Violation of community guidelines",
  "severity": "medium",
  "duration": 60,
  "moderatorNotes": "First offense, warning issued"
}
```

## Frontend Management Interface

### Chat Monitoring Dashboard

```typescript
// Complete chat monitoring interface with tabbed navigation
export default function ChatMonitoring({ authContext }: { authContext: AuthContext }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'reports'>('overview');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    messageType: 'all',
    characterId: '',
    locationId: '',
    chatId: '',
    dateRange: { start: '', end: '' },
    flaggedOnly: false,
    moderatedOnly: false
  });
  
  const [realTimeActivity, setRealTimeActivity] = useState<ActivityData | null>(null);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [moderationModal, setModerationModal] = useState(false);
  
  const auditLogger = useAuditLogger();

  // Real-time activity monitoring with auto-refresh
  useEffect(() => {
    const loadRealTimeActivity = async () => {
      try {
        const response = await fetch(`${API_GATEWAY_URL}/admin/chat/monitoring/realtime?timeframe=1h`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setRealTimeActivity(data.data);
        }
      } catch (error) {
        console.error('Failed to load real-time activity:', error);
      }
    };

    loadRealTimeActivity();
    const interval = setInterval(loadRealTimeActivity, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Load pending reports
  useEffect(() => {
    if (activeTab === 'reports') {
      loadPendingReports();
    }
  }, [activeTab]);

  const handleSearch = async () => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/chat/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: searchQuery,
          ...filters
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.data.messages);
        
        auditLogger.logAdminAction('chat_search', 'chat_monitoring', {
          searchQuery,
          resultCount: data.data.messages.length,
          filters,
          searchedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleModerateMessage = async (
    messageId: string, 
    action: string, 
    reason: string, 
    severity: string,
    duration?: number
  ) => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/chat/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messageId,
          messageType: selectedMessage?.type,
          action,
          reason,
          severity,
          duration,
          moderatorNotes: `Action taken via admin interface`
        })
      });

      if (response.ok) {
        auditLogger.logAdminAction('message_moderation', 'chat_monitoring', {
          messageId,
          action,
          severity,
          targetSender: selectedMessage?.senderName,
          moderatedAt: new Date().toISOString()
        });
        
        // Refresh search results to show moderation status
        await handleSearch();
        setModerationModal(false);
        setSelectedMessage(null);
        
        // Show success notification
        showNotification(`Moderation action "${action}" applied successfully`, 'success');
      } else {
        throw new Error('Failed to apply moderation action');
      }
    } catch (error) {
      console.error('Moderation failed:', error);
      showNotification('Failed to apply moderation action', 'error');
    }
  };

  const loadPendingReports = async () => {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/chat/reports?priority=all&status=pending`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setReports(data.data.reports);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  return (
    <ManagementLayout authContext={authContext}>
      <div className={styles.chatMonitoring}>
        <div className={styles.pageHeader}>
          <h1>Chat Monitoring & Moderation</h1>
          <div className={styles.headerActions}>
            <Button 
              variant="secondary" 
              onClick={() => window.location.reload()}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNavigation}>
          <TabButton 
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </TabButton>
          <TabButton 
            active={activeTab === 'search'}
            onClick={() => setActiveTab('search')}
          >
            Message Search
          </TabButton>
          <TabButton 
            active={activeTab === 'reports'}
            onClick={() => setActiveTab('reports')}
          >
            User Reports
          </TabButton>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className={styles.overviewTab}>
            {realTimeActivity && (
              <RealTimeActivityDashboard activity={realTimeActivity} />
            )}
            
            <div className={styles.quickStats}>
              <StatCard 
                title="Total Messages (24h)"
                value={realTimeActivity?.totals.messages || 0}
                icon="💬"
              />
              <StatCard 
                title="Moderation Actions (24h)"
                value={realTimeActivity?.totals.moderationActions || 0}
                icon="⚖️"
              />
              <StatCard 
                title="Pending Reports"
                value={realTimeActivity?.totals.pendingReports || 0}
                icon="🚩"
              />
              <StatCard 
                title="Urgent Reports"
                value={realTimeActivity?.totals.urgentReports || 0}
                icon="🚨"
              />
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className={styles.searchTab}>
            <ChatSearchInterface 
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              filters={filters}
              onFiltersChange={setFilters}
              onSearch={handleSearch}
            />

            <div className={styles.resultsSection}>
              <div className={styles.resultsHeader}>
                <h2>Search Results ({messages.length})</h2>
                {messages.length >= 500 && (
                  <div className={styles.limitWarning}>
                    Results limited to 500 for performance. Refine search for more specific results.
                  </div>
                )}
              </div>
              
              <MessageList 
                messages={messages}
                onMessageSelect={setSelectedMessage}
                onModerate={(msg) => {
                  setSelectedMessage(msg);
                  setModerationModal(true);
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className={styles.reportsTab}>
            <ReportsManagementInterface 
              reports={reports}
              onReportProcess={loadPendingReports}
              auditLogger={auditLogger}
            />
          </div>
        )}

        {/* Message Detail Modal */}
        {selectedMessage && !moderationModal && (
          <MessageDetailModal 
            isOpen={!!selectedMessage}
            message={selectedMessage}
            onClose={() => setSelectedMessage(null)}
            onModerate={() => setModerationModal(true)}
          />
        )}

        {/* Moderation Action Modal */}
        <ModerationActionModal 
          isOpen={moderationModal}
          message={selectedMessage}
          onClose={() => setModerationModal(false)}
          onConfirm={handleModerateMessage}
        />
      </div>
    </ManagementLayout>
  );
}
```

### Advanced Search Interface

```typescript
export const ChatSearchInterface: React.FC<SearchInterfaceProps> = ({
  searchQuery,
  onSearchQueryChange,
  filters,
  onFiltersChange,
  onSearch
}) => {
  const [advancedFilters, setAdvancedFilters] = useState(false);

  return (
    <div className={styles.searchInterface}>
      <div className={styles.primarySearch}>
        <Input 
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search messages by content, sender, or subject..."
          onKeyPress={(e) => e.key === 'Enter' && onSearch()}
          className={styles.searchInput}
        />
        <Button onClick={onSearch} variant="primary">
          Search
        </Button>
        <Button 
          onClick={() => setAdvancedFilters(!advancedFilters)}
          variant="secondary"
        >
          {advancedFilters ? 'Hide' : 'Show'} Filters
        </Button>
      </div>

      {advancedFilters && (
        <div className={styles.advancedFilters}>
          <div className={styles.filterRow}>
            <Select 
              label="Message Type"
              value={filters.messageType}
              onChange={(value) => onFiltersChange({ ...filters, messageType: value })}
              options={[
                { value: 'all', label: 'All Message Types' },
                { value: 'location', label: 'Location Chat' },
                { value: 'ongame', label: 'OnGame Messages (Postal)' },
                { value: 'offgame', label: 'OffGame Chat' }
              ]}
            />

            <CharacterSelector 
              label="Character"
              value={filters.characterId}
              onChange={(characterId) => onFiltersChange({ ...filters, characterId })}
              placeholder="Filter by character..."
            />
          </div>

          <div className={styles.filterRow}>
            <DateRangePicker 
              label="Date Range"
              startDate={filters.dateRange.start}
              endDate={filters.dateRange.end}
              onChange={(range) => onFiltersChange({ ...filters, dateRange: range })}
            />
          </div>

          <div className={styles.filterRow}>
            <Checkbox 
              checked={filters.flaggedOnly}
              onChange={(checked) => onFiltersChange({ ...filters, flaggedOnly: checked })}
              label="Show only flagged/moderated messages"
            />

            <Checkbox 
              checked={filters.moderatedOnly}
              onChange={(checked) => onFiltersChange({ ...filters, moderatedOnly: checked })}
              label="Show only previously moderated messages"
            />
          </div>
        </div>
      )}
    </div>
  );
};
```

## Real-Time Monitoring Integration

### WebSocket Events for Live Monitoring

```typescript
// Real-time monitoring events
interface MonitoringEvent {
  type: MonitoringEventType;
  data: any;
  timestamp: Date;
  severity?: ModerationSeverity;
}

enum MonitoringEventType {
  NEW_MESSAGE = 'chat:new_message',
  FLAGGED_CONTENT = 'chat:flagged_content', 
  MODERATION_ACTION = 'chat:moderation_action',
  USER_REPORT = 'chat:user_report',
  ESCALATION = 'chat:escalation'
}

// WebSocket integration for admin monitoring
class AdminMonitoringSocket {
  private socket: Socket;
  
  constructor() {
    this.socket = io('/admin-monitoring', {
      auth: { adminToken: getAdminToken() }
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    // New flagged content alert
    this.socket.on('chat:flagged_content', (data) => {
      this.handleFlaggedContent(data);
    });
    
    // Real-time moderation action notifications
    this.socket.on('chat:moderation_action', (data) => {
      this.handleModerationAction(data);
    });
    
    // New user report notifications
    this.socket.on('chat:user_report', (data) => {
      this.handleNewReport(data);
    });
    
    // High-priority escalations
    this.socket.on('chat:escalation', (data) => {
      this.handleEscalation(data);
    });
  }
  
  private handleFlaggedContent(data: any) {
    showAdminNotification({
      type: 'warning',
      title: 'Content Flagged',
      message: `Message from ${data.senderName} flagged: ${data.reason}`,
      actions: [
        { label: 'Review', action: () => navigateToMessage(data.messageId) },
        { label: 'Dismiss', action: () => dismissAlert(data.alertId) }
      ]
    });
  }
  
  private handleModerationAction(data: any) {
    updateModerationFeed({
      action: data.action,
      moderator: data.moderatorName,
      target: data.targetCharacterName,
      reason: data.reason,
      timestamp: new Date(data.timestamp)
    });
  }
}
```

## Automated Content Filtering

### Content Filter Middleware

```typescript
export class ContentFilterMiddleware {
  
  static async filterMessage(
    content: string, 
    messageType: MessageType,
    senderId: string
  ): Promise<FilterResult> {
    
    // Load active moderation configuration
    const config = await ChatModerationConfig.findOne({ isActive: true });
    if (!config) {
      return { allowed: true, flagged: false };
    }
    
    const results: FilterIssue[] = [];
    
    // Check banned words and phrases
    for (const bannedWord of config.bannedWords) {
      const detection = this.detectBannedContent(content, bannedWord);
      if (detection.found) {
        results.push({
          type: 'banned_word',
          category: bannedWord.category,
          severity: bannedWord.severity,
          autoAction: bannedWord.autoAction,
          details: detection.details
        });
      }
    }
    
    // Check rate limiting
    const rateLimitViolation = await this.checkRateLimit(senderId, messageType);
    if (rateLimitViolation.violated) {
      results.push({
        type: 'rate_limit',
        severity: 'medium',
        autoAction: 'warn',
        details: rateLimitViolation.details
      });
    }
    
    // Determine overall result
    const highestSeverity = this.getHighestSeverity(results);
    const shouldBlock = results.some(r => r.autoAction === 'delete');
    const shouldFlag = results.some(r => ['flag', 'hide'].includes(r.autoAction));
    
    return {
      allowed: !shouldBlock,
      flagged: shouldFlag || results.length > 0,
      issues: results,
      severity: highestSeverity,
      autoActions: results.map(r => r.autoAction)
    };
  }
  
  private static detectBannedContent(content: string, bannedWord: any): DetectionResult {
    const regex = bannedWord.isRegex ? 
      new RegExp(bannedWord.word, 'gi') : 
      new RegExp(`\\b${bannedWord.word}\\b`, 'gi');
      
    const matches = content.match(regex);
    
    return {
      found: !!matches,
      details: matches ? {
        word: bannedWord.word,
        matches: matches.length,
        category: bannedWord.category,
        positions: this.findMatchPositions(content, regex)
      } : undefined
    };
  }
  
  private static async checkRateLimit(
    senderId: string, 
    messageType: MessageType
  ): Promise<RateLimitResult> {
    
    const config = await ChatModerationConfig.findOne({ isActive: true });
    if (!config) return { violated: false };
    
    const rateLimitRule = config.rateLimits.find(r => r.messageType === messageType);
    if (!rateLimitRule) return { violated: false };
    
    const timeWindow = new Date(Date.now() - rateLimitRule.timeWindow * 60 * 1000);
    
    // Count recent messages from this sender
    let recentCount = 0;
    
    switch (messageType) {
      case MessageType.ONGAME:
        recentCount = await OnGameMessage.countDocuments({
          from: senderId,
          sentAt: { $gte: timeWindow }
        });
        break;
      case MessageType.OFFGAME:
        recentCount = await OffGameChatMessage.countDocuments({
          senderId: senderId,
          sentAt: { $gte: timeWindow }
        });
        break;
    }
    
    const violated = recentCount >= rateLimitRule.maxMessages;
    
    return {
      violated,
      details: violated ? {
        currentCount: recentCount,
        maxAllowed: rateLimitRule.maxMessages,
        timeWindow: rateLimitRule.timeWindow,
        action: rateLimitRule.action
      } : undefined
    };
  }
}

interface FilterResult {
  allowed: boolean;
  flagged: boolean;
  issues?: FilterIssue[];
  severity?: ModerationSeverity;
  autoActions?: string[];
}

interface FilterIssue {
  type: 'banned_word' | 'rate_limit' | 'spam' | 'personal_info';
  category?: string;
  severity: ModerationSeverity;
  autoAction: 'flag' | 'hide' | 'delete' | 'warn';
  details: any;
}
```

## Database Indexing & Performance

### Optimized Database Indexes

```typescript
// Chat Moderation Actions - Optimized for admin queries
await db.collection('chat_moderation_actions').createIndex({ 
  messageType: 1, 
  actionTakenAt: -1 
}, { name: 'moderation_actions_by_type_and_date' });

await db.collection('chat_moderation_actions').createIndex({ 
  targetCharacterId: 1, 
  severity: 1,
  actionTakenAt: -1
}, { name: 'moderation_actions_by_character' });

await db.collection('chat_moderation_actions').createIndex({ 
  moderatorId: 1, 
  actionTakenAt: -1 
}, { name: 'moderation_actions_by_moderator' });

await db.collection('chat_moderation_actions').createIndex({ 
  severity: 1, 
  isActive: 1,
  expiresAt: 1
}, { name: 'active_moderation_actions' });

await db.collection('chat_moderation_actions').createIndex({ 
  expiresAt: 1 
}, { 
  partialFilterExpression: { expiresAt: { $exists: true } },
  name: 'expiring_moderation_actions'
});

// User Reports - Optimized for admin dashboard
await db.collection('user_reports').createIndex({ 
  status: 1, 
  priorityScore: -1,
  reportedAt: -1 
}, { name: 'user_reports_by_status_and_priority' });

await db.collection('user_reports').createIndex({ 
  reportedCharacterId: 1, 
  status: 1 
}, { name: 'user_reports_by_reported_character' });

await db.collection('user_reports').createIndex({ 
  assignedModerator: 1, 
  status: 1 
}, { name: 'user_reports_by_assigned_moderator' });

await db.collection('user_reports').createIndex({ 
  isUrgent: 1, 
  reportedAt: -1 
}, { name: 'urgent_user_reports' });

// Message collections - Text search indexes for content filtering
await db.collection('ongame_messages').createIndex({ 
  content: 'text', 
  subject: 'text' 
}, { 
  name: 'ongame_messages_text_search',
  weights: { content: 1, subject: 2 }
});

await db.collection('offgame_chat_messages').createIndex({ 
  content: 'text' 
}, { name: 'offgame_messages_text_search' });

// Cross-collection message search optimization
await db.collection('ongame_messages').createIndex({ 
  from: 1, 
  sentAt: -1 
}, { name: 'ongame_messages_by_sender_date' });

await db.collection('offgame_chat_messages').createIndex({ 
  senderId: 1, 
  sentAt: -1 
}, { name: 'offgame_messages_by_sender_date' });
```

## Environment Configuration

```bash
# Chat Monitoring Configuration
CHAT_MONITORING_ENABLED=true
CHAT_MONITORING_RETENTION_DAYS=90
CHAT_MONITORING_REALTIME_ALERTS=true
CHAT_MONITORING_AUTO_ESCALATION=true

# Content Filtering
CONTENT_FILTER_ENABLED=true
CONTENT_FILTER_STRICT_MODE=false
BANNED_WORDS_AUTO_UPDATE=true
PROFANITY_FILTER_LEVEL=moderate

# Rate Limiting
CHAT_RATE_LIMIT_ENABLED=true
CHAT_RATE_LIMIT_WINDOW=15
CHAT_RATE_LIMIT_MAX_MESSAGES=50

# Automated Moderation
AUTO_MODERATION_ENABLED=true
AUTO_ESCALATION_ENABLED=true
ESCALATION_THRESHOLD_HIGH=3
ESCALATION_THRESHOLD_CRITICAL=1

# Real-time Monitoring  
REALTIME_MONITORING_ENABLED=true
REALTIME_ALERT_THRESHOLD=5
MONITORING_WEBSOCKET_ENABLED=true

# Report Management
REPORT_AUTO_ASSIGNMENT=true
REPORT_PRIORITY_SCORING=true
URGENT_REPORT_THRESHOLD=8
```

## Security & Access Control

### Admin Role Verification

```typescript
// Enhanced admin authentication for chat monitoring
export class ChatMonitoringAuthMiddleware {
  
  static async requireChatMonitoringAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      
      if (!auditInfo) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Verify chat monitoring permissions
      const hasPermission = await this.verifyChatMonitoringPermission(auditInfo.adminId);
      if (!hasPermission) {
        // Log unauthorized access attempt
        logger.warn('Unauthorized chat monitoring access attempt', {
          ...auditInfo,
          category: 'security_violation'
        });
        
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions for chat monitoring',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      // Log authorized access
      logger.info('Chat monitoring access granted', {
        ...auditInfo,
        category: 'access_control'
      });
      
      next();
      
    } catch (error) {
      logger.error('Chat monitoring auth middleware error', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Authentication system error',
        code: 'AUTH_SYSTEM_ERROR'
      });
    }
  }
  
  private static async verifyChatMonitoringPermission(adminId: string): Promise<boolean> {
    const character = await Character.findById(adminId);
    
    return character && character.roles.some(role =>
      ['moderatore', 'amministratore'].includes(role)
    );
  }
}
```

Il sistema di Chat Monitoring di TenPennyNovels fornisce un controllo completo e in tempo reale di tutte le comunicazioni della piattaforma, garantendo un ambiente sicuro e rispettoso per la community mentre mantenendo la trasparenza e l'accountability delle azioni di moderazione attraverso un sistema di audit completo.